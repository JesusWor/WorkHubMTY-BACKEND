export const dbConfig = {
    db_host: process.env.DB_HOST || '',
    db_port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    db_user: process.env.DB_USER || '',
    db_password: process.env.DB_PASSWORD || '',
    db_name: process.env.DB_NAME || '',
    db_connection_limit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
}