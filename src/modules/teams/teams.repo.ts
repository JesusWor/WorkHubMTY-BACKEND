import { Db } from "../../infra/db/db.js";
import { ConflictError, NotFoundError, UnprocessableError } from "../../shared/errors/AppError.js";
import { User } from "../user/user.schema.js";
import { Team, TeamMember, TeamMembers } from "./teams.schema.js";

export type TeamsRepo = {
    getAllTeams: (name?: string) => Promise<Team[]>;
    getMyTeams: (userId: string) => Promise<Team[]>;
    getTeamMembers: (teamId: string) => Promise<TeamMember[]>;
    getTeamById: (teamId: number) => Promise<TeamMembers | null>;
    createTeam: (name: string, description: string, userIds: string[]) => Promise<TeamMembers>;
    updateTeam: (teamId: number, name?: string, description?: string) => Promise<TeamMembers | null>;
    removeTeam: (teamId: number) => Promise<boolean>;
    addTeamMembers: (teamId: number, memberEIds: string[]) => Promise<TeamMembers>;
    removeTeamMembers: (teamId: number, memberEIds: string[]) => Promise<TeamMembers>;
};

function uniqueIds(ids: string[]): string[] {
    return [...new Set(ids)];
}

export function makeTeamsRepo(db: Db): TeamsRepo {
    const getAllTeams = async (name?: string): Promise<Team[]> => {
        const trimmedName = name?.trim();

        if (!trimmedName) {
            const { rows } = await db.query(`
                SELECT
                    wg.id,
                    wg.name,
                    wg.description,
                    COUNT(wgm.userId) AS memberCount
                FROM work_groups wg
                LEFT JOIN work_group_members wgm ON wg.id = wgm.workGroupId
                GROUP BY wg.id, wg.name, wg.description
                ORDER BY wg.id DESC;
            `);
            return rows as Team[];
        }

        const { rows } = await db.query(`
            SELECT
                wg.id,
                wg.name,
                wg.description,
                COUNT(wgm.userId) AS memberCount,
                CASE
                    WHEN LOWER(wg.name) = LOWER(?) THEN 3
                    WHEN LOWER(wg.name) LIKE CONCAT(LOWER(?), '%') THEN 2
                    WHEN LOWER(wg.name) LIKE CONCAT('%', LOWER(?), '%') THEN 1
                    ELSE 0
                END AS relevance
            FROM work_groups wg
            LEFT JOIN work_group_members wgm ON wg.id = wgm.workGroupId
            WHERE LOWER(wg.name) LIKE CONCAT('%', LOWER(?), '%')
            GROUP BY wg.id, wg.name, wg.description
            ORDER BY relevance DESC, LENGTH(wg.name) ASC, wg.id DESC;
        `, [trimmedName, trimmedName, trimmedName, trimmedName]);
        return rows as Team[];
    };

    const getMyTeams = async (userId: string): Promise<Team[]> => {
        const { rows } = await db.query(`
            SELECT
                wg.id,
                wg.name,
                wg.description,
                COUNT(wgm_all.userId) AS memberCount
            FROM work_groups wg
            INNER JOIN work_group_members wgm_me
                ON wg.id = wgm_me.workGroupId
            LEFT JOIN work_group_members wgm_all
                ON wg.id = wgm_all.workGroupId
            WHERE wgm_me.userId = ?
            GROUP BY wg.id, wg.name, wg.description
            ORDER BY wg.id DESC;
        `, [userId]);

        return rows as Team[];
    };

    const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
        const { rows } = await db.query(`
            SELECT 
                u.e_id AS eId,
                u.name,
                u.email,
                u.role_name AS roleName
            FROM work_groups wg
            INNER JOIN work_group_members wgm ON wg.id = wgm.workGroupId
            INNER JOIN public_users_view u ON wgm.userId = u.e_id
            WHERE wg.id = ?
            ORDER BY u.name;
        `, [teamId]);

        return rows as TeamMember[];
    };

    const getTeamById = async (teamId: number): Promise<TeamMembers | null> => {
        const { rows } = await db.query(`
            SELECT
                wg.id AS teamId,
                wg.name AS teamName,
                wg.description AS teamDescription,
                u.e_id AS userId,
                u.name AS userName,
                u.email AS userEmail,
                u.role_name AS userRole
            FROM work_groups wg
            LEFT JOIN work_group_members wgm ON wg.id = wgm.workGroupId
            LEFT JOIN public_users_view u ON wgm.userId = u.e_id
            WHERE wg.id = ?;
        `, [teamId]);

        return rows.length > 0 ? {
            id: rows[0].teamId,
            name: rows[0].teamName,
            description: rows[0].teamDescription,
            users: rows.map(row => row.userId ? {
                eId: row.userId,
                name: row.userName,
                email: row.userEmail,
                roleName: row.userRole
            } as User : null).filter(user => user !== null) as User[]
        } : null;
    };

    const createTeam = async (name: string, description: string, userIds: string[]): Promise<TeamMembers> => {
        const { affectedCount, insertId } = await db.execute(`
            INSERT INTO work_groups (name, description, createTime)
            VALUES (?, ?, ?);
        `, [name, description, new Date()]);

        if (!affectedCount || !insertId) {
            throw new ConflictError("El team ya existe o no se pudo crear");
        }

        const uniqueUserIds = uniqueIds(userIds);
        if (uniqueUserIds.length > 0) {
            const values = uniqueUserIds.map(() => "(?, ?)").join(", ");
            const params = uniqueUserIds.flatMap((userId) => [insertId, userId]);

            await db.execute(`
                INSERT INTO work_group_members (workGroupId, userId)
                VALUES ${values};
            `, params);
        }

        return getTeamById(insertId) as Promise<TeamMembers>;
    };

    const updateTeam = async (teamId: number, name?: string, description?: string): Promise<TeamMembers | null> => {
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

        params.push(teamId);
        const setClause = fieldsToUpdate.join(", ");

        const { affectedCount } = await db.execute(`
            UPDATE work_groups
            SET ${setClause}
            WHERE id = ?;
        `, params);

        if (!affectedCount) {
            throw new NotFoundError("Team not found");
        }

        return getTeamById(teamId);
    };

    const removeTeam = async (teamId: number): Promise<boolean> => {
        const { affectedCount } = await db.execute(`
            DELETE FROM work_groups
            WHERE id = ?;
        `, [teamId]);

        return affectedCount > 0;
    };

    const addTeamMembers = async (teamId: number, memberEIds: string[]): Promise<TeamMembers> => {
        const uniqueMemberIds = uniqueIds(memberEIds);
        if (uniqueMemberIds.length > 0) {
            const values = uniqueMemberIds.map(() => "(?, ?)").join(", ");
            const params = uniqueMemberIds.flatMap((userId) => [teamId, userId]);

            await db.execute(`
                INSERT INTO work_group_members (workGroupId, userId)
                VALUES ${values};
            `, params);
        }

        return getTeamById(teamId) as Promise<TeamMembers>;
    };

    const removeTeamMembers = async (teamId: number, memberEIds: string[]): Promise<TeamMembers> => {
        const uniqueMemberIds = uniqueIds(memberEIds);
        if (uniqueMemberIds.length > 0) {
            const placeholders = uniqueMemberIds.map(() => "?").join(", ");
            const params = [teamId, ...uniqueMemberIds];

            await db.execute(`
                DELETE FROM work_group_members
                WHERE workGroupId = ?
                AND userId IN (${placeholders});
            `, params);
        }

        return getTeamById(teamId) as Promise<TeamMembers>;
    };

    return {
        getAllTeams,
        getMyTeams,
        getTeamMembers,
        getTeamById,
        createTeam,
        updateTeam,
        removeTeam,
        addTeamMembers,
        removeTeamMembers,
    };
}
