export function setRequiredTestEnv() {
  process.env.NODE_ENV ??= 'test';
  process.env.DB_HOST ??= '127.0.0.1';
  process.env.DB_PORT ??= '3306';
  process.env.DB_USER ??= 'test';
  process.env.DB_PASSWORD ??= 'test';
  process.env.DB_USER_PASSWORD ??= process.env.DB_PASSWORD;
  process.env.DB_NAME ??= 'test';
  process.env.REDIS_HOST ??= '127.0.0.1';
  process.env.REDIS_PORT ??= '6379';
  process.env.REDIS_PASSWORD ??= 'test';
  process.env.JWT_SECRET ??= 'test-secret';
  process.env.RESEND_API_KEY ??= 'test-resend-key';
  process.env.RESEND_FROM_ADDRESS ??= 'WorkHub <test@example.com>';
}

export function shouldSkipDbIntegration() {
  return process.env.SKIP_DB_INTEGRATION === '1';
}
