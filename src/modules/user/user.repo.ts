import { Db } from "../../infra/db/db.js";
import { Cursor } from "../../shared/utils/cursor.utils.js";
import { User, Guest, ListUsersQuery, ListUsersPage, ListUsersCursor, ListUsersCursorSchema } from "./user.schema.js";
import { ConflictError, UnprocessableError } from "../../shared/errors/AppError.js";

export type UserRepo = {
    getAllGuests: () => Promise<Guest[]>;
    getGuestById: (guestId: number) => Promise<Guest | null>;
    createGuest: (name: string, email: string, invitedByEId: string) => Promise<Guest>;
    updateGuest: (guestId: number, name?: string, email?: string) => Promise<Guest | null>;
    removeGuest: (guestId: number) => Promise<boolean>;

    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;
    getByIds(eIds: string[]): Promise<User[]>;
    getGuestsByIds(guestIds: number[]): Promise<Guest[]>;

    // Cristian. Adding getUsers that filters from a query 
    getPotentialFriends: (query?:string, userId?:string) => Promise<User[]>;
    getUsers: (query?: string, excludeId?: string) => Promise<User[]>;
    listUsers: (query: ListUsersQuery) => Promise<ListUsersPage>;

    getAllByName: (name: string) => Promise<User[]>;
    TEMPORARY_CREATE: (eId: string, name: string, email: string, hashedPassword: string, roleId: number) => Promise<User>;
}

function uniqueIds(ids: string[]): string[] {
    return [...new Set(ids)];
}

type UserSearchRow = {
    eId: string;
    name: string;
    email: string;
    roleName: string;
    searchScore: number;
    normalizedName: string;
};

