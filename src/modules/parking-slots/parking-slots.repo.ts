import { Db } from "../../infra/db/db.js";
import {
    ParkingReservation,
    ParkingLot,
    ListReservationsQuery,
} from "./parking-slots.schema.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OverlapRow = Pick<
    ParkingReservation,
    "id" | "user_id" | "created_at" | "allocation_state" | "lifecycle_status" | "attendance_status"
>;

const OCCUPANCY_FILTER = `
    attendance_status NOT IN ('CHECKED_OUT', 'NO_SHOW')
    AND (
        lifecycle_status = 'ACTIVE'
        OR (lifecycle_status = 'CANCELED' AND allocation_state = 'FROZEN')
    )
` as const;

export type ParkingSlotsRepo = {
    // Parking Lots
    getAllLots: () => Promise<ParkingLot[]>;
    getLotById: (id: number) => Promise<ParkingLot | null>;
    createLot: (name: string, capacity: number, priority: number) => Promise<ParkingLot | null>;
    updateLot: (id: number, fields: Partial<Omit<ParkingLot, "id">>) => Promise<ParkingLot | null>;
    deleteLot: (id: number) => Promise<boolean>;

    // Reservations - queries
    listReservations: (query: ListReservationsQuery) => Promise<ParkingReservation[]>;
    getReservationById: (id: number) => Promise<ParkingReservation | null>;
    getReservationByIdAndUser: (id: number, userId: string) => Promise<ParkingReservation | null>;

    /**
     * Verifica si el usuario ya tiene una reserva que cuente como ocupancy
     * solapada con el rango dado. Usa occupancy semantics completas.
     */
    hasActiveReservation: (userId: string, startTime: Date, endTime: Date) => Promise<boolean>;

    /**
     * Overlaps que cuentan como occupancy para FIFO projection.
     * Usa occupancy semantics completas.
     */
    getOverlaps: (reservationId: number, startTime: Date, endTime: Date) => Promise<OverlapRow[]>;

    /**
     * Cuenta reservas con occupancy real en la ventana [bucketStart, bucketEnd).
     */
    getReservationCountInWindow: (bucketStart: Date, bucketEnd: Date) => Promise<number>;

    // Mutations
    createReservation: (userId: string, startTime: Date, endTime: Date) => Promise<ParkingReservation | null>;
    cancelReservation: (id: number, freeze: boolean) => Promise<ParkingReservation | null>;
    updateAttendanceStatus: (id: number, attendanceStatus: string, freeze?: boolean) => Promise<ParkingReservation | null>;

    /**
     * Cron: marca NO_SHOW + FROZEN las reservas donde:
     *   lifecycle_status = ACTIVE
     *   attendance_status = NOT_ARRIVED
     *   NOW() >= start_time + checkinToleranceMinutes
     *
     * @param checkinToleranceMinutes minutos de gracia tras start_time para hacer check-in
     */
    markNoShowExpired: (checkinToleranceMinutes: number) => Promise<number>;
};

// ─── Factory ─────────────────────────────────────────────────────────────────

