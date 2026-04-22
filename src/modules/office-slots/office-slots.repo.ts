import { Db } from "../../infra/db/db";
import { CreateOfficeSlotBody, OfficeSlot, UpdateOfficeSlotBody, FriendOccupancy } from "./office-slots.schema";

export type OfficeSlotsRepo = {
  findAll:             (filters: { floor_id?: number }) => Promise<any[]>;
  findById:            (id: number) => Promise<OfficeSlot | null>;
  findAvailable:       (startTime: string, endTime: string, filters: { floor_id?: number }) => Promise<any[]>;
  findFriendOccupancy: (slotIds: number[], userId: string, startTime: string, endTime: string) => Promise<FriendOccupancy[]>;
  create:              (data: CreateOfficeSlotBody) => Promise<number>;
  update:              (id: number, data: UpdateOfficeSlotBody) => Promise<boolean>;
  remove:              (id: number) => Promise<boolean>;
  setBlocked:          (id: number, isBlocked: boolean) => Promise<boolean>;
  floorExists:         (floorId: number) => Promise<boolean>;
};

export function makeOfficeSlotsRepo(db: Db): OfficeSlotsRepo {
    const findAll = async (filters: { floor_id?: number }): Promise<any[]> => {
        const conditions = [];
        const params = [];

        if (filters.floor_id == undefined) {
            conditions.push("r.floor_id IS NULL");
            params.push(filters.floor_id);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const { rows } = await db.query(
            `SELECT r.id, r.name, r.capacity, r.floor_id, r.is_blocked, f.name 
            AS floor_name, r.is_blocked
            FROM reservables r
            JOIN floors f ON f.id = r.floor_id
            ${where},
            ORDER BY f.floor_number, r.name`,
            params
        );
        return rows;
    };

    const findById = async (id: number): Promise<OfficeSlot | null> => {
        const { rows } = await db.query(
            `SELECT r.id, r.name, r.capacity, r.floor_id, r.is_blocked, f.name
            AS floor_name, f.floor_number
            FROM reservables r
            JOIN floors f ON f.id = r.floor_id
            WHERE r.id = ?`,
            [id]
        );
        return rows.length ? rows[0] : null;
    };

    const findAvailable = async (startTime: string, endTime: string, filters: { floor_id?: number }): Promise<any[]> => {
        const conditions: string[] = [];
        const params: any[] = [startTime, endTime];
 
        if (filters.floor_id !== undefined) {
            conditions.push("r.floor_id = ?");
            params.push(filters.floor_id);
        }

        const extra = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

        const { rows } = await db.query(
            `SELECT r.id, r.name, r.capacity, r.floor_id, r.is_blocked, f.name AS floor_name, f.floor_number,
                COLASE(active.cnt, 0) AS current_reservations,
                (r.is_blocked = 0 AND COALESCE(active.cnt, 0) < r.capacity) AS is_available
            FROM reservables r
            JOIN floors f ON f.id = r.floor_id
            LEFT JOIN (
                SELECT reservables_id, COUNT(*) AS cnt
                FROM reservations
                WHERE start_time < ? AND end_time > ? GROUP BY reservables_id)
            active ON active.reservables_id = r.id
            WHERE 1=1 ${extra}
            ORDER BY f.floor_number, r.name`,
            params
        );
        return rows;
    };

    const findFriendOccupancy = async (slotIds: number[], userId: string, startTime: string, endTime: string): Promise<FriendOccupancy[]> => {
        if (slotIds.length === 0) return [];

        const placeholders = slotIds.map(() => "?").join(",");
        const { rows } = await db.query(`
            SELECT res.reservables_id AS slot_id, res.user_id, u.name AS user_name, res.start_time, res.end_time
            FROM reservations res
            JOIN users u ON u.e_id = res.user_id
            WHERE res.reservables_id IN (${placeholders})
            AND res.start_time < ? AND res.end_time > ? AND res.user_id IN (
                SELECT CASE
                    WHEN user_low = ? THEN user_high ELSE user_low END
                FROM friends
                WHERE (user_low = ? OR user_high = ?) AND status = 'accepted'
            )`,
            [...slotIds, startTime, endTime, userId, userId, userId]
        );
        return rows as FriendOccupancy[];
    };

    const create = async (data: CreateOfficeSlotBody): Promise<number> => {
        const { insertId } = await db.execute(
            `INSERT INTO reservables (name, capacity, floor_id, is_blocked) VALUES (?, ?, ?, 0)`,
            [data.name, data.capacity, data.floor_id]
        );
        return insertId!;
    };
 

    const update = async (id: number, data: UpdateOfficeSlotBody): Promise<boolean> => {
        const fields: string[] = [];
        const params: any[] = [];

        if (data.name !== undefined) { 
            fields.push("name = ?"); 
            params.push(data.name); 
        }
        if (data.capacity !== undefined) { 
            fields.push("capacity = ?"); 
            params.push(data.capacity); 
        }
        if (data.floor_id !== undefined) { 
            fields.push("floor_id = ?"); 
            params.push(data.floor_id); 
        }

        if (fields.length === 0) return false;
        params.push(id);

        const { affectedCount } = await db.execute(
            `UPDATE reservables SET ${fields.join(", ")} WHERE id = ?`,
            params
        );
        return affectedCount > 0;

    };

    const remove = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(
            `DELETE FROM reservables WHERE id = ?`,
            [id]
        );
        return affectedCount > 0;
    };
    
    const setBlocked = async (id: number, isBlocked: boolean): Promise<boolean> => {
        const { affectedCount } = await db.execute(
        `UPDATE reservables SET is_blocked = ? WHERE id = ?`,
        [isBlocked ? 1 : 0, id]
        );
        return affectedCount > 0;
    };
    
    const floorExists = async (floorId: number): Promise<boolean> => {
        const { rows } = await db.query(
        `SELECT id FROM floors WHERE id = ? LIMIT 1`,
        [floorId]
        );
        return rows.length > 0;
    };

    return {
        findAll,
        findById,
        findAvailable,
        findFriendOccupancy,
        create,
        update,
        remove,
        setBlocked,
        floorExists
    };
}