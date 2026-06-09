import { Db } from '../../infra/db/db.js';
import { Cursor } from '../../shared/utils/cursor.utils.js';
import {
    ParkingReservation,
    ParkingLot,
    ListReservationsQuery,
    ListReservationsPage,
    ListReservationsCursorSchema,
    AttendanceStatus,
    inferLifecycleStatus,
} from './parking-slots.schema.js';

export type OverlapRow = Pick<
    ParkingReservation,
    'id' | 'user_id' | 'created_at' | 'attendance_status' | 'lifecycle_status'
>;

const OCCUPANCY_FILTER = `
    attendance_status NOT IN ('CHECKED_OUT', 'NO_SHOW', 'CANCELED')
` as const;

function lifecycleToAttendanceStatuses(
    lc: 'ACTIVE' | 'CANCELED' | 'FINALIZED',
): AttendanceStatus[] {
    switch (lc) {
        case 'ACTIVE':
            return ['NOT_ARRIVED', 'CHECKED_IN'];
        case 'CANCELED':
            return ['CANCELED'];
        case 'FINALIZED':
            return ['CHECKED_OUT', 'NO_SHOW'];
    }
}

type ReservationRow = Omit<ParkingReservation, 'lifecycle_status'>;

function hydrateReservation(row: ReservationRow): ParkingReservation {
    return {
        ...row,
        lifecycle_status: inferLifecycleStatus(row.attendance_status),
    };
}

export type ParkingSlotsRepo = {
    // Parking Lots
    getAllLots: () => Promise<ParkingLot[]>;
    getLotById: (id: number) => Promise<ParkingLot | null>;
    createLot: (name: string, capacity: number, priority: number) => Promise<ParkingLot | null>;
    updateLot: (id: number, fields: Partial<Omit<ParkingLot, 'id'>>) => Promise<ParkingLot | null>;
    deleteLot: (id: number) => Promise<boolean>;

    // Reservations - queries
    listReservations: (query: ListReservationsQuery) => Promise<ListReservationsPage>;
    getReservationById: (id: number) => Promise<ParkingReservation | null>;
    getReservationsByUser: (userId: string) => Promise<ParkingReservation[]>;
    getReservationsByUserInRange: (
        userId: string,
        startTime: string,
        endTime: string,
    ) => Promise<ParkingReservation[]>;
    getReservationByIdAndUser: (id: number, userId: string) => Promise<ParkingReservation | null>;

    hasActiveReservation: (userId: string, startTime: Date, endTime: Date) => Promise<boolean>;

    /**
     * Overlaps que cuentan como occupancy para FIFO projection.
     */
    getOverlaps: (reservationId: number, startTime: Date, endTime: Date) => Promise<OverlapRow[]>;

    /**
     * Cuenta reservas con occupancy real en la ventana [bucketStart, bucketEnd).
     */
    getReservationCountInWindow: (bucketStart: Date, bucketEnd: Date) => Promise<number>;

    // Mutations
    createReservation: (
        userId: string,
        startTime: Date,
        endTime: Date,
    ) => Promise<ParkingReservation | null>;

    cancelReservation: (id: number) => Promise<ParkingReservation | null>;

    updateAttendanceStatus: (
        id: number,
        attendanceStatus: AttendanceStatus,
    ) => Promise<ParkingReservation | null>;

    markNoShowExpired: (checkinToleranceMinutes: number) => Promise<number>;

    markNoShowForReservation: (
        reservationId: number,
    ) => Promise<
        { marked: true; reservation: ParkingReservation } | { marked: false; reason: string }
    >;

    markCheckoutForReservation: (
        reservationId: number,
    ) => Promise<
        | { action: 'checked_out' | 'no_show_fallback'; reservation: ParkingReservation }
        | { action: 'skipped'; reason: string }
    >;

    getPendingNoShowReservations: (
        checkinToleranceMinutes: number,
    ) => Promise<Array<Pick<ParkingReservation, 'id' | 'start_time'>>>;

    getPendingCheckoutReservations: () => Promise<
        Array<Pick<ParkingReservation, 'id' | 'end_time'>>
    >;
};

