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

    jwt_secret: process.env.JWT_SECRET
};