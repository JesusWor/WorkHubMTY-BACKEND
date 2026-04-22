import dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import mysql from 'mysql2/promise';
import { createTestConnection, resetTables } from './utils/db.util';
import { TABLE_ORDER } from './utils/seed.util';

export { seed } from './utils/seed.util';

let connection: mysql.Connection;

export async function setup() {
  connection = await createTestConnection({ multipleStatements: true });

  await resetTables(connection, { tables: [...TABLE_ORDER] });

  console.log(`[test] DB "${process.env.DB_NAME}" seeded`);
  await connection.end();
}

export async function teardown() {
  if (connection) {
    try { await connection.end(); } catch { }
    console.log('[test] DB connection closed');
  }
}
