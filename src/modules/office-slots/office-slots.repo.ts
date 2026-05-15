import { Db } from "../../infra/db/db.js";
import {
    CreateOfficeSlotBody,
    OfficeSlot,
    UpdateOfficeSlotBody,
    FriendOccupancy,
    WorkGroup,
    UserSummary,
    GuestSummary,
    ParticipantStatus,
    UserReservationSummary,
    FriendReservationsSummary,
    Event,
    CreateEventBody,
    GetEventsQuery,
} from "./office-slots.schema.js";
import { toMysqlUtc } from "../../shared/utils/date.utils.js";

export type OfficeSlotsRepo = {
    findAll: (filters: { floor_id?: number }) => Promise<any[]>;
    findById: (id: number) => Promise<OfficeSlot | null>;
    findAvailable: (startTime: string, endTime: string, filters: { floor_id?: number }) => Promise<any[]>;
    findFriendOccupancy: (slotIds: number[], userId: string, startTime: string, endTime: string) => Promise<FriendOccupancy[]>;
    findWorkGroups: () => Promise<WorkGroup[]>;
    findUsers: () => Promise<UserSummary[]>;
    findGuests: () => Promise<GuestSummary[]>;
    findWorkGroupMembers: (workGroupIds: number[]) => Promise<Array<{ work_group_id: number; user_id: string }>>;
    create: (data: CreateOfficeSlotBody) => Promise<number>;
    update: (id: number, data: UpdateOfficeSlotBody) => Promise<boolean>;
    remove: (id: number) => Promise<boolean>;
    setBlocked: (id: number, isBlocked: boolean) => Promise<boolean>;
    floorExists: (floorId: number) => Promise<boolean>;
    findReservationsByReservable: (reservableId: number) => Promise<Array<{ id: number; reservable_id: number; start_time: string; end_time: string; can_overlap: number }>>;
    findReservationById: (reservationId: number) => Promise<{ id: number; reservable_id: number; start_time: string; end_time: string; can_overlap: number; description: string } | null>;
    findReservationWorkGroups: (reservationIds: number[]) => Promise<Array<{ reservationId: number; id: number; name: string; description: string | null }>>;
    findParticipantsByReservationIds: (reservationIds: number[]) => Promise<Array<{ id: number; reservationId: number; userId: string | null; guestId: number | null; ownershipPriority: number; checkedIn: number; status: string; user_name: string | null; user_email: string | null; user_role: string | null; guest_name: string | null; guest_email: string | null }>>;
    createReservation: (reservableId: number, startTime: string, endTime: string, canOverlap: boolean, description: string) => Promise<number>;
    addReservationWorkGroups: (reservationId: number, workGroupIds: number[]) => Promise<void>;
    addReservationParticipant: (reservationId: number, userId: string | null, guestId: number | null, ownershipPriority: number, status: ParticipantStatus) => Promise<number>;
    findParticipantById: (participantId: number) => Promise<{ id: number; reservationId: number; userId: string | null; guestId: number | null; ownershipPriority: number; checkedIn: number; status: string; user_name: string | null; user_email: string | null; user_role: string | null; guest_name: string | null; guest_email: string | null } | null>;
    updateParticipantStatus: (participantId: number, status: ParticipantStatus) => Promise<boolean>;
    findReservationsByUserId: (userId: string) => Promise<number[]>;
    findReservationsByUserIds: (userIds: string[]) => Promise<number[]>;
    findMyReservationSummaries: (userId: string) => Promise<UserReservationSummary>;
    findFriendsReservationSummaries: (userIds: string[]) => Promise<FriendReservationsSummary>;
    // ─── Events ───────────────────────────────────────────────────────────────────
    findEvents: (query: GetEventsQuery) => Promise<Event[]>;
    createEvent: (data: CreateEventBody) => Promise<number>;
    findEventById: (id: number) => Promise<Event | null>;
    /**
     * Returns overlapping reservations (where can_overlap = 0) for a given
     * reservable and time window. Used inside the create-reservation transaction.
     */
    findOverlappingReservations: (reservableId: number, startTime: string, endTime: string) => Promise<Array<{ id: number }>>;
    /**
     * Returns overlapping events for a given reservable and time window.
     * Used inside the create-reservation and create-event transactions.
     */
    findOverlappingEvents: (reservableId: number, startTime: string, endTime: string) => Promise<Array<{ id: number }>>;
};

