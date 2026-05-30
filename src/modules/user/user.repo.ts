import { Db } from "../../infra/db/db.js";
import { User, Guest } from "./user.schema.js";
import { NotFoundError, ConflictError, UnprocessableError } from "../../shared/errors/AppError.js";

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
    getUsers: (query?:string, excludeId?:string) => Promise<User[]>;
    getPotentialFriends: (query?:string, userId?:string) => Promise<User[]>;

    getAllByName: (name: string) => Promise<User[]>;
    TEMPORARY_CREATE: (eId: string, name: string, email: string, hashedPassword: string, roleId: number) => Promise<User>;
}

export function makeUserRepo(db: Db): UserRepo {
    const MIN_NAME_LENGTH_LIKE = 3;

    const getAll = async (): Promise<User[]> => {
        const { rows } = await db.query("SELECT * FROM public_users_view");
        return rows as User[];
    }

    const getById = async (eId: string): Promise<User | null> => {
        const { rows } = await db.query(`
            SELECT
                e_id AS eId,
                name,
                email,
                role_name AS roleName 
            FROM public_users_view WHERE e_id = ?`, [eId]);
        return rows.length > 0 ? rows[0] : null;
    }

    const getByIds = async (eIds: string[]): Promise<User[]> => {
        if (!eIds.length) return [];

        const placeholders = eIds.map(() => "?").join(",");

        const { rows } = await db.query(
            `SELECT 
            e_id AS eId,
            name,
            email,
            role_name AS roleName 
            FROM public_users_view WHERE e_id IN (${placeholders})`,
            eIds
        );

        return rows as User[];
    }

    const getGuestsByIds = async (guestIds: number[]): Promise<Guest[]> => {
        if (!guestIds.length) return [];

        const placeholders = guestIds.map(() => "?").join(",");

        const { rows } = await db.query(
            `SELECT id, name, email, invited_by FROM guests WHERE id IN (${placeholders})`,
            guestIds
        );

        return rows as Guest[];
    }

    const getUsers = async (query?:string, excludeId?:string) => {
        const trimmed = query?.trim();
        let where = "";
        let params: any[] = [];
        if(trimmed){
            where = "WHERE (name LIKE ? OR email LIKE ?)";
            params = [`%${trimmed}%`, `%${trimmed}%`];
        }

        if (excludeId) {
            where += (where ? " AND" : "WHERE") + " e_id != ?";
            params.push(excludeId);
        }

        const {rows} = await db.query(`
            SELECT
                e_id AS eId,
                name,
                email,
                role_name AS roleName 
            FROM public_users_view
            ${where}
            LIMIT 100
         `, params);

         return rows;
    }

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
            WHEN fr.from_user = ? AND fr.to_user = u.e_id THEN 'pending_sent'
            WHEN fr.from_user = u.e_id AND fr.to_user = ? THEN 'pending_received'
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
        const trimmed = query.trim();

        if (!trimmed) return [];

        if (trimmed.length < MIN_NAME_LENGTH_LIKE) {
            const { rows } = await db.query(
                `SELECT *
                 FROM public_users_view
                 WHERE name LIKE ?
                 LIMIT 100`,
                [`%${trimmed}%`]
            );

            return rows as User[];
        }

        const likeQuery = `%${trimmed}%`;

        const { rows } = await db.query(
            `SELECT 
                *,
                MATCH(name) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
             FROM public_users_view
             WHERE 
                name LIKE ?
                OR MATCH(name) AGAINST (? IN NATURAL LANGUAGE MODE)
             ORDER BY score DESC
             LIMIT 100`,
            [trimmed, likeQuery, trimmed]
        );

        return rows as User[];
    };

    const TEMPORARY_CREATE = async (eId: string, name: string, email: string, hashedPassword: string, roleId: number) => {
        const { affectedCount } = await db.execute(`
            INSERT INTO users (e_id, name, email, password_hash, role_id, create_time)
            VALUES (?, ?, ?, ?, ?, ?)`, [eId, name, email, hashedPassword, roleId, new Date()]);

        if (!affectedCount) {
            throw new ConflictError('El usuario ya existe o no se pudo crear');
        }

        const { rows } = await db.query(`
            SELECT *
            FROM users
            WHERE e_id = ?`, [eId]);

        return rows[0];

    };

    // Guests
    const getAllGuests = async (): Promise<Guest[]> => {
        const { rows } = await db.query("SELECT id, name, email, invited_by FROM guests");
        return rows as Guest[];
    };

    const getGuestById = async (guestId: number): Promise<Guest | null> => {
        const { rows } = await db.query(`
            SELECT
                id,
                name,
                email,
                invited_by
            FROM guests
            WHERE id = ?;
        `, [guestId]);

        return rows.length > 0 ? rows[0] : null;
    }

    const createGuest = async (name: string, email: string, invitedByEId: string): Promise<Guest> => {
        const { affectedCount, insertId } = await db.execute(`
            INSERT INTO guests (name, email, invited_by, create_time)
            VALUES (?, ?, ?, ?);
        `, [name, email, invitedByEId, new Date()]);

        if (!affectedCount || !insertId) {
            throw new ConflictError('El invitado ya existe o no se pudo crear');
        }

        const { rows } = await db.query(`
            SELECT *
            FROM guests
            WHERE id = ?;
        `, [insertId]);

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

        const { affectedCount } = await db.execute(`
            UPDATE guests
            SET ${setClause}
            WHERE id = ?;
        `, params);

        if (!affectedCount) {
            throw new ConflictError('No se actualizó el invitado');
        }

        const { rows } = await db.query(`
            SELECT *
            FROM guests
            WHERE id = ?;
        `, [guestId]);

        return rows.length > 0 ? rows[0] : null;
    };

    const removeGuest = async (guestId: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(`
            DELETE FROM guests
            WHERE id = ?;
        `, [guestId]);

        return affectedCount > 0;
    };

    return {
        getAll,
        getById,
        getByIds,
        getGuestsByIds,
        getAllByName,
        TEMPORARY_CREATE,

        getUsers,
        getPotentialFriends,

        getAllGuests,
        getGuestById,
        createGuest,
        updateGuest,
        removeGuest,
    }
}
