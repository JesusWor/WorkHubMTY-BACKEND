import { Db } from "../../infra/db/db.js";
import { UserAuth } from "./auth.schema.js";

export type AuthRepo = {
    getById: (eId: string) => Promise<UserAuth | null>;
};

export function makeAuthRepo(db: Db): AuthRepo {
    const getById = async (eId: string): Promise<UserAuth | null> => {
        const { rows } = await db.query(
            `SELECT
                e_id as eId,
                password_hash as passwordHash,
                r.name as roleName
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE
                e_id = ?`,
            [eId]
        );
        return rows.length > 0 ? (rows[0] as UserAuth) : null;
    };

    return { getById };
}