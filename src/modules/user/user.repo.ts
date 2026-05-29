import { Db } from "../../infra/db/db.js";
import { User, Guest} from "./user.schema.js";
import { NotFoundError, ConflictError, UnprocessableError } from "../../shared/errors/AppError.js";
import { WorkGroup, WorkGroupMembers } from "../teams/teams.schema.js";

export type UserRepo = {
    getAllGroups: () => Promise<WorkGroup[]>;
    getMyGroups: (userId: string) => Promise<WorkGroup[]>;
    getGroupById: (groupId: number) => Promise<WorkGroupMembers | null>;
    updateGroup: (groupId: number, name?: string, description?: string) => Promise<WorkGroupMembers | null>;
    removeGroup: (groupId: number) => Promise<boolean>;
    addGroupMembers: (groupId: number, memberEIds: string[]) => Promise<WorkGroupMembers>;
    removeGroupMembers: (groupId: number, memberEIds: string[]) => Promise<WorkGroupMembers>;

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

    // Groups
    const getAllGroups = async (): Promise<WorkGroup[]> => {
        const { rows } = await db.query(`
            SELECT
                wg.id,
                wg.name,
                wg.description,
                COUNT(wgm.user_id) AS memberCount
            FROM work_groups wg
            LEFT JOIN work_group_members wgm ON wg.id = wgm.work_group_id
            GROUP BY wg.id;
        `);
        return rows as WorkGroup[];
    };

    const getMyGroups = async (userId: string): Promise<WorkGroup[]> => {
        const { rows } = await db.query(`
            SELECT
                wg.id,
                wg.name,
                wg.description,
                COUNT(wgm_all.user_id) AS memberCount
            FROM work_groups wg
            INNER JOIN work_group_members wgm_me
                ON wg.id = wgm_me.work_group_id
            LEFT JOIN work_group_members wgm_all
                ON wg.id = wgm_all.work_group_id
            WHERE wgm_me.user_id = ?
            GROUP BY wg.id, wg.name, wg.description
            ORDER BY wg.id DESC;
        `, [userId]);

        return rows as WorkGroup[];
    };

    const getGroupById = async (groupId: number): Promise<WorkGroupMembers | null> => {
        const { rows } = await db.query(`
            SELECT
                wg.id AS groupId,
                wg.name AS groupName,
                wg.description AS groupDescription,
                u.e_id AS userId,
                u.name AS userName,
                u.email AS userEmail,
                u.role_name AS userRole
            FROM work_groups wg
            LEFT JOIN work_group_members wgm ON wg.id = wgm.work_group_id
            LEFT JOIN public_users_view u ON wgm.user_id = u.e_id
            WHERE wg.id = ?;
        `, [groupId]);

        return rows.length > 0 ? {
            id: rows[0].groupId,
            name: rows[0].groupName,
            description: rows[0].groupDescription,
            users: rows.map(row => row.userId ? {
                eId: row.userId,
                name: row.userName,
                email: row.userEmail,
                roleName: row.userRole
            } as User : null).filter(user => user !== null) as User[]
        } : null;
    };


    const updateGroup = async (groupId: number, name?: string, description?: string): Promise<WorkGroupMembers | null> => {
        const fieldsToUpdate: string[] = [];
        const params: any[] = [];

        if (name) {
            fieldsToUpdate.push("name = ?");
            params.push(name);
        }
        if (description) {
            fieldsToUpdate.push("description = ?");
            params.push(description);
        }
        if (fieldsToUpdate.length === 0) {
            throw new UnprocessableError("No fields to update");
        }

        params.push(groupId);
        const setClause = fieldsToUpdate.join(", ");

        const { affectedCount } = await db.execute(`
            UPDATE work_groups
            SET ${setClause}
            WHERE id = ?;
        `, params);

        if (!affectedCount) {
            throw new NotFoundError('Grupo no encontrado');
        }

        return getGroupById(groupId) as Promise<WorkGroupMembers>;
    };

    const removeGroup = async (groupId: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(`
            DELETE FROM work_groups
            WHERE id = ?;
        `, [groupId]);

        return affectedCount > 0;
    };

    const addGroupMembers = async (groupId: number, memberEIds: string[]): Promise<WorkGroupMembers> => {
        const values = memberEIds.map(() => "(?, ?)").join(", ");
        const params = memberEIds.flatMap(userId => [groupId, userId]);

        await db.execute(`
            INSERT INTO work_group_members (work_group_id, user_id)
            VALUES ${values};
        `, params);

        return getGroupById(groupId) as Promise<WorkGroupMembers>;
    };

    const removeGroupMembers = async (groupId: number, memberEIds: string[]): Promise<WorkGroupMembers> => {
        const placeholders = memberEIds.map(() => "?").join(", ");
        const params = [groupId, ...memberEIds];
        await db.execute(`
            DELETE FROM work_group_members
            WHERE work_group_id = ?
            AND user_id IN (${placeholders});
        `, params);

        return getGroupById(groupId) as Promise<WorkGroupMembers>;
    };

    return {
        getAll,
        getById,
        getByIds,
        getGuestsByIds,
        getAllByName,
        TEMPORARY_CREATE,

        getUsers,

        getAllGuests,
        getGuestById,
        createGuest,
        updateGuest,
        removeGuest,

        getAllGroups,
        getMyGroups,
        getGroupById,
        updateGroup,
        removeGroup,
        addGroupMembers,
        removeGroupMembers
    }
}
