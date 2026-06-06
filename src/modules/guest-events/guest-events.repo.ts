import { Db } from '../../infra/db/db.js';
import { Cursor } from '../../shared/utils/cursor.utils.js';
import {
    Event,
    EventDetail,
    EventWithCreator,
    EventsCursor,
    EventsCursorSchema,
    EventsPage,
    ListEventsQuery,
    PatchEvent,
} from './guest-events.schema.js';

export type EventsRepo = {
    listEvents: (query: ListEventsQuery) => Promise<EventsPage>;
    getEventById: (id: number) => Promise<EventDetail | null>;
    createEvent: (
        title: string,
        description: string,
        details_text: string | null,
        start_time: Date,
        end_time: Date,
        created_by: string,
    ) => Promise<Event>;
    addParticipants: (event_id: number, guest_ids: number[]) => Promise<void>;
    removeParticipants: (event_id: number, guest_ids: number[]) => Promise<void>;
    patchEvent: (id: number, data: Omit<PatchEvent, 'add_guest_ids' | 'remove_guest_ids'>) => Promise<Event | null>;
    cancelEvent: (id: number) => Promise<boolean>;
    getParticipantGuestIds: (event_id: number) => Promise<number[]>;
};

export function makeEventsRepo(db: Db): EventsRepo {

    const listEvents = async (query: ListEventsQuery): Promise<EventsPage> => {
        const { limit, from, to, query: q, cursor } = query;
        const params: any[] = [];
        const whereClauses: string[] = [];

        const decoded: EventsCursor | null = cursor
            ? Cursor.decode(cursor, EventsCursorSchema)
            : null;

        if (decoded) {
            whereClauses.push(`(e.start_time > ? OR (e.start_time = ? AND e.id > ?))`);
            params.push(decoded.last_start_time, decoded.last_start_time, decoded.last_id);
        }

        if (from) {
            whereClauses.push(`e.start_time >= ?`);
            params.push(from);
        }
        if (to) {
            whereClauses.push(`e.start_time <= ?`);
            params.push(to);
        }
        if (q) {
            whereClauses.push(`(
                e.title LIKE CONCAT('%', ?, '%') OR
                e.description LIKE CONCAT('%', ?, '%') OR
                EXISTS (
                    SELECT 1 FROM event_guest_participants egp
                    JOIN guests g ON g.id = egp.guest_id
                    WHERE egp.event_id = e.id AND (
                        g.name LIKE CONCAT('%', ?, '%') OR
                        g.email LIKE CONCAT('%', ?, '%')
                    )
                )
            )`);
            params.push(q, q, q, q);
        }

        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        params.push(limit + 1);

        const { rows } = await db.query(
            `SELECT
                e.*,
                u.name AS creator_name,
                u.title AS creator_title
             FROM events e
             JOIN users u ON u.e_id = e.created_by
             ${whereSQL}
             ORDER BY e.start_time ASC, e.id ASC
             LIMIT ?`,
            params,
        );

        const hasNext = rows.length > limit;
        const items = (hasNext ? rows.slice(0, limit) : rows) as EventWithCreator[];

        let nextCursor: string | null = null;
        if (hasNext) {
            const last = items[items.length - 1];
            nextCursor = Cursor.encode<EventsCursor>({
                last_id: last.id,
                last_start_time: last.start_time instanceof Date
                    ? last.start_time.toISOString()
                    : String(last.start_time),
            });
        }

        return { items, nextCursor, hasNext };
    };

    const getEventById = async (id: number): Promise<EventDetail | null> => {
        const { rows: eventRows } = await db.query(
            `SELECT e.*, u.name AS creator_name, u.title AS creator_title
             FROM events e
             JOIN users u ON u.e_id = e.created_by
             WHERE e.id = ?`,
            [id],
        );
        if (!eventRows.length) return null;

        const event = eventRows[0] as EventWithCreator;

        const { rows: guestRows } = await db.query(
            `SELECT g.id, g.name, g.email
             FROM event_guest_participants egp
             JOIN guests g ON g.id = egp.guest_id
             WHERE egp.event_id = ?`,
            [id],
        );

        return { ...event, participants: guestRows as { id: number; name: string; email: string }[] };
    };

    const createEvent = async (
        title: string,
        description: string,
        details_text: string | null,
        start_time: Date,
        end_time: Date,
        created_by: string,
    ): Promise<Event> => {
        const { insertId } = await db.execute(
            `INSERT INTO events (title, description, details_text, start_time, end_time, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, description, details_text ?? null, start_time, end_time, created_by],
        );

        const { rows } = await db.query(`SELECT * FROM events WHERE id = ?`, [insertId]);
        return rows[0] as Event;
    };

    const addParticipants = async (event_id: number, guest_ids: number[]): Promise<void> => {
        if (!guest_ids.length) return;
        const placeholders = guest_ids.map(() => `(?, ?)`).join(', ');
        const params: any[] = guest_ids.flatMap(gid => [event_id, gid]);
        await db.execute(
            `INSERT IGNORE INTO event_guest_participants (event_id, guest_id) VALUES ${placeholders}`,
            params,
        );
    };

    const removeParticipants = async (event_id: number, guest_ids: number[]): Promise<void> => {
        if (!guest_ids.length) return;
        const placeholders = guest_ids.map(() => `?`).join(', ');
        await db.execute(
            `DELETE FROM event_guest_participants WHERE event_id = ? AND guest_id IN (${placeholders})`,
            [event_id, ...guest_ids],
        );
    };

    const patchEvent = async (
        id: number,
        data: Omit<PatchEvent, 'add_guest_ids' | 'remove_guest_ids'>,
    ): Promise<Event | null> => {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (data.title !== undefined) { setClauses.push('title = ?'); params.push(data.title); }
        if (data.description !== undefined) { setClauses.push('description = ?'); params.push(data.description); }
        if (data.details_text !== undefined) { setClauses.push('details_text = ?'); params.push(data.details_text); }
        if (data.start_time !== undefined) { setClauses.push('start_time = ?'); params.push(new Date(data.start_time)); }
        if (data.end_time !== undefined) { setClauses.push('end_time = ?'); params.push(new Date(data.end_time)); }

        if (!setClauses.length) {
            const { rows } = await db.query(`SELECT * FROM events WHERE id = ?`, [id]);
            return rows[0] as Event ?? null;
        }

        params.push(id);
        await db.execute(
            `UPDATE events SET ${setClauses.join(', ')} WHERE id = ? AND lifecycle_status = 'ACTIVE'`,
            params,
        );

        const { rows } = await db.query(`SELECT * FROM events WHERE id = ?`, [id]);
        return rows[0] as Event ?? null;
    };

    const cancelEvent = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(
            `UPDATE events
             SET lifecycle_status = 'CANCELLED', canceled_at = NOW()
             WHERE id = ? AND lifecycle_status = 'ACTIVE'`,
            [id],
        );
        return affectedCount > 0;
    };

    const getParticipantGuestIds = async (event_id: number): Promise<number[]> => {
        const { rows } = await db.query(
            `SELECT guest_id FROM event_guest_participants WHERE event_id = ?`,
            [event_id],
        );
        return rows.map((r: any) => r.guest_id as number);
    };

    return {
        listEvents,
        getEventById,
        createEvent,
        addParticipants,
        removeParticipants,
        patchEvent,
        cancelEvent,
        getParticipantGuestIds,
    };
}
