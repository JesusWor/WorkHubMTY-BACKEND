import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { seed, SeedTable, TABLE_ORDER } from './seed.util';

export function createTestConnection(opts?: Partial<mysql.ConnectionOptions>) {
    return mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ...opts,
    });
}

export async function truncateTables(
    conn: mysql.Connection,
    { tables }: { tables: SeedTable[] }
) {
    const ordered = [...TABLE_ORDER]
        .reverse()
        .filter((t) => tables.includes(t));

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ordered) {
        await conn.query(`TRUNCATE TABLE ${table}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

const seeders: { [K in SeedTable]: (conn: mysql.Connection) => Promise<void> } = {
    roles: async (conn) => {
        for (const role of seed.roles) {
            await conn.query('INSERT INTO roles (id, name) VALUES (?, ?)', [
                role.id,
                role.name,
            ]);
        }
    },

    users: async (conn) => {
        for (const user of seed.users) {
            const passwordHash = await bcrypt.hash(user.password, 10);
            await conn.query(
                `INSERT INTO users (e_id, name, email, password_hash, role_id)
         VALUES (?, ?, ?, ?, ?)`,
                [user.eId, user.name, user.email, passwordHash, user.roleId]
            );
        }
    },

    parking_lots: async (conn) => {
        for (const lot of seed.parking_lots) {
            await conn.query(
                `INSERT INTO parking_lots (id, name, capacity) VALUES (?, ?, ?)`,
                [lot.id, lot.name, lot.capacity]
            );
        }
    },
 
    parking_reservations: async (conn) => {
        for (const res of seed.parking_reservations) {
            await conn.query(
                `INSERT INTO parking_reservations
                    (id, parking_lot_id, user_id, start_time, end_time, checked_in)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [res.id, res.parking_lot_id, res.user_id, res.start_time, res.end_time, res.checked_in]
            );
        }
    },
};

export async function resetTables(
    conn: mysql.Connection,
    { tables }: { tables: SeedTable[] }
) {
    await truncateTables(conn, { tables });

    const ordered = TABLE_ORDER.filter((t) => tables.includes(t));
    for (const table of ordered) {
        await seeders[table](conn);
    }
}