export function makeParkingSlotsRepo(db: Db): ParkingSlotsRepo {
    // ── Parking Lots ──────────────────────────────────────────────────────────

    const getAllLots = async (): Promise<ParkingLot[]> => {
        const { rows } = await db.query(
            `SELECT id, name, capacity, priority
             FROM parking_lots
             ORDER BY priority ASC, id ASC`,
            [],
        );
        return rows as ParkingLot[];
    };

    const getLotById = async (id: number): Promise<ParkingLot | null> => {
        const { rows } = await db.query(
            `SELECT id, name, capacity, priority FROM parking_lots WHERE id = ?`,
            [id],
        );
        return rows.length ? (rows[0] as ParkingLot) : null;
    };

    const createLot = async (
        name: string,
        capacity: number,
        priority: number,
    ): Promise<ParkingLot | null> => {
        const { insertId } = await db.execute(
            `INSERT INTO parking_lots (name, capacity, priority) VALUES (?, ?, ?)`,
            [name, capacity, priority],
        );
        if (!insertId) return null;
        return getLotById(insertId);
    };

    const updateLot = async (
        id: number,
        fields: Partial<Omit<ParkingLot, 'id'>>,
    ): Promise<ParkingLot | null> => {
        const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
        if (!entries.length) return getLotById(id);

        const setClauses = entries.map(([col]) => `${col} = ?`).join(', ');
        const values = entries.map(([, v]) => v);

        const { affectedCount } = await db.execute(
            `UPDATE parking_lots SET ${setClauses} WHERE id = ?`,
            [...values, id],
        );
        if (affectedCount === 0) return null;
        return getLotById(id);
    };

    const deleteLot = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(`DELETE FROM parking_lots WHERE id = ?`, [id]);
        return affectedCount > 0;
    };

    // ── Reservations – queries ────────────────────────────────────────────────

    const SELECT_FIELDS = `
        id, user_id, start_time, end_time,
        attendance_status, canceled_at, created_at, updated_at
    `;

    const listReservations = async (
        query: ListReservationsQuery,
    ): Promise<ListReservationsPage> => {
        const conditions: string[] = [];
        const params: any[] = [];
        const decodedCursor =
            query.cursor !== null
                ? Cursor.decode(query.cursor, ListReservationsCursorSchema)
                : null;

        if (query.user_id) {
            conditions.push('r.user_id = ?');
            params.push(query.user_id);
        }
        if (query.start_time) {
            conditions.push('r.end_time > ?');
            params.push(query.start_time);
        }
        if (query.end_time) {
            conditions.push('r.start_time < ?');
            params.push(query.end_time);
        }

        if (query.lifecycle_status) {
            const statuses = lifecycleToAttendanceStatuses(query.lifecycle_status);
            conditions.push(`r.attendance_status IN (${statuses.map(() => '?').join(', ')})`);
            params.push(...statuses);
        }

        if (query.attendance_status) {
            conditions.push('r.attendance_status = ?');
            params.push(query.attendance_status);
        }
        if (decodedCursor) {
            conditions.push('r.id > ?');
            params.push(decodedCursor.lastId);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const hasLimit = query.limit !== undefined;
        const limit = query.limit;
        const sql = `
            SELECT ${SELECT_FIELDS}
            FROM parking_reservations r
            ${where}
            ORDER BY r.id ASC
            ${hasLimit ? 'LIMIT ?' : ''}
        `;
        const queryParams = hasLimit ? [...params, (limit as number) + 1] : params;

        const { rows } = await db.query(sql, queryParams);

        const items = (rows as ReservationRow[]).map(hydrateReservation);
        const hasMore = hasLimit ? items.length > (limit as number) : false;
        const pageItems = hasLimit && hasMore ? items.slice(0, limit as number) : items;
        const nextCursor =
            hasLimit && hasMore && pageItems.length > 0
                ? Cursor.encode({ lastId: pageItems[pageItems.length - 1].id })
                : null;

        return { items: pageItems, nextCursor };
    };

    const getReservationById = async (id: number): Promise<ParkingReservation | null> => {
        const { rows } = await db.query(
            `SELECT ${SELECT_FIELDS} FROM parking_reservations WHERE id = ?`,
            [id],
        );
        return rows.length ? hydrateReservation(rows[0] as ReservationRow) : null;
    };

    const getReservationsByUser = async (userId: string): Promise<ParkingReservation[]> => {
        const { rows } = await db.query(
            `SELECT ${SELECT_FIELDS} FROM parking_reservations WHERE user_id = ?`,
            [userId],
        );
        return (rows as ReservationRow[]).map(hydrateReservation);
    };
    const getReservationsByUserInRange = async (
        userId: string,
        startTime: string,
        endTime: string,
    ): Promise<ParkingReservation[]> => {
        const { rows } = await db.query(
            `SELECT ${SELECT_FIELDS}
            FROM parking_reservations
            WHERE user_id = ?
                AND start_time < ?
                AND end_time > ?
                AND canceled_at IS NULL
            ORDER BY start_time ASC`,
            [userId, endTime, startTime],
        );

        return (rows as ReservationRow[]).map(hydrateReservation);
    };

    const getReservationByIdAndUser = async (
        id: number,
        userId: string,
    ): Promise<ParkingReservation | null> => {
        const { rows } = await db.query(
            `SELECT ${SELECT_FIELDS}
             FROM parking_reservations
             WHERE id = ? AND user_id = ?`,
            [id, userId],
        );
        return rows.length ? hydrateReservation(rows[0] as ReservationRow) : null;
    };

    const hasActiveReservation = async (
        userId: string,
        startTime: Date,
        endTime: Date,
    ): Promise<boolean> => {
        const { rows } = await db.query(
            `SELECT id FROM parking_reservations
             WHERE user_id = ?
               AND start_time < ?
               AND end_time > ?
               AND ${OCCUPANCY_FILTER}
             LIMIT 1`,
            [userId, endTime, startTime],
        );
        return rows.length > 0;
    };

    const getOverlaps = async (
        reservationId: number,
        startTime: Date,
        endTime: Date,
    ): Promise<OverlapRow[]> => {
        const { rows } = await db.query(
            `SELECT id, user_id, created_at, attendance_status
             FROM parking_reservations
             WHERE id != ?
               AND start_time < ?
               AND end_time > ?
               AND ${OCCUPANCY_FILTER}
             ORDER BY created_at ASC`,
            [reservationId, endTime, startTime],
        );
        return (rows as Omit<OverlapRow, 'lifecycle_status'>[]).map((r) => ({
            ...r,
            lifecycle_status: inferLifecycleStatus(r.attendance_status),
        }));
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
            [bucketEnd, bucketStart],
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
                (user_id, start_time, end_time, attendance_status)
             VALUES (?, ?, ?, 'NOT_ARRIVED')`,
            [userId, startTime, endTime],
        );
        if (!insertId) return null;
        return getReservationById(insertId);
    };

    const cancelReservation = async (id: number): Promise<ParkingReservation | null> => {
        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = 'CANCELED',
                 canceled_at       = NOW()
             WHERE id = ?`,
            [id],
        );
        if (affectedCount === 0) return null;
        return getReservationById(id);
    };

    const updateAttendanceStatus = async (
        id: number,
        attendanceStatus: AttendanceStatus,
    ): Promise<ParkingReservation | null> => {
        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = ?
             WHERE id = ?`,
            [attendanceStatus, id],
        );
        if (affectedCount === 0) return null;
        return getReservationById(id);
    };

    const markNoShowExpired = async (checkinToleranceMinutes: number): Promise<number> => {
        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = 'NO_SHOW'
             WHERE attendance_status = 'NOT_ARRIVED'
               AND NOW() >= DATE_ADD(start_time, INTERVAL ? MINUTE)`,
            [checkinToleranceMinutes],
        );
        return affectedCount;
    };

    const markNoShowForReservation = async (
        reservationId: number,
    ): Promise<
        { marked: true; reservation: ParkingReservation } | { marked: false; reason: string }
    > => {
        // UPDATE condicional — solo actúa si aún está en NOT_ARRIVED.
        // Previene race conditions con check-ins manuales concurrentes.
        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = 'NO_SHOW'
             WHERE id               = ?
               AND attendance_status = 'NOT_ARRIVED'`,
            [reservationId],
        );

        if (affectedCount === 0) {
            const existing = await getReservationById(reservationId);
            if (!existing) return { marked: false, reason: 'Reservación no encontrada' };
            return {
                marked: false,
                reason: `Estado actual: attendance=${existing.attendance_status}`,
            };
        }

        const updated = await getReservationById(reservationId);
        if (!updated)
            return { marked: false, reason: 'No se pudo releer la reservación tras el update' };

        return { marked: true, reservation: updated };
    };

    const markCheckoutForReservation = async (
        reservationId: number,
    ): Promise<
        | { action: 'checked_out' | 'no_show_fallback'; reservation: ParkingReservation }
        | { action: 'skipped'; reason: string }
    > => {
        // Caso principal: el usuario hizo check-in y olvidó finalizar.
        // Clampeamos updated_at a end_time: refleja cuándo debió ocurrir el checkout,
        // no cuándo lo ejecutó el worker (que puede llegar tarde tras un restart).
        const checkoutResult = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = 'CHECKED_OUT',
                 updated_at        = end_time
             WHERE id               = ?
               AND attendance_status = 'CHECKED_IN'`,
            [reservationId],
        );

        if (checkoutResult.affectedCount > 0) {
            const updated = await getReservationById(reservationId);
            if (!updated)
                return {
                    action: 'skipped',
                    reason: 'No se pudo releer la reservación tras el checkout',
                };
            return { action: 'checked_out', reservation: updated };
        }

        // Fallback defensivo: el job de no-show debió haberlo resuelto, pero por
        // alguna razón (restart, falla) el usuario sigue en NOT_ARRIVED a end_time.
        const noShowResult = await db.execute(
            `UPDATE parking_reservations
             SET attendance_status = 'NO_SHOW',
                 updated_at        = end_time
             WHERE id               = ?
               AND attendance_status = 'NOT_ARRIVED'`,
            [reservationId],
        );

        if (noShowResult.affectedCount > 0) {
            const updated = await getReservationById(reservationId);
            if (!updated)
                return {
                    action: 'skipped',
                    reason: 'No se pudo releer la reservación tras el no-show fallback',
                };
            return { action: 'no_show_fallback', reservation: updated };
        }

        // Ya estaba en un estado terminal (CHECKED_OUT, NO_SHOW, CANCELED): no-op.
        const existing = await getReservationById(reservationId);
        return {
            action: 'skipped',
            reason: existing
                ? `Ya en estado terminal: ${existing.attendance_status}`
                : 'Reservación no encontrada',
        };
    };

    const getPendingNoShowReservations = async (
        checkinToleranceMinutes: number,
    ): Promise<Array<Pick<ParkingReservation, 'id' | 'start_time'>>> => {
        const { rows } = await db.query(
            `SELECT id, start_time
             FROM parking_reservations
             WHERE attendance_status = 'NOT_ARRIVED'
               AND DATE_ADD(start_time, INTERVAL ? MINUTE) > NOW()`,
            [checkinToleranceMinutes],
        );
        return rows as Array<Pick<ParkingReservation, 'id' | 'start_time'>>;
    };

    const getPendingCheckoutReservations = async (): Promise<
        Array<Pick<ParkingReservation, 'id' | 'end_time'>>
    > => {
        const { rows } = await db.query(
            `SELECT id, end_time
             FROM parking_reservations
             WHERE attendance_status = 'CHECKED_IN'
               AND end_time > NOW()`,
            [],
        );
        return rows as Array<Pick<ParkingReservation, 'id' | 'end_time'>>;
    };

    return {
        getAllLots,
        getLotById,
        createLot,
        updateLot,
        deleteLot,

        listReservations,
        getReservationById,
        getReservationsByUser,
        getReservationsByUserInRange,
        getReservationByIdAndUser,
        hasActiveReservation,
        getOverlaps,
        getReservationCountInWindow,

        createReservation,
        cancelReservation,
        updateAttendanceStatus,
        markNoShowExpired,
        markNoShowForReservation,
        markCheckoutForReservation,
        getPendingNoShowReservations,
        getPendingCheckoutReservations,
    };
}
