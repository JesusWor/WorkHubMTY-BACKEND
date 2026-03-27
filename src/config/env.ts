import dotenv from 'dotenv';
dotenv.config();

export const env = {
    server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    },
    db: {
        host: process.env.DB_HOST || '',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || '',
        connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
    },
    redis: {
        host: process.env.REDIS_HOST || '',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || '',
    },
    mail: {
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
};