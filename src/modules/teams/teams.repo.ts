import { Db } from "../../infra/db/db.js";
import { ConflictError } from "../../shared/errors/AppError.js";
import { User } from "../user/user.schema.js";
import { TeamMember, TeamMembers } from "./teams.schema.js";

export type TeamsRepo = {
  getTeamMembers: (teamId: string) => Promise<TeamMember[]>;
  createGroup: (
    name: string,
    description: string,
    userIds: string[],
  ) => Promise<TeamMembers>;
  getTeamById: (teamId: number) => Promise<TeamMembers | null>;
};

export function makeTeamsRepo(db: Db): TeamsRepo {
  const getTeamMembers = async (teamId: string) => {
    const { rows } = await db.query(
      `
      SELECT 
        u.e_id AS eId,  
        u.name,
        u.email,
        r.name AS role
      FROM work_groups wg
      JOIN work_group_members wgm ON
        wg.id = wgm.workGroupId
      JOIN users u ON 
        u.e_id = wgm.userId
      JOIN roles r ON
        u.role_id = r.id
      WHERE wg.id = ?;
        `,
      [teamId],
    );

    return rows;
  };

  const getTeamById = async (teamId: number): Promise<TeamMembers | null> => {
    const { rows } = await db.query(
      `
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
            `,
      [teamId],
    );

    return rows.length > 0
      ? {
          id: rows[0].teamId,
          name: rows[0].teamName,
          description: rows[0].teamDescription,
          users: rows
            .map((row) =>
              row.userId
                ? ({
                    eId: row.userId,
                    name: row.userName,
                    email: row.userEmail,
                    roleName: row.userRole,
                  } as User)
                : null,
            )
            .filter((user) => user !== null) as User[],
        }
      : null;
  };

  const createGroup = async (
    name: string,
    description: string,
    userIds: string[],
  ): Promise<TeamMembers> => {
    const { affectedCount, insertId } = await db.execute(
      `
        INSERT INTO work_groups (name, description, createTime)
        VALUES (?, ?, ?);
            `,
      [name, description, new Date()],
    );

    if (!affectedCount || !insertId) {
      throw new ConflictError("El grupo ya existe o no se pudo crear");
    }

    const values = userIds.map(() => "(?, ?)").join(", ");

    const params = userIds.flatMap((userId) => [insertId, userId]);

    await db.execute(
      `
        INSERT INTO work_group_members (workGroupId, userId)
        VALUES ${values};
            `,
      params,
    );

    return getTeamById(insertId) as Promise<TeamMembers>;
  };

  return {
    getTeamMembers,
    getTeamById,
    createGroup,
  };
}