export function makeUserRepo(db: Db): UserRepo {
    const getAll = async (): Promise<User[]> => {
        const { rows } = await db.query("SELECT * FROM public_users_view");
        return rows as User[];
    };

    const getById = async (eId: string): Promise<User | null> => {
        const { rows } = await db.query(
            `
            SELECT
                e_id AS eId,
                name,
                email,
                role_name AS roleName
            FROM public_users_view
            WHERE e_id = ?`,
            [eId],
        );
        return rows.length > 0 ? rows[0] : null;
    };

    const getByIds = async (eIds: string[]): Promise<User[]> => {
        if (!eIds.length) return [];

        const placeholders = eIds.map(() => "?").join(",");

        const { rows } = await db.query(
            `SELECT
                e_id AS eId,
                name,
                email,
                role_name AS roleName
             FROM public_users_view
             WHERE e_id IN (${placeholders})`,
            eIds,
        );

        return rows as User[];
    };

    const getGuestsByIds = async (guestIds: number[]): Promise<Guest[]> => {
        if (!guestIds.length) return [];

        const placeholders = guestIds.map(() => "?").join(",");

        const { rows } = await db.query(
            `SELECT id, name, email, invited_by FROM guests WHERE id IN (${placeholders})`,
            guestIds,
        );

        return rows as Guest[];
    };

    const listUsers = async (query: ListUsersQuery): Promise<ListUsersPage> => {
        const searchTerm = query.query?.trim();
        const uniqueExcludeIds = uniqueIds(query.excludeId ?? []);
        const hasLimit = query.limit !== undefined;
        const limit = query.limit ?? 0;
        const decodedCursor: ListUsersCursor | null = hasLimit && query.cursor
            ? Cursor.decode(query.cursor, ListUsersCursorSchema)
            : null;

        const selectParams: any[] = [];
        const whereParams: any[] = [];
        const whereClauses: string[] = [];

        let scoreExpr = "0";
        if (searchTerm) {
            scoreExpr = `
                CASE
                    WHEN (LOWER(u.name) = LOWER(?) OR LOWER(u.email) = LOWER(?)) THEN 3
                    WHEN (LOWER(u.name) LIKE CONCAT(LOWER(?), '%') OR LOWER(u.email) LIKE CONCAT(LOWER(?), '%')) THEN 2
                    WHEN (LOWER(u.name) LIKE CONCAT('%', LOWER(?), '%') OR LOWER(u.email) LIKE CONCAT('%', LOWER(?), '%')) THEN 1
                    ELSE 0
                END
            `;
            selectParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            whereClauses.push("LOWER(u.name) LIKE CONCAT('%', LOWER(?), '%')");
            whereParams.push(searchTerm);
        }

        if (uniqueExcludeIds.length > 0) {
            const placeholders = uniqueExcludeIds.map(() => "?").join(", ");
            whereClauses.push(`u.e_id NOT IN (${placeholders})`);
            whereParams.push(...uniqueExcludeIds);
        }

        const outerClauses: string[] = [];
        const outerParams: any[] = [];
        if (decodedCursor) {
            outerClauses.push(`
                (
                    filtered.searchScore < ?
                    OR (filtered.searchScore = ? AND filtered.normalizedName > LOWER(?))
                    OR (filtered.searchScore = ? AND filtered.normalizedName = LOWER(?) AND filtered.eId > ?)
                )
            `);
            outerParams.push(
                decodedCursor.score,
                decodedCursor.score,
                decodedCursor.name,
                decodedCursor.score,
                decodedCursor.name,
                decodedCursor.eId,
            );
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
        const outerWhereClause = outerClauses.length > 0 ? `WHERE ${outerClauses.join(" AND ")}` : "";

        const sql = `
            SELECT
                filtered.eId,
                filtered.name,
                filtered.email,
                filtered.roleName,
                filtered.searchScore
            FROM (
                SELECT
                    u.e_id AS eId,
                    u.name,
                    u.email,
                    u.role_name AS roleName,
                    ${scoreExpr} AS searchScore,
                    LOWER(u.name) AS normalizedName
                FROM public_users_view u
                ${whereClause}
            ) filtered
            ${outerWhereClause}
            ORDER BY filtered.searchScore DESC, filtered.normalizedName ASC, filtered.eId ASC
            ${hasLimit ? "LIMIT ?" : ""}
        `;

        const queryParams = [
            ...selectParams,
            ...whereParams,
            ...outerParams,
            ...(hasLimit ? [limit + 1] : []),
        ];

        const { rows } = await db.query(sql, queryParams);
        const pageRows = (rows as UserSearchRow[]).map((row) => ({
            ...row,
            searchScore: Number(row.searchScore),
        }));

        const items = pageRows.map(({ searchScore: _searchScore, normalizedName: _normalizedName, ...user }) => user) as User[];

        if (!hasLimit) {
            return { items, nextCursor: null };
        }

        const hasMore = pageRows.length > limit;
        const pageItems = hasMore ? pageRows.slice(0, limit) : pageRows;
        const nextCursor = hasMore && pageItems.length > 0
            ? Cursor.encode({
                score: pageItems[pageItems.length - 1].searchScore,
                name: pageItems[pageItems.length - 1].name,
                eId: pageItems[pageItems.length - 1].eId,
            })
            : null;

        return {
            items: pageItems.map(({ searchScore: _searchScore, normalizedName: _normalizedName, ...user }) => user) as User[],
            nextCursor,
        };
    };

    const getUsers = async (query?: string, excludeId?: string): Promise<User[]> => {
        const result = await listUsers({
            query: query,
            exclude: [],
            excludeId: excludeId ? [excludeId] : [],
            cursor: null,
        });

        return result.items;
    };

    const getPotentialFriends = async (query?: string, userId?: string): Promise<User[]> => {
        const params: unknown[] = [];
        let where = "";

        if (query?.trim()) {
        where = `
            AND (
            u.name LIKE ?
            OR u.email LIKE ?
            )
        `;

        params.push(`%${query.trim()}%`, `%${query.trim()}%`);
        }

        const { rows } = await db.query(
        `
        SELECT
            u.e_id AS eId,
            u.name,
            u.email,
            u.role_name AS roleName,
            CASE
            WHEN fr.from_user = ? AND fr.to_user = u.e_id THEN 'PENDING_SENT'
            WHEN fr.from_user = u.e_id AND fr.to_user = ? THEN 'PENDING_RECEIVED'
            ELSE NULL
            END AS friendshipStatus
        FROM public_users_view u
        LEFT JOIN friend_requests fr
            ON (
            (
                fr.from_user = ?
                AND fr.to_user = u.e_id
            )
            OR
            (
                fr.from_user = u.e_id
                AND fr.to_user = ?
            )
            )
            AND fr.status = 'pending'
        WHERE u.e_id <> ?
            AND NOT EXISTS (
            SELECT 1
            FROM friendships f
            WHERE
                (
                f.user_low = ?
                AND f.user_high = u.e_id
                )
                OR
                (
                f.user_high = ?
                AND f.user_low = u.e_id
                )
            )
            ${where}
        LIMIT 100
        `,
        [
            userId, // CASE pending_sent
            userId, // CASE pending_received
            userId, // LEFT JOIN sent
            userId, // LEFT JOIN received
            userId, // exclude self
            userId, // friendships low
            userId, // friendships high
            ...params,
        ],
        );

        return rows;
    };

    const getAllByName = async (query: string): Promise<User[]> => {
        const result = await listUsers({
            query: query,
            exclude: [],
            excludeId: [],
            limit: 100,
            cursor: null,
        });

        return result.items;
    };

    const TEMPORARY_CREATE = async (eId: string, name: string, email: string, hashedPassword: string, roleId: number) => {
        const { affectedCount } = await db.execute(
            `
            INSERT INTO users (e_id, name, email, password_hash, role_id, create_time)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [eId, name, email, hashedPassword, roleId, new Date()],
        );

        if (!affectedCount) {
            throw new ConflictError("El usuario ya existe o no se pudo crear");
        }

        const { rows } = await db.query(
            `
            SELECT *
            FROM users
            WHERE e_id = ?`,
            [eId],
        );

        return rows[0];
    };

    const getAllGuests = async (): Promise<Guest[]> => {
        const { rows } = await db.query("SELECT id, name, email, invited_by FROM guests");
        return rows as Guest[];
    };

    const getGuestById = async (guestId: number): Promise<Guest | null> => {
        const { rows } = await db.query(
            `
            SELECT
                id,
                name,
                email,
                invited_by
            FROM guests
            WHERE id = ?;
        `,
            [guestId],
        );

        return rows.length > 0 ? rows[0] : null;
    };

    const createGuest = async (name: string, email: string, invitedByEId: string): Promise<Guest> => {
        const { affectedCount, insertId } = await db.execute(
            `
            INSERT INTO guests (name, email, invited_by, create_time)
            VALUES (?, ?, ?, ?);
        `,
            [name, email, invitedByEId, new Date()],
        );

        if (!affectedCount || !insertId) {
            throw new ConflictError("El invitado ya existe o no se pudo crear");
        }

        const { rows } = await db.query(
            `
            SELECT *
            FROM guests
            WHERE id = ?;
        `,
            [insertId],
        );

        return rows[0];
    };

    const updateGuest = async (guestId: number, name?: string, email?: string): Promise<Guest | null> => {
        const fieldsToUpdate: string[] = [];
        const params: any[] = [];

        if (name) {
            fieldsToUpdate.push("name = ?");
            params.push(name);
        }
        if (email) {
            fieldsToUpdate.push("email = ?");
            params.push(email);
        }

        if (fieldsToUpdate.length === 0) {
            throw new UnprocessableError("No fields to update");
        }

        params.push(guestId);
        const setClause = fieldsToUpdate.join(", ");

        const { affectedCount } = await db.execute(
            `
            UPDATE guests
            SET ${setClause}
            WHERE id = ?;
        `,
            params,
        );

        if (!affectedCount) {
            throw new ConflictError("No se actualizó el invitado");
        }

        const { rows } = await db.query(
            `
            SELECT *
            FROM guests
            WHERE id = ?;
        `,
            [guestId],
        );

        return rows.length > 0 ? rows[0] : null;
    };

    const removeGuest = async (guestId: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(
            `
            DELETE FROM guests
            WHERE id = ?;
        `,
            [guestId],
        );

        return affectedCount > 0;
    };

    return {
        getAll,
        getById,
        getByIds,
        getGuestsByIds,
        getUsers,
        listUsers,
        getAllByName,
        TEMPORARY_CREATE,

        getPotentialFriends,

        getAllGuests,
        getGuestById,
        createGuest,
        updateGuest,
        removeGuest,
    };
}
