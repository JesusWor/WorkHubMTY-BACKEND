import mysql from 'mysql2/promise';
import { Pool } from 'pg'
import { config } from '../../config/env';

export type Db = {
    query : (text: string, params?: any[]) => Promise< {rows : any[]}>;
    execute : (text: string, params?: any[]) => Promise< {affectedCount: number, insertId?: number, rows?:any[]}>;
    close : () => Promise<void>;
    testConnection : () => Promise<void>;
};

export function createDB() : Db {
    const pool = mysql.createPool({
        host: config.db_host,
        user: config.db_user,
        password: config.db_password,
        database: config.db_name,
        port: config.db_port,
        connectionLimit: config.db_connection_limit
    });

    return {
        query: async (text: string, params?: any[]) => {
            const [rows] = await pool.query(text, params);
            return { rows: rows as any[] };
        },
        execute: async (text: string, params?: any[]) => {
            const [result] = await pool.execute(text, params);
            const affectedCount = (result as any).affectedRows;
            const insertId = (result as any).insertId;
            return { affectedCount, insertId };
        },
        close: async () => {
            await pool.end();
        },
        testConnection: async () => {
            try {
                const connection = await pool.getConnection();
                console.log('Conexión a MySQL establecida con éxito');
            } catch (error) {
                console.error('Error al conectar a MySQL:', error);
            }
        }

    }; 
}

export function createDbPG(): Db {
    const pool = new Pool({
        host: config.dbPG_host,
        user: config.dbPG_user,
        password: config.dbPG_password,
        database: config.dbPG_name,
        port: 5432
    });

    return {
        query: async (text: string, params?: any[]) => {
            const result = await pool.query(text, params);
            return { rows: result.rows };
        },
        execute: async (text: string, params?: any[]) => {
            const result = await pool.query(text, params);
            const affectedCount = result.rowCount || 0;
            return { affectedCount, rows: result.rows };
        },
        close: async () => {
            await pool.end();
        },
        testConnection: async () => {
            try {
                const connection = await pool.connect();
                const result = await pool.query("SELECT NOW()")
                console.log('Conexión a PG establecida con éxito');
                connection.release();
            } catch (error) {
                console.error('Error al conectar a PG:', error);
            }
        }

    };
}