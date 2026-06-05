import { Db } from '../../infra/db/db.js';
import { Cursor } from '../../shared/utils/cursor.utils.js';
import {
    Reservable,
    Reservation,
    Participant,
    ReservationWithParticipants,
    ReservationAttendanceStatus,
    ParticipantAttendanceStatus,
    ListReservationsQuery,
    ListReservationsPage,
    ListReservationsCursorSchema,
    inferReservationLifecycle,
    AvailableReservablesQuery,
    CreateReservable,
} from './office-slots.schema.js';

type ReservationRow = Omit<Reservation, 'lifecycle_status' | 'reservable' | 'participants'>;
type ParticipantRow = Participant;

function hydrateReservation(row: ReservationRow): Reservation {
    return {
        ...row,
        lifecycle_status: inferReservationLifecycle(row.attendance_status),
    };
}

export type OfficeSlotsRepo = {
    // Reservables
    getAllReservables: () => Promise<Reservable[]>;
    getAvailableReservables: (query: AvailableReservablesQuery) => Promise<Reservable[]>;
    getReservableById: (id: number, detail?: boolean) => Promise<Reservable | null>;
    createReservable: (data: CreateReservable) => Promise<Reservable | null>;
    updateReservable: (
        id: number,
        fields: Partial<Omit<Reservable, 'id'>>,
    ) => Promise<Reservable | null>;
    deleteReservable: (id: number) => Promise<boolean>;

    // Reservations
    getReservationById: (id: number) => Promise<Reservation | null>;
    getReservationWithParticipants: (id: number) => Promise<ReservationWithParticipants | null>;
    listReservations: (
        query: ListReservationsQuery,
        callerEId: string,
        friendIds: string[],
    ) => Promise<ListReservationsPage>;
    getReservationsByUser: (userId: string) => Promise<ReservationWithParticipants[]>;

    createReservationBatch: (
        creatorId: string,
        reservableId: number,
        category: string,
        description: string,
        timestamps: Array<{ start_time: Date; end_time: Date }>,
        participantIds: string[], // user_ids a invitar (sin el creador)
    ) => Promise<ReservationWithParticipants[]>;
    cancelReservation: (id: number) => Promise<Reservation | null>;
    updateReservationAttendance: (
        id: number,
        status: ReservationAttendanceStatus,
    ) => Promise<Reservation | null>;

    // Participants
    getParticipantById: (participantId: number) => Promise<Participant | null>;
    getParticipantByReservationAndUser: (
        reservationId: number,
        userId: string,
    ) => Promise<Participant | null>;
    getParticipantsByReservation: (reservationId: number) => Promise<Participant[]>;

    updateParticipantAttendance: (
        participantId: number,
        status: ParticipantAttendanceStatus,
    ) => Promise<Participant | null>;

    // Queue helpers
    markNoShowForReservation: (
        reservationId: number,
    ) => Promise<
        | { marked: true; reservation: Reservation; participants: Participant[] }
        | { marked: false; reason: string }
    >;
    markCheckoutForReservation: (reservationId: number) => Promise<
        | {
              action: 'checked_out' | 'no_show_fallback';
              reservation: Reservation;
              participants: Participant[];
          }
        | { action: 'skipped'; reason: string }
    >;
    getPendingNoShowReservations: (
        checkinToleranceMinutes: number,
    ) => Promise<Array<Pick<Reservation, 'id' | 'start_time'>>>;
    getPendingCheckoutReservations: () => Promise<Array<Pick<Reservation, 'id' | 'end_time'>>>;
};

