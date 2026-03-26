import { Db } from "../../infra/db/db.js";
import { User } from "./user.schema.js";

export type UserRepo = {
    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;

    getAllByName: (name: string) => Promise<User[]>;
    TEMPORARY_CREATE: (eId:string, name:string, email:string, hashedPassword:string, roleId:number) => Promise<User>;
}

export function makeUserRepo(db: Db): UserRepo {
    const MIN_NAME_LENGTH_LIKE = 3;
    
    const getAll = async (): Promise<User[]> => {
        const { rows } = await db.query("SELECT * FROM public_users_view");
        return rows as User[];
    }

    const getById = async (eId: string): Promise<User | null> => {
        const { rows } = await db.query("SELECT * FROM public_users_view WHERE e_id = ?", [eId]);
        return rows.length > 0 ? rows[0] : null;
    }

    const getAllByName = async (query: string): Promise<User[]> => {
        const trimmed = query.trim();

        if (!trimmed) return [];

        if (trimmed.length < MIN_NAME_LENGTH_LIKE) {
            const { rows } = await db.query(
                `SELECT *
                 FROM public_users_view
                 WHERE name LIKE ?
                 LIMIT 10`,
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
             LIMIT 10`,
            [trimmed, likeQuery, trimmed]
        );

        return rows as User[];
    };

    const TEMPORARY_CREATE = async (eId:string, name:string, email:string, hashedPassword:string, roleId:number) => {
        const { affectedCount, insertId } = await db.execute(`
            INSERT INTO users (e_id, name, email, password_hash, role_id, create_time)
            VALUES (?, ?, ?, ?, ?, ?)`, [eId, name, email, hashedPassword, roleId, new Date()]);
        
        if(!affectedCount){
            throw new Error('No se insertó insertó el usuario');
        }

        if(!insertId){
            throw new Error('No se insertó el usuario')
        }

        const {rows} = await db.query(`
            SELECT *
            FROM users
            WHERE id = ?`, [insertId]);

        return rows[0];
        
    };

    return {
        getAll,
        getById,
        getAllByName,
        TEMPORARY_CREATE
    }
}