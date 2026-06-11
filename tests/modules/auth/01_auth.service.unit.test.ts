import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { setRequiredTestEnv } from '../../utils/test-env.js';
import type { AuthRepo } from '../../../src/modules/auth/auth.repo.js';
import { NotFoundError, UnauthorizedError } from '../../../src/shared/errors/AppError.js';

setRequiredTestEnv();
const { makeAuthService } = await import('../../../src/modules/auth/auth.service.js');

const meta = { userAgent: 'vitest', ip: '127.0.0.1' };

async function makeUser(overrides = {}) {
  return {
    eId: 'USR00001',
    name: 'Ana',
    passwordHash: await bcrypt.hash('password123', 10),
    roleName: 'Admin',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AuthRepo> = {}): AuthRepo {
  return {
    getById: vi.fn(),
    getMe: vi.fn().mockResolvedValue({ eId: 'USR00001', name: 'Ana', role: 'Admin' }),
    insertSession: vi.fn().mockResolvedValue(1),
    findSessionByHash: vi.fn().mockResolvedValue(null),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
    updateLastUsed: vi.fn().mockResolvedValue(undefined),
    hashExists: vi.fn().mockResolvedValue(false),
    ...overrides,
  } as AuthRepo;
}

describe('AuthService.login', () => {
  it('retorna accessToken, refreshToken y usuario', async () => {
    const repo = makeRepo({ getById: vi.fn().mockResolvedValue(await makeUser()) });
    const service = makeAuthService(repo);

    const result = await service.login({ eId: 'USR00001', password: 'password123' }, meta);

    expect(result.tokens.accessToken.split('.')).toHaveLength(3);
    expect(result.tokens.refreshToken.length).toBeGreaterThan(20);
    expect(result.user).toEqual({ eId: 'USR00001', name: 'Ana', role: 'ADMIN' });
    expect(repo.hashExists).toHaveBeenCalled();
    expect(repo.insertSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'USR00001',
      userAgent: 'vitest',
      ip: '127.0.0.1',
    }));
  });

  it('lanza UnauthorizedError si usuario o password son invalidos', async () => {
    await expect(makeAuthService(makeRepo({ getById: vi.fn().mockResolvedValue(null) }))
      .login({ eId: 'USR00001', password: 'password123' }, meta)).rejects.toThrow(UnauthorizedError);

    await expect(makeAuthService(makeRepo({ getById: vi.fn().mockResolvedValue(await makeUser()) }))
      .login({ eId: 'USR00001', password: 'wrong' }, meta)).rejects.toThrow(UnauthorizedError);
  });
});

describe('AuthService.refresh/logout/me', () => {
  it('revoca y rota refresh token valido', async () => {
    const session = {
      id: 1,
      userId: 'USR00001',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
      createdAt: new Date(),
      rotatedFrom: null,
      revokedAt: null,
      lastUsedAt: null,
      userAgent: null,
      ip: null,
    };
    const repo = makeRepo({ findSessionByHash: vi.fn().mockResolvedValue(session) });
    const service = makeAuthService(repo);

    const result = await service.refresh('raw-refresh-token', meta);

    expect(result.tokens.accessToken.split('.')).toHaveLength(3);
    expect(repo.revokeSession).toHaveBeenCalledWith(1);
    expect(repo.insertSession).toHaveBeenCalledWith(expect.objectContaining({ rotatedFrom: 1 }));
  });

  it('logout es idempotente si no hay sesion', async () => {
    const repo = makeRepo({ findSessionByHash: vi.fn().mockResolvedValue(null) });
    const service = makeAuthService(repo);

    await expect(service.logout('missing')).resolves.toBeUndefined();
    expect(repo.revokeSession).not.toHaveBeenCalled();
  });

  it('me lanza NotFoundError si no existe usuario', async () => {
    const service = makeAuthService(makeRepo({ getMe: vi.fn().mockResolvedValue(null) }));
    await expect(service.me('NOEXISTE')).rejects.toThrow(NotFoundError);
  });
});