export function makeOfficeSlotsRepo(db: Db): OfficeSlotsRepo {
    // Reservables

    const getAllReservables = async (): Promise<Reservable[]> => {
        const { rows } = await db.query(
            `
        SELECT
            r.id,
            r.name,
            r.code,
            r.capacity,
            f.name AS floor,
            r.is_blocked,

            CASE
                WHEN r.is_blocked = 1 THEN 'blocked'

                WHEN EXISTS (
                    SELECT 1
                    FROM reservations res
                    WHERE res.reservable_id = r.id
                      AND res.category = 'RESERVATION'
                      AND res.start_time < UTC_TIMESTAMP()
                      AND res.end_time > UTC_TIMESTAMP()
                ) THEN 'occupied'

                WHEN EXISTS (
                    SELECT 1
                    FROM reservations res
                    WHERE res.reservable_id = r.id
                      AND res.category = 'RESERVATION'
                      AND res.start_time > UTC_TIMESTAMP()
                      AND res.start_time <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE)
                ) THEN 'soon'

                ELSE 'available'
            END AS status

        FROM reservables r
        JOIN floors f ON f.id = r.floor_id
        ORDER BY r.id ASC
        `,
            [],
        );

        return rows.map((r) => ({
            ...r,
            is_blocked: Boolean(r.is_blocked),
        })) as Reservable[];
    };  

    async function getAvailableReservables(
        filters: AvailableReservablesQuery,
    ): Promise<Reservable[]> {
        const where: string[] = ['1 = 1'];
        const params: unknown[] = [];

        if (filters.floorId !== undefined) {
            where.push('r.floor_id = ?');
            params.push(filters.floorId);
        }

        if (filters.minCapacity !== undefined) {
            where.push('r.capacity >= ?');
            params.push(filters.minCapacity);
        }

        if (filters.maxCapacity !== undefined) {
            where.push('r.capacity <= ?');
            params.push(filters.maxCapacity);
        }

        if (filters.query?.trim()) {
            where.push('(r.name LIKE ? OR r.code LIKE ?)');
            params.push(`%${filters.query.trim()}%`, `%${filters.query.trim()}%`);
        }

        /**
         * Disponibilidad por horario:
         * Si viene startTime/endTime, excluimos reservables que tengan
         * reservaciones empalmadas en ese rango.
         */
        if (filters.startTime && filters.endTime) {
            if (filters.daysToApply && filters.daysToApply.length > 0) {
                const dayConditions: string[] = [];

                for (const day of filters.daysToApply) {
                    dayConditions.push(`
                    EXISTS (
                        SELECT 1
                        FROM reservations res
                        WHERE res.reservable_id = r.id
                        AND res.category = 'RESERVATION'
                        AND res.start_time < TIMESTAMP(DATE(?), TIME(?))
                        AND res.end_time > TIMESTAMP(DATE(?), TIME(?))
                    )
                    `);

                    params.push(day, filters.endTime, day, filters.startTime);
                }

                where.push(`NOT (${dayConditions.join(' OR ')})`);
            } else {
                where.push(`
                    NOT EXISTS (
                    SELECT 1
                    FROM reservations res
                    WHERE res.reservable_id = r.id
                        AND res.category = 'RESERVATION'
                        AND res.start_time < ?
                        AND res.end_time > ?
                    )
                `);

                params.push(filters.endTime, filters.startTime);
            }
        }

        const sql = `
            SELECT
            r.id,
            r.name,
            r.code,
            r.capacity,
            f.name AS floor,
            r.is_blocked,

            CASE
                WHEN r.is_blocked = 1 THEN 'blocked'

                WHEN EXISTS (
                SELECT 1
                FROM reservations res
                WHERE res.reservable_id = r.id
                    AND res.category = 'RESERVATION'
                    AND res.start_time < UTC_TIMESTAMP()
                    AND res.end_time > UTC_TIMESTAMP()
                ) THEN 'occupied'

                WHEN EXISTS (
                SELECT 1
                FROM reservations res
                WHERE res.reservable_id = r.id
                    AND res.category = 'RESERVATION'
                    AND res.start_time > UTC_TIMESTAMP()
                    AND res.start_time <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE)
                ) THEN 'soon'

                ELSE 'available'
            END AS status

            FROM reservables r
            JOIN floors f ON f.id = r.floor_id
            WHERE ${where.join(' AND ')}
            ORDER BY r.name ASC
        `;
        const { rows } = await db.query(sql, params);

        return rows;
    }

    const getReservableById = async (id: number, detail = false): Promise<Reservable | null> => {
        const { rows } = await db.query(
            `SELECT id, name, capacity, floor_id, is_blocked FROM reservables WHERE id = ?`,
            [id],
        );
        if (!rows.length) return null;
        const r = rows[0];
        return { ...r, is_blocked: Boolean(r.is_blocked) } as Reservable;
    };

    const createReservable = async (data: CreateReservable): Promise<Reservable | null> => {
        const { insertId } = await db.execute(
            `INSERT INTO reservables (name, capacity, floor_id, is_blocked) VALUES (?, ?, ?, ?)`,
            [data.name, data.capacity, data.floor_id, data.is_blocked ? 1 : 0],
        );
        if (!insertId) return null;
        return getReservableById(insertId);
    };

    const updateReservable = async (
        id: number,
        fields: Partial<Omit<Reservable, 'id'>>,
    ): Promise<Reservable | null> => {
        const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
        if (!entries.length) return getReservableById(id);

        const setClauses = entries.map(([col]) => `${col} = ?`).join(', ');
        const values = entries.map(([, v]) => v);

        const { affectedCount } = await db.execute(
            `UPDATE reservables SET ${setClauses} WHERE id = ?`,
            [...values, id],
        );
        if (affectedCount === 0) return null;
        return getReservableById(id);
    };

    const deleteReservable = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(`DELETE FROM reservables WHERE id = ?`, [id]);
        return affectedCount > 0;
    };

    // Reservations

    const RESERVATION_FIELDS = `
        r.id, r.reservable_id, r.category, r.start_time, r.end_time,
        r.description, r.attendance_status, r.created_at, r.updated_at
    `;

    const getReservationById = async (id: number): Promise<Reservation | null> => {
        const { rows } = await db.query(
            `SELECT ${RESERVATION_FIELDS} FROM reservations r WHERE r.id = ?`,
            [id],
        );
        if (!rows.length) return null;
        return hydrateReservation(rows[0] as ReservationRow);
    };

    const getParticipantsByReservation = async (reservationId: number): Promise<Participant[]> => {
        const { rows } = await db.query(
            `SELECT id, reservations_id, user_id, ownership_priority, attendance_status,
                    created_at, updated_at
             FROM reservation_participants
             WHERE reservations_id = ?
             ORDER BY ownership_priority ASC, id ASC`,
            [reservationId],
        );
        return rows as Participant[];
    };

    const getReservationWithParticipants = async (
        id: number,
    ): Promise<ReservationWithParticipants | null> => {
        const reservation = await getReservationById(id);
        if (!reservation) return null;

        const reservable = await getReservableById(reservation.reservable_id);
        if (!reservable) return null;

        const participants = await getParticipantsByReservation(id);

        return {
            ...reservation,
            reservable,
            participants,
        };
    };

    const listReservations = async (
        query: ListReservationsQuery,
        callerEId: string,
        friendIds: string[],
    ): Promise<ListReservationsPage> => {
        const conditions: string[] = [];
        const params: any[] = [];
        const decodedCursor = query.cursor
            ? Cursor.decode(query.cursor, ListReservationsCursorSchema)
            : null;

        if (query.reservable_id) {
            conditions.push('r.reservable_id = ?');
            params.push(query.reservable_id);
        }
        if (query.start_time) {
            conditions.push('r.end_time > ?');
            params.push(query.start_time);
        }
        if (query.end_time) {
            conditions.push('r.start_time < ?');
            params.push(query.end_time);
        }
        if (query.attendance_status) {
            conditions.push('r.attendance_status = ?');
            params.push(query.attendance_status);
        }
        if (query.user_id) {
            conditions.push(
                'EXISTS (SELECT 1 FROM reservation_participants rp WHERE rp.reservations_id = r.id AND rp.user_id = ?)',
            );
            params.push(query.user_id);
        }
        if (decodedCursor) {
            conditions.push('r.id > ?');
            params.push(decodedCursor.lastId);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const hasLimit = query.limit !== undefined;
        const limit = query.limit ?? 50;

        const { rows } = await db.query(
            `SELECT ${RESERVATION_FIELDS}
             FROM reservations r
             ${where}
             ORDER BY r.id ASC
             LIMIT ?`,
            [...params, limit + 1],
        );

        const reservations = (rows as ReservationRow[]).map(hydrateReservation);
        const hasMore = reservations.length > limit;
        const pageItems = hasMore ? reservations.slice(0, limit) : reservations;

        const allFriendSet = new Set([callerEId, ...friendIds]);
        const items: ReservationWithParticipants[] = await Promise.all(
            pageItems.map(async (res) => {
                const reservable = (await getReservableById(res.reservable_id))!;
                const rawParticipants = await getParticipantsByReservation(res.id);
                const participants = rawParticipants.map((p) =>
                    allFriendSet.has(p.user_id)
                        ? p
                        : {
                              ...p,
                              user_id: null,
                              attendance_status: null,
                              ownership_priority: null,
                          },
                );
                return { ...res, reservable, participants };
            }),
        );

        const nextCursor =
            hasMore && items.length > 0
                ? Cursor.encode({ lastId: items[items.length - 1].id })
                : null;

        return { items, nextCursor };
    };

    const getReservationsByUser = async (
        userId: string,
    ): Promise<ReservationWithParticipants[]> => {
        const { rows } = await db.query(
            `SELECT ${RESERVATION_FIELDS}
             FROM reservations r
             INNER JOIN reservation_participants rp ON rp.reservations_id = r.id
             WHERE rp.user_id = ?
             ORDER BY r.start_time DESC`,
            [userId],
        );
        const reservations = (rows as ReservationRow[]).map(hydrateReservation);

        return Promise.all(
            reservations.map(async (res) => {
                const reservable = (await getReservableById(res.reservable_id))!;
                const participants = await getParticipantsByReservation(res.id);
                return { ...res, reservable, participants };
            }),
        );
    };

    const createReservationBatch = async (
        creatorId: string,
        reservableId: number,
        category: string,
        description: string,
        timestamps: Array<{ start_time: Date; end_time: Date }>,
        participantIds: string[],
    ): Promise<ReservationWithParticipants[]> => {
        const created: ReservationWithParticipants[] = [];

        for (const ts of timestamps) {
            const { insertId: reservationId } = await db.execute(
                `INSERT INTO reservations (reservable_id, category, start_time, end_time, description, attendance_status)
                 VALUES (?, ?, ?, ?, ?, 'NOT_ARRIVED')`,
                [reservableId, category, ts.start_time, ts.end_time, description],
            );
            if (!reservationId) continue;

            // El creador recibe priority 0 solo si está en la lista de participantes.
            // Si no está, se inserta con prioridades incrementales sin reservar el 0.
            const creatorIsParticipant = participantIds.includes(creatorId);
            let priority = creatorIsParticipant ? 1 : 0;

            const allParticipants: Array<{ userId: string; priority: number; status: string }> = [];

            if (creatorIsParticipant) {
                allParticipants.push({ userId: creatorId, priority: 0, status: 'NOT_ARRIVED' });
            }

            for (const pid of participantIds) {
                if (pid === creatorId) continue; // ya fue agregado arriba con priority 0
                allParticipants.push({ userId: pid, priority, status: 'INVITED' });
                priority++;
            }

            for (const p of allParticipants) {
                await db.execute(
                    `INSERT INTO reservation_participants
                    (reservations_id, user_id, ownership_priority, attendance_status)
                 VALUES (?, ?, ?, ?)`,
                    [reservationId, p.userId, p.priority, p.status],
                );
            }

            const full = await getReservationWithParticipants(reservationId);
            if (full) created.push(full);
        }

        return created;
    };

    const cancelReservation = async (id: number): Promise<Reservation | null> => {
        const { affectedCount } = await db.execute(
            `UPDATE reservations SET attendance_status = 'CANCELED' WHERE id = ?`,
            [id],
        );
        if (affectedCount === 0) return null;
        return getReservationById(id);
    };

    const updateReservationAttendance = async (
        id: number,
        status: ReservationAttendanceStatus,
    ): Promise<Reservation | null> => {
        const { affectedCount } = await db.execute(
            `UPDATE reservations SET attendance_status = ? WHERE id = ?`,
            [status, id],
        );
        if (affectedCount === 0) return null;
        return getReservationById(id);
    };

    // Participants

    const getParticipantById = async (participantId: number): Promise<Participant | null> => {
        const { rows } = await db.query(
            `SELECT id, reservations_id, user_id, ownership_priority, attendance_status,
                    created_at, updated_at
             FROM reservation_participants WHERE id = ?`,
            [participantId],
        );
        return rows.length ? (rows[0] as Participant) : null;
    };

    const getParticipantByReservationAndUser = async (
        reservationId: number,
        userId: string,
    ): Promise<Participant | null> => {
        const { rows } = await db.query(
            `SELECT id, reservations_id, user_id, ownership_priority, attendance_status,
                    created_at, updated_at
             FROM reservation_participants
             WHERE reservations_id = ? AND user_id = ?`,
            [reservationId, userId],
        );
        return rows.length ? (rows[0] as Participant) : null;
    };

    const updateParticipantAttendance = async (
        participantId: number,
        status: ParticipantAttendanceStatus,
    ): Promise<Participant | null> => {
        const { affectedCount } = await db.execute(
            `UPDATE reservation_participants SET attendance_status = ? WHERE id = ?`,
            [status, participantId],
        );
        if (affectedCount === 0) return null;
        return getParticipantById(participantId);
    };

    // Queue

    const markNoShowForReservation = async (
        reservationId: number,
    ): Promise<
        | { marked: true; reservation: Reservation; participants: Participant[] }
        | { marked: false; reason: string }
    > => {
        const { affectedCount } = await db.execute(
            `UPDATE reservations
             SET attendance_status = 'NO_SHOW'
             WHERE id = ? AND attendance_status = 'NOT_ARRIVED'`,
            [reservationId],
        );

        if (affectedCount === 0) {
            const existing = await getReservationById(reservationId);
            if (!existing) return { marked: false, reason: 'Reservación no encontrada' };
            return { marked: false, reason: `Estado actual: ${existing.attendance_status}` };
        }

        await db.execute(
            `UPDATE reservation_participants
             SET attendance_status = 'NOT_ACCEPTED'
             WHERE reservations_id = ? AND attendance_status = 'INVITED'`,
            [reservationId],
        );
        await db.execute(
            `UPDATE reservation_participants
             SET attendance_status = 'NO_SHOW'
             WHERE reservations_id = ? AND attendance_status = 'NOT_ARRIVED'`,
            [reservationId],
        );

        const reservation = await getReservationById(reservationId);
        if (!reservation) return { marked: false, reason: 'No se pudo releer la reservación' };

        const participants = await getParticipantsByReservation(reservationId);
        return { marked: true, reservation, participants };
    };

    const markCheckoutForReservation = async (
        reservationId: number,
    ): Promise<
        | {
              action: 'checked_out' | 'no_show_fallback';
              reservation: Reservation;
              participants: Participant[];
          }
        | { action: 'skipped'; reason: string }
    > => {
        const checkoutResult = await db.execute(
            `UPDATE reservations
             SET attendance_status = 'CHECKED_OUT',
                 updated_at        = end_time
             WHERE id = ? AND attendance_status = 'CHECKED_IN'`,
            [reservationId],
        );

        if (checkoutResult.affectedCount > 0) {
            await db.execute(
                `UPDATE reservation_participants
                 SET attendance_status = 'CHECKED_OUT'
                 WHERE reservations_id = ? AND attendance_status = 'CHECKED_IN'`,
                [reservationId],
            );
            await db.execute(
                `UPDATE reservation_participants
                 SET attendance_status = 'NO_SHOW'
                 WHERE reservations_id = ? AND attendance_status = 'NOT_ARRIVED'`,
                [reservationId],
            );
            await db.execute(
                `UPDATE reservation_participants
                 SET attendance_status = 'NOT_ACCEPTED'
                 WHERE reservations_id = ? AND attendance_status = 'INVITED'`,
                [reservationId],
            );

            const reservation = await getReservationById(reservationId);
            if (!reservation)
                return { action: 'skipped', reason: 'No se pudo releer tras checkout' };

            const participants = await getParticipantsByReservation(reservationId);
            return { action: 'checked_out', reservation, participants };
        }

        const noShowResult = await db.execute(
            `UPDATE reservations
             SET attendance_status = 'NO_SHOW',
                 updated_at        = end_time
             WHERE id = ? AND attendance_status = 'NOT_ARRIVED'`,
            [reservationId],
        );

        if (noShowResult.affectedCount > 0) {
            await db.execute(
                `UPDATE reservation_participants
                 SET attendance_status = 'NOT_ACCEPTED'
                 WHERE reservations_id = ? AND attendance_status = 'INVITED'`,
                [reservationId],
            );
            await db.execute(
                `UPDATE reservation_participants
                 SET attendance_status = 'NO_SHOW'
                 WHERE reservations_id = ? AND attendance_status = 'NOT_ARRIVED'`,
                [reservationId],
            );

            const reservation = await getReservationById(reservationId);
            if (!reservation)
                return { action: 'skipped', reason: 'No se pudo releer tras no-show fallback' };

            const participants = await getParticipantsByReservation(reservationId);
            return { action: 'no_show_fallback', reservation, participants };
        }

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
    ): Promise<Array<Pick<Reservation, 'id' | 'start_time'>>> => {
        const { rows } = await db.query(
            `SELECT id, start_time
             FROM reservations
             WHERE attendance_status = 'NOT_ARRIVED'
               AND DATE_ADD(start_time, INTERVAL ? MINUTE) > NOW()`,
            [checkinToleranceMinutes],
        );
        return rows as Array<Pick<Reservation, 'id' | 'start_time'>>;
    };

    const getPendingCheckoutReservations = async (): Promise<
        Array<Pick<Reservation, 'id' | 'end_time'>>
    > => {
        const { rows } = await db.query(
            `SELECT id, end_time
             FROM reservations
             WHERE attendance_status = 'CHECKED_IN'
               AND end_time > NOW()`,
            [],
        );
        return rows as Array<Pick<Reservation, 'id' | 'end_time'>>;
    };

    return {
        getAllReservables,
        getAvailableReservables,
        getReservableById,
        createReservable,
        updateReservable,
        deleteReservable,

        getReservationById,
        getReservationWithParticipants,
        listReservations,
        getReservationsByUser,

        createReservationBatch,
        cancelReservation,
        updateReservationAttendance,

        getParticipantById,
        getParticipantByReservationAndUser,
        getParticipantsByReservation,
        updateParticipantAttendance,

        markNoShowForReservation,
        markCheckoutForReservation,
        getPendingNoShowReservations,
        getPendingCheckoutReservations,
    };
}