export function makeOfficeSlotsRepo(db: Db): OfficeSlotsRepo {
    const findAll = async (filters: { floor_id?: number }): Promise<any[]> => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filters.floor_id !== undefined) {
            conditions.push("r.floor_id = ?");
            params.push(filters.floor_id);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const { rows } = await db.query(
            `SELECT r.id, r.name, r.capacity, r.floor_id, r.is_blocked, f.name AS floor_name
            FROM reservables r
            JOIN floors f ON f.id = r.floor_id
            ${where}
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
        const params: any[] = [toMysqlUtc(startTime), toMysqlUtc(endTime)];

        if (filters.floor_id !== undefined) {
            conditions.push("r.floor_id = ?");
            params.push(filters.floor_id);
        }

        const extra = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

        const { rows } = await db.query(
            `SELECT r.id, r.name, r.capacity, r.floor_id, r.is_blocked, f.name AS floor_name, f.floor_number,
                COALESCE(active.cnt, 0) AS current_reservations,
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
                FROM friendships
                WHERE (user_low = ? OR user_high = ?)
            )`,
            [...slotIds, toMysqlUtc(startTime), toMysqlUtc(endTime), userId, userId, userId]
        );
        return rows as FriendOccupancy[];
    };

    const findWorkGroups = async (): Promise<WorkGroup[]> => {
        const { rows } = await db.query(`
            SELECT wg.id, wg.name, wg.description, COUNT(wgm.user_id) AS memberCount
            FROM work_groups wg
            LEFT JOIN work_group_members wgm ON wgm.work_group_id = wg.id
            GROUP BY wg.id, wg.name, wg.description
            ORDER BY wg.name
        `);
        return rows as WorkGroup[];
    };

    const findUsers = async (): Promise<UserSummary[]> => {
        const { rows } = await db.query(`
            SELECT u.e_id AS id, u.name, u.email, COALESCE(r.name, 'Usuario') AS role
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            ORDER BY u.name
        `);
        return rows as UserSummary[];
    };

    const findGuests = async (): Promise<GuestSummary[]> => {
        const { rows } = await db.query(`
            SELECT id, name, email
            FROM guests
            ORDER BY name
        `);
        return rows as GuestSummary[];
    };

    const findWorkGroupMembers = async (workGroupIds: number[]): Promise<Array<{ work_group_id: number; user_id: string }>> => {
        if (workGroupIds.length === 0) return [];
        const placeholders = workGroupIds.map(() => "?").join(",");
        const { rows } = await db.query(
            `SELECT work_group_id, user_id
             FROM work_group_members
             WHERE work_group_id IN (${placeholders})`,
            workGroupIds,
        );
        return rows as Array<{ work_group_id: number; user_id: string }>;
    };

    const findReservationsByReservable = async (reservableId: number): Promise<Array<{ id: number; reservable_id: number; start_time: string; end_time: string; can_overlap: number }>> => {
        const { rows } = await db.query(
            `SELECT id, reservable_id, DATE_FORMAT(start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time,
                    DATE_FORMAT(end_time, '%Y-%m-%dT%H:%i:%sZ') AS end_time,
                    can_overlap
             FROM reservations
             WHERE reservable_id = ?
             ORDER BY start_time`,
            [reservableId],
        );
        return rows as Array<{ id: number; reservable_id: number; start_time: string; end_time: string; can_overlap: number }>;
    };

    const findReservationById = async (reservationId: number): Promise<{ id: number; reservable_id: number; start_time: string; end_time: string; can_overlap: number; description: string } | null> => {
        const { rows } = await db.query(
            `SELECT id, reservable_id, DATE_FORMAT(start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time,
                    DATE_FORMAT(end_time, '%Y-%m-%dT%H:%i:%sZ') AS end_time,
                    can_overlap, description
             FROM reservations
             WHERE id = ?
             LIMIT 1`,
            [reservationId],
        );
        return rows.length ? rows[0] : null;
    };

    const findReservationWorkGroups = async (reservationIds: number[]): Promise<Array<{ reservationId: number; id: number; name: string; description: string | null }>> => {
        if (reservationIds.length === 0) return [];
        const placeholders = reservationIds.map(() => "?").join(",");
        const { rows } = await db.query(
            `SELECT rw.reservations_id AS reservationId, wg.id, wg.name, wg.description
             FROM reservation_work_groups rw
             JOIN work_groups wg ON wg.id = rw.work_groups_id
             WHERE rw.reservations_id IN (${placeholders})`,
            reservationIds,
        );
        return rows as Array<{ reservationId: number; id: number; name: string; description: string | null }>;
    };

    const findParticipantsByReservationIds = async (reservationIds: number[]): Promise<Array<{ id: number; reservationId: number; userId: string | null; guestId: number | null; ownershipPriority: number; checkedIn: number; status: string; user_name: string | null; user_email: string | null; user_role: string | null; guest_name: string | null; guest_email: string | null }>> => {
        if (reservationIds.length === 0) return [];
        const placeholders = reservationIds.map(() => "?").join(",");
        const { rows } = await db.query(
            `SELECT rp.id, rp.reservations_id AS reservationId, rp.user_id AS userId, rp.guest_id AS guestId,
                    rp.ownership_priority AS ownershipPriority, rp.checked_in AS checkedIn, rp.status,
                    u.name AS user_name, u.email AS user_email, r.name AS user_role,
                    g.name AS guest_name, g.email AS guest_email
             FROM reservation_participants rp
             LEFT JOIN users u ON u.e_id = rp.user_id
             LEFT JOIN roles r ON r.id = u.role_id
             LEFT JOIN guests g ON g.id = rp.guest_id
             WHERE rp.reservations_id IN (${placeholders})
             ORDER BY rp.ownership_priority, rp.id`,
            reservationIds,
        );
        return rows as Array<{ id: number; reservationId: number; userId: string | null; guestId: number | null; ownershipPriority: number; checkedIn: number; status: string; user_name: string | null; user_email: string | null; user_role: string | null; guest_name: string | null; guest_email: string | null }>;
    };

    const createReservation = async (reservableId: number, startTime: string, endTime: string, canOverlap: boolean, description: string): Promise<number> => {
        const { insertId } = await db.execute(
            `INSERT INTO reservations (reservable_id, start_time, end_time, can_overlap, description)
             VALUES (?, ?, ?, ?, ?)`,
            [reservableId, toMysqlUtc(startTime), toMysqlUtc(endTime), canOverlap ? 1 : 0, description],
        );
        return insertId!;
    };

    const addReservationWorkGroups = async (reservationId: number, workGroupIds: number[]): Promise<void> => {
        if (workGroupIds.length === 0) return;
        const values = workGroupIds.map(() => `(?, ?)`).join(", ");
        const params: any[] = [];
        workGroupIds.forEach((workGroupId) => {
            params.push(reservationId, workGroupId);
        });
        await db.execute(
            `INSERT INTO reservation_work_groups (reservations_id, work_groups_id) VALUES ${values}`,
            params,
        );
    };

    const addReservationParticipant = async (reservationId: number, userId: string | null, guestId: number | null, ownershipPriority: number, status: ParticipantStatus): Promise<number> => {
        const { insertId } = await db.execute(
            `INSERT INTO reservation_participants (reservations_id, user_id, guest_id, ownership_priority, checked_in, status)
             VALUES (?, ?, ?, ?, 0, ?)`,
            [reservationId, userId, guestId, ownershipPriority, status],
        );
        return insertId!;
    };

    const findParticipantById = async (participantId: number): Promise<{ id: number; reservationId: number; userId: string | null; guestId: number | null; ownershipPriority: number; checkedIn: number; status: string; user_name: string | null; user_email: string | null; user_role: string | null; guest_name: string | null; guest_email: string | null } | null> => {
        const { rows } = await db.query(
            `SELECT rp.id, rp.reservations_id AS reservationId, rp.user_id AS userId, rp.guest_id AS guestId,
                    rp.ownership_priority AS ownershipPriority, rp.checked_in AS checkedIn, rp.status,
                    u.name AS user_name, u.email AS user_email, r.name AS user_role,
                    g.name AS guest_name, g.email AS guest_email
             FROM reservation_participants rp
             LEFT JOIN users u ON u.e_id = rp.user_id
             LEFT JOIN roles r ON r.id = u.role_id
             LEFT JOIN guests g ON g.id = rp.guest_id
             WHERE rp.id = ?
             LIMIT 1`,
            [participantId],
        );
        return rows.length ? rows[0] : null;
    };

    const updateParticipantStatus = async (participantId: number, status: ParticipantStatus): Promise<boolean> => {
        const { affectedCount } = await db.execute(
            `UPDATE reservation_participants SET status = ? WHERE id = ?`,
            [status, participantId],
        );
        return affectedCount > 0;
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

    const findReservationsByUserId = async (userId: string): Promise<number[]> => {
        const { rows } = await db.query(
            `SELECT DISTINCT rp.reservations_id
             FROM reservation_participants rp
             WHERE rp.user_id = ? AND rp.ownership_priority = 1
             ORDER BY rp.reservations_id`,
            [userId],
        );
        return rows.map((row: any) => row.reservations_id);
    };

    const findReservationsByUserIds = async (userIds: string[]): Promise<number[]> => {
        if (userIds.length === 0) return [];
        const placeholders = userIds.map(() => "?").join(",");
        const { rows } = await db.query(
            `SELECT DISTINCT rp.reservations_id
             FROM reservation_participants rp
             WHERE rp.user_id IN (${placeholders}) AND rp.ownership_priority = 1
             ORDER BY rp.reservations_id`,
            userIds,
        );
        return rows.map((row: any) => row.reservations_id);
    };

    const findMyReservationSummaries = async (userId: string): Promise<UserReservationSummary> => {
        const { rows } = await db.query(
            `SELECT
                 res.id,
                 res.reservable_id,
                 rv.name  AS reservable_name,
                 f.id     AS floor_id,
                 f.name   AS floor_name,
                 DATE_FORMAT(res.start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time,
                 DATE_FORMAT(res.end_time,   '%Y-%m-%dT%H:%i:%sZ') AS end_time,
                 rp.checked_in,
                 rp.status,
                 u.name AS user_name
             FROM reservation_participants rp
             JOIN reservations res ON res.id          = rp.reservations_id
             JOIN reservables  rv  ON rv.id           = res.reservable_id
             JOIN floors       f   ON f.id            = rv.floor_id
             JOIN users        u   ON u.e_id          = rp.user_id
             WHERE rp.user_id = ?
               AND rp.ownership_priority = 0
             ORDER BY res.start_time`,
            [userId],
        );

        return {
            user_id: userId,
            user_name: rows[0]?.user_name ?? "",
            reservations: rows.map((r: any) => ({
                id: r.id,
                reservable_id: r.reservable_id,
                reservable_name: r.reservable_name,
                floor_id: r.floor_id,
                floor_name: r.floor_name,
                start_time: r.start_time,
                end_time: r.end_time,
                checked_in: Boolean(r.checked_in),
                status: r.status,
            })),
        };
    };

    const findFriendsReservationSummaries = async (userIds: string[]): Promise<FriendReservationsSummary> => {
        if (userIds.length === 0) return [];
        const placeholders = userIds.map(() => "?").join(",");

        const { rows } = await db.query(
            `SELECT
                 rp.user_id,
                 u.name   AS user_name,
                 res.id,
                 res.reservable_id,
                 rv.name  AS reservable_name,
                 f.id     AS floor_id,
                 f.name   AS floor_name,
                 DATE_FORMAT(res.start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time,
                 DATE_FORMAT(res.end_time,   '%Y-%m-%dT%H:%i:%sZ') AS end_time,
                 rp.checked_in,
                 rp.status
             FROM reservation_participants rp
             JOIN reservations res ON res.id  = rp.reservations_id
             JOIN reservables  rv  ON rv.id   = res.reservable_id
             JOIN floors       f   ON f.id    = rv.floor_id
             JOIN users        u   ON u.e_id  = rp.user_id
             WHERE rp.user_id IN (${placeholders})
               AND rp.ownership_priority = 0
             ORDER BY rp.user_id, res.start_time`,
            userIds,
        );

        const map = new Map<string, UserReservationSummary>();
        for (const r of rows as any[]) {
            if (!map.has(r.user_id)) {
                map.set(r.user_id, { user_id: r.user_id, user_name: r.user_name, reservations: [] });
            }
            map.get(r.user_id)!.reservations.push({
                id: r.id,
                reservable_id: r.reservable_id,
                reservable_name: r.reservable_name,
                floor_id: r.floor_id,
                floor_name: r.floor_name,
                start_time: r.start_time,
                end_time: r.end_time,
                checked_in: Boolean(r.checked_in),
                status: r.status,
            });
        }
        return Array.from(map.values());
    };

    // ─── Events ─────────────────────────────────────────────────────────────────

    /**
     * Returns all overlapping reservations where can_overlap = 0 for a given
     * reservable and time window. Intended to be called inside a transaction.
     */
    const findOverlappingReservations = async (
        reservableId: number,
        startTime: string,
        endTime: string,
    ): Promise<Array<{ id: number }>> => {
        const { rows } = await db.query(
            `SELECT id
             FROM reservations
             WHERE reservable_id = ?
               AND can_overlap = 0
               AND start_time < ?
               AND end_time   > ?`,
            [reservableId, toMysqlUtc(endTime), toMysqlUtc(startTime)],
        );
        return rows as Array<{ id: number }>;
    };

    /**
     * Returns all events that overlap with the given time window for a
     * reservable. Intended to be called inside a transaction.
     */
    const findOverlappingEvents = async (
        reservableId: number,
        startTime: string,
        endTime: string,
    ): Promise<Array<{ id: number }>> => {
        const { rows } = await db.query(
            `SELECT id
             FROM events
             WHERE reservable_id = ?
               AND start_time < ?
               AND end_time   > ?`,
            [reservableId, toMysqlUtc(endTime), toMysqlUtc(startTime)],
        );
        return rows as Array<{ id: number }>;
    };

    const findEvents = async (query: GetEventsQuery): Promise<Event[]> => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (query.reservable_id !== undefined) {
            conditions.push("e.reservable_id = ?");
            params.push(query.reservable_id);
        }
        if (query.floor_id !== undefined) {
            conditions.push("rv.floor_id = ?");
            params.push(query.floor_id);
        }
        if (query.start_time !== undefined) {
            conditions.push("e.end_time > ?");
            params.push(toMysqlUtc(query.start_time));
        }
        if (query.end_time !== undefined) {
            conditions.push("e.start_time < ?");
            params.push(toMysqlUtc(query.end_time));
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const { rows } = await db.query(
            `SELECT
                 e.id,
                 e.title,
                 e.description,
                 DATE_FORMAT(e.start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time,
                 DATE_FORMAT(e.end_time,   '%Y-%m-%dT%H:%i:%sZ') AS end_time,
                 rv.id          AS reservable_id,
                 rv.name        AS reservable_name,
                 rv.capacity    AS reservable_capacity,
                 rv.floor_id    AS reservable_floor_id,
                 f.name         AS floor_name,
                 f.floor_number AS floor_number
             FROM events e
             LEFT JOIN reservables rv ON rv.id = e.reservable_id
             LEFT JOIN floors      f  ON f.id  = rv.floor_id
             ${where}
             ORDER BY e.start_time`,
            params,
        );

        return rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            start_time: r.start_time,
            end_time: r.end_time,
            reservable: r.reservable_id != null ? {
                id: r.reservable_id,
                name: r.reservable_name,
                capacity: r.reservable_capacity,
                floor_id: r.reservable_floor_id,
                floor_name: r.floor_name,
                floor_number: r.floor_number,
            } : null,
        })) as Event[];
    };

    const createEvent = async (data: CreateEventBody): Promise<number> => {
        const { insertId } = await db.execute(
            `INSERT INTO events (title, description, reservable_id, start_time, end_time)
             VALUES (?, ?, ?, ?, ?)`,
            [data.title, data.description, data.reservable_id ?? null, toMysqlUtc(data.start_time), toMysqlUtc(data.end_time)],
        );
        return insertId!;
    };

    const findEventById = async (id: number): Promise<Event | null> => {
        const { rows } = await db.query(
            `SELECT
                 e.id,
                 e.title,
                 e.description,
                 DATE_FORMAT(e.start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time,
                 DATE_FORMAT(e.end_time,   '%Y-%m-%dT%H:%i:%sZ') AS end_time,
                 rv.id          AS reservable_id,
                 rv.name        AS reservable_name,
                 rv.capacity    AS reservable_capacity,
                 rv.floor_id    AS reservable_floor_id,
                 f.name         AS floor_name,
                 f.floor_number AS floor_number
             FROM events e
             LEFT JOIN reservables rv ON rv.id = e.reservable_id
             LEFT JOIN floors      f  ON f.id  = rv.floor_id
             WHERE e.id = ?
             LIMIT 1`,
            [id],
        );
        if (!rows.length) return null;
        const r = rows[0];
        return {
            id: r.id,
            title: r.title,
            description: r.description,
            start_time: r.start_time,
            end_time: r.end_time,
            reservable: r.reservable_id != null ? {
                id: r.reservable_id,
                name: r.reservable_name,
                capacity: r.reservable_capacity,
                floor_id: r.reservable_floor_id,
                floor_name: r.floor_name,
                floor_number: r.floor_number,
            } : null,
        };
    };

    return {
        findAll,
        findById,
        findAvailable,
        findFriendOccupancy,
        findWorkGroups,
        findUsers,
        findGuests,
        findWorkGroupMembers,
        create,
        update,
        remove,
        setBlocked,
        floorExists,
        findReservationsByReservable,
        findReservationById,
        findReservationWorkGroups,
        findParticipantsByReservationIds,
        createReservation,
        addReservationWorkGroups,
        addReservationParticipant,
        findParticipantById,
        updateParticipantStatus,
        findReservationsByUserId,
        findReservationsByUserIds,
        findMyReservationSummaries,
        findFriendsReservationSummaries,
        findOverlappingReservations,
        findOverlappingEvents,
        findEvents,
        createEvent,
        findEventById,
    };
}
