// dotenv.config() was intentionally removed from here.
// Each entrypoint is responsible for loading the correct .env file:
//   - server.ts        → import 'dotenv/config'                    (development / production)
//   - globalSetup.ts   → dotenv.config({ path: '.env.test' })      (test)

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const;

type NodeEnv = typeof VALID_NODE_ENVS[number];

// Fail-fast helpers
function requireString(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        console.error(`[env] Missing required environment variable: ${key}`);
        process.exit(1);
    }
    return value;
}

function requireInt(key: string, fallback?: number): number {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        if (fallback !== undefined) return fallback;
        console.error(`[env] Missing required environment variable: ${key}`);
        process.exit(1);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        console.error(`[env] Environment variable ${key} must be a valid integer, got: "${value}"`);
        process.exit(1);
    }
    return parsed;
}

function resolveNodeEnv(value?: string): NodeEnv {
    if (VALID_NODE_ENVS.includes(value as NodeEnv)) {
        return value as NodeEnv;
    }
    return 'production';
}

/*
env — validated at import time
*/
export const env = {
    server: {
        port: requireInt('PORT', 5000),
        nodeEnv: resolveNodeEnv(process.env.NODE_ENV),
    },
    db: {
        host: requireString('DB_HOST'),
        port: requireInt('DB_PORT', 3306),
        user: requireString('DB_USER'),
        password: requireString('DB_PASSWORD'),
        name: requireString('DB_NAME'),
        connectionLimit: requireInt('DB_CONNECTION_LIMIT', 10),
    },
    redis: {
        host: requireString('REDIS_HOST'),
        port: requireInt('REDIS_PORT', 6379),
    },
    auth: {
        jwtSecret: requireString('JWT_SECRET'),
    },
    mail: {
        host: requireString('SMTP_HOST'),
        port: requireInt('SMTP_PORT', 587),
        user: requireString('SMTP_USER'),
        pass: requireString('SMTP_PASS'),
    },
};