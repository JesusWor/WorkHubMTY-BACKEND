import { Db } from "../../infra/db/db.js";
import { Role, UpdateRole, CreateRole } from "./role.schema.js";

export type RoleRepo = {
    getAll : () => Promise<Role[]>;
    getById : (id: number) => Promise<Role | null>;
    create : (role: CreateRole) => Promise<Role | null>;
    update : (id: number, role: UpdateRole) => Promise<Role | null>;
    delete : (id: number) => Promise<boolean>;
}

export function makeRoleRepo(db : Db): RoleRepo {
    const getAll = async (): Promise<Role[]> => {
        const { rows } = await db.query("SELECT * FROM roles");
        return rows as Role[];
    }

    const getById = async (id: number): Promise<Role | null> => {
        const { rows } = await db.query("SELECT * FROM roles WHERE id = ?", [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    const create = async (role: CreateRole): Promise<Role | null> => {
        const { insertId } = await db.execute("INSERT INTO roles (name) VALUES (?)", [role.name]);

        if (!insertId) return null;

        return await getById(insertId);
    }

    const update = async (id: number, role: UpdateRole): Promise<Role | null> => {
        const fields: string[] = [];
        const values: any[] = [];

        const allowedFields = ["name"];

        for (const [key, value] of Object.entries(role)) {
            if (value === undefined) continue;
            if (!allowedFields.includes(key)) continue;

            fields.push(`${key} = ?`);
            values.push(value);
        }
        if (fields.length === 0) {
            return await getById(id);
        }

        const { affectedCount } = await db.execute(
            `UPDATE roles SET ${fields.join(', ')} WHERE id = ?`,
            [...values, id]
        );
        if (affectedCount === 0) {
            return null;
        }

        return await getById(id);
    }

    const remove = async (id: number): Promise<boolean> => {
        const { affectedCount } = await db.execute("DELETE FROM roles WHERE id = ?", [id]);
        return affectedCount > 0;
    }

    return {
        getAll,
        getById,
        create,
        update,
        delete: remove
    }
}