export function makeParkingSlotsRepo(db: Db): ParkingSlotsRepo {

    // ── Parking Lots ──────────────────────────────────────────────────────────

    const getAllLots = async (): Promise<ParkingLot[]> => {
        const { rows } = await db.query(
            `SELECT id, name, capacity, priority
             FROM parking_lots
             ORDER BY priority ASC, id ASC`,
            []
        );
        return rows as ParkingLot[];
    };

    const getLotById = async (id: number): Promise<ParkingLot | null> => {
        const { rows } = await db.query(
            `SELECT id, name, capacity, priority FROM parking_lots WHERE id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as ParkingLot) : null;
    };

    const createLot = async (
        name: string,
        capacity: number,
        priority: number
    ): Promise<ParkingLot | null> => {
        const { insertId } = await db.execute(
            `INSERT INTO parking_lots (name, capacity, priority) VALUES (?, ?, ?)`,
            [name, capacity, priority]
        );
        if (!insertId) return null;
        return getLotById(insertId);
    };

    const updateLot = async (
        id: number,
        fields: Partial<Omit<ParkingLot, "id">>
    ): Promise<ParkingLot | null> => {
        const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
        if (!entries.length) return getLotById(id);

        const setClauses = entries.map(([col]) => `${col} = ?`).join(", ");
        const values = entries.map(([, v]) => v);

        const { affectedCount } = await db.execute(
            `UPDATE parking_lots SET ${setClauses} WHERE id = ?`,
            [...values, id]
        );
        if (affectedCount === 0) return null;
        return getLotById(id);
    };

    const deleteLot = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(
            `DELETE FROM parking_lots WHERE id = ?`,
            [id]
        );
        return affectedCount > 0;
    };

    // ── Reservations – queries ────────────────────────────────────────────────

    const listReservations = async (
        query: ListReservationsQuery
    ): Promise<ParkingReservation[]> => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (query.user_id) {
            conditions.push("r.user_id = ?");
            params.push(query.user_id);
        }
        if (query.start_time) {
            conditions.push("r.end_time > ?");
            params.push(query.start_time);
        }
        if (query.end_time) {
            conditions.push("r.start_time < ?");
            params.push(query.end_time);
        }
        if (query.lifecycle_status) {
            conditions.push("r.lifecycle_status = ?");
            params.push(query.lifecycle_status);
        }
        if (query.attendance_status) {
            conditions.push("r.attendance_status = ?");
            params.push(query.attendance_status);
        }
        if (query.allocation_state) {
            conditions.push("r.allocation_state = ?");
            params.push(query.allocation_state);
        }
        if (query.cursor) {
            conditions.push("r.id > ?");
            params.push(query.cursor);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(query.limit);

        const { rows } = await db.query(
            `SELECT
                r.id, r.user_id, r.start_time, r.end_time,
                r.lifecycle_status, r.attendance_status, r.allocation_state,
                r.canceled_at, r.created_at, r.updated_at
             FROM parking_reservations r
             ${where}
             ORDER BY r.created_at ASC
             LIMIT ?`,
            params
        );
        return rows as ParkingReservation[];
    };

    const getReservationById = async (id: number): Promise<ParkingReservation | null> => {
        const { rows } = await db.query(
            `SELECT
                id, user_id, start_time, end_time,
                lifecycle_status, attendance_status, allocation_state,
                canceled_at, created_at, updated_at
             FROM parking_reservations WHERE id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as ParkingReservation) : null;
    };

    const getReservationByIdAndUser = async (
        id: number,
        userId: string
    ): Promise<ParkingReservation | null> => {
        const { rows } = await db.query(
            `SELECT
                id, user_id, start_time, end_time,
                lifecycle_status, attendance_status, allocation_state,
                canceled_at, created_at, updated_at
             FROM parking_reservations
             WHERE id = ? AND user_id = ?`,
            [id, userId]
        );
        return rows.length ? (rows[0] as ParkingReservation) : null;
    };

    const hasActiveReservation = async (
        userId: string,
        startTime: Date,
        endTime: Date
    ): Promise<boolean> => {
        const { rows } = await db.query(
            `SELECT id FROM parking_reservations
             WHERE user_id = ?
               AND start_time < ?
               AND end_time > ?
               AND ${OCCUPANCY_FILTER}
             LIMIT 1`,
            [userId, endTime, startTime]
        );
        return rows.length > 0;
    };

    const getOverlaps = async (
        reservationId: number,
        startTime: Date,
        endTime: Date
    ): Promise<OverlapRow[]> => {
        const { rows } = await db.query(
            `SELECT id, user_id, created_at, allocation_state, lifecycle_status, attendance_status
             FROM parking_reservations
             WHERE id != ?
               AND start_time < ?
               AND end_time > ?
               AND ${OCCUPANCY_FILTER}
             ORDER BY created_at ASC`,
            [reservationId, endTime, startTime]
        );
        return rows as OverlapRow[];
    };

    const getReservationCountInWindow = async (
        bucketStart: Date,
        bucketEnd: Date,
    ): Promise<number> => {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS cnt
             FROM parking_reservations
             WHERE start_time < ?
               AND end_time > ?
               AND ${OCCUPANCY_FILTER}`,
            [bucketEnd, bucketStart]
        );
        return Number((rows[0] as any).cnt);
    };

    // ── Mutations ─────────────────────────────────────────────────────────────

    const createReservation = async (
        userId: string,
        startTime: Date,
        endTime: Date,
    ): Promise<ParkingReservation | null> => {
        const { insertId } = await db.execute(
            `INSERT INTO parking_reservations
                (user_id, start_time, end_time, lifecycle_status, attendance_status, allocation_state)
             VALUES (?, ?, ?, 'ACTIVE', 'NOT_ARRIVED', 'SOFT')`,
            [userId, startTime, endTime]
        );
        if (!insertId) return null;
        return getReservationById(insertId);
    };

    const cancelReservation = async (
        id: number,
        freeze: boolean,
    ): Promise<ParkingReservation | null> => {
        const freezeClause = freeze ? `, allocation_state = 'FROZEN'` : "";

        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET lifecycle_status = 'CANCELED', canceled_at = NOW() ${freezeClause}
             WHERE id = ?`,
            [id]
        );
        if (affectedCount === 0) return null;
        return getReservationById(id);
    };

    const updateAttendanceStatus = async (
        id: number,
        attendanceStatus: string,
        freeze = false,
    ): Promise<ParkingReservation | null> => {
        const freezeClause = freeze ? `, allocation_state = 'FROZEN'` : "";

        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = ? ${freezeClause}
             WHERE id = ?`,
            [attendanceStatus, id]
        );
        if (affectedCount === 0) return null;
        return getReservationById(id);
    };

    const markNoShowExpired = async (checkinToleranceMinutes: number): Promise<number> => {
        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = 'NO_SHOW',
                 allocation_state  = 'FROZEN'
             WHERE lifecycle_status  = 'ACTIVE'
               AND attendance_status = 'NOT_ARRIVED'
               AND NOW() >= DATE_ADD(start_time, INTERVAL ? MINUTE)`,
            [checkinToleranceMinutes]
        );
        return affectedCount;
    };

    return {
        getAllLots,
        getLotById,
        createLot,
        updateLot,
        deleteLot,

        listReservations,
        getReservationById,
        getReservationByIdAndUser,
        hasActiveReservation,
        getOverlaps,
        getReservationCountInWindow,

        createReservation,
        cancelReservation,
        updateAttendanceStatus,
        markNoShowExpired,
    };
}