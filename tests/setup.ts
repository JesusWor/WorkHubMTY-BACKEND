import dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import { beforeEach, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { createTestConnection, resetTables } from './utils/db.util';
import { TABLE_ORDER, SeedTable } from './utils/seed.util';

export { seed } from './utils/seed.util';

export function useSeedSetup(
  { tables }: { tables: SeedTable[] } = { tables: [...TABLE_ORDER] }
) {
  let connection: mysql.Connection;
 
  beforeEach(async () => {
    connection = await createTestConnection();
    await resetTables(connection, { tables });
    await connection.end();
  });
 
  afterAll(async () => {
    if (connection) {
      try { await connection.end(); } catch { }
    }
  });
}

useSeedSetup();
