import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    db_host: process.env.DB_HOST || '',
    db_port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    db_user: process.env.DB_USER || '',
    db_password: process.env.DB_PASSWORD || '',
    db_name: process.env.DB_NAME || '',
    db_connection_limit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
    dbPG_host: process.env.DB_PG_HOST || '',
    dbPG_port: process.env.DB_PG_PORT ? parseInt(process.env.DB_PORT ?? '') : 5432,
    dbPG_user: process.env.DB_PG_USER || '',
    dbPG_password: process.env.DB_PG_PASSWORD || '',
    dbPG_name: process.env.DB_PG_NAME || '',
};