import { Db } from "../../infra/db/db";
import { ParkingReservation, ParkingReservationCount } from "./parking-slots.schema";

export type ParkingSlotsRepo = {
    getAll: () => Promise<ParkingReservation[]>;
    getAvailabilityBetween: (startTime: string, endTime: string, excludeReservationId?: number) => Promise<ParkingReservationCount[]>;

    reserveBetween: (parkingLotId: number, userId: string, startTime: string, endTime: string) => Promise<ParkingReservation | null>;
    reassignParkingReservation: (id: number, newParkingLotId: number) => Promise<ParkingReservation | null>;

    remove: (id: number) => Promise<boolean>;

    // helpers
    getById: (id: number) => Promise<ParkingReservation | null>;
    getByIdAndUser: (id: number, userId: string) => Promise<ParkingReservation | null>;
    hasActiveReservation: (userId: string, startTime: string, endTime: string) => Promise<boolean>;
};

export function makeParkingSlotsRepo(db: Db): ParkingSlotsRepo {

    const getAll = async (): Promise<ParkingReservation[]> => {
        const { rows } = await db.query(
            `SELECT id, parking_lot_id, user_id, start_time, end_time, checked_in
             FROM parking_reservations
             ORDER BY start_time DESC`,
            []
        );
        return rows as ParkingReservation[];
    };

    const getAvailabilityBetween = async (
        startTime: string,
        endTime: string,
        excludeReservationId?: number
    ): Promise<ParkingReservationCount[]> => {
        // Overlap condition: existing.start_time < newEnd AND existing.end_time > newStart
        // excludeReservationId: used during reassign so the current reservation is not
        // counted against the target lot's capacity check.
        const excludeClause = excludeReservationId ? `AND pr.id != ?` : '';
        const params: any[] = [endTime, startTime];
        if (excludeReservationId) params.push(excludeReservationId);

        const { rows } = await db.query(
            `SELECT
                pl.id,
                pl.name,
                pl.capacity,
                COUNT(pr.id) AS reservedCount
             FROM parking_lots pl
             LEFT JOIN parking_reservations pr
                ON pr.parking_lot_id = pl.id
                AND pr.start_time < ?
                AND pr.end_time > ?
                ${excludeClause}
             GROUP BY pl.id, pl.name, pl.capacity
             ORDER BY pl.capacity ASC, pl.id ASC`,
            params
        );
        return rows as ParkingReservationCount[];
    };

    const reserveBetween = async (
        parkingLotId: number,
        userId: string,
        startTime: string,
        endTime: string
    ): Promise<ParkingReservation | null> => {
        const { insertId } = await db.execute(
            `INSERT INTO parking_reservations (parking_lot_id, user_id, start_time, end_time, checked_in)
             VALUES (?, ?, ?, ?, 0)`,
            [parkingLotId, userId, startTime, endTime]
        );
        if (!insertId) return null;
        return getById(insertId);
    };

    const reassignParkingReservation = async (
        id: number,
        newParkingLotId: number
    ): Promise<ParkingReservation | null> => {
        const { affectedCount } = await db.execute(
            `UPDATE parking_reservations SET parking_lot_id = ? WHERE id = ?`,
            [newParkingLotId, id]
        );
        if (affectedCount === 0) return null;
        return getById(id);
    };

    const remove = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(
            `DELETE FROM parking_reservations WHERE id = ?`,
            [id]
        );
        return affectedCount > 0;
    };

    const getById = async (id: number): Promise<ParkingReservation | null> => {
        const { rows } = await db.query(
            `SELECT id, parking_lot_id, user_id, start_time, end_time, checked_in
             FROM parking_reservations
             WHERE id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as ParkingReservation) : null;
    };

    const getByIdAndUser = async (id: number, userId: string): Promise<ParkingReservation | null> => {
        const { rows } = await db.query(
            `SELECT id, parking_lot_id, user_id, start_time, end_time, checked_in
             FROM parking_reservations
             WHERE id = ? AND user_id = ?`,
            [id, userId]
        );
        return rows.length ? (rows[0] as ParkingReservation) : null;
    };

    const hasActiveReservation = async (
        userId: string,
        startTime: string,
        endTime: string
    ): Promise<boolean> => {
        const { rows } = await db.query(
            `SELECT id FROM parking_reservations
             WHERE user_id = ?
               AND start_time < ?
               AND end_time > ?
             LIMIT 1`,
            [userId, endTime, startTime]
        );
        return rows.length > 0;
    };

    return {
        getAll,
        getAvailabilityBetween,
        reserveBetween,
        reassignParkingReservation,
        remove,
        getById,
        getByIdAndUser,
        hasActiveReservation,
    };
}