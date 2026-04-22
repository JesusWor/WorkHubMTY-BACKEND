import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { makeAuthService } from '../../../src/modules/auth/auth.service';
import { AuthRepo } from '../../../src/modules/auth/auth.repo';
import { UnauthorizedError } from '../../../src/shared/errors/AppError';

async function makeHashedUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('password123', 10);
  return {
    eId: 'USR00001',
    passwordHash,
    roleName: 'Admin',
    ...overrides,
  };
}

function makeMockRepo(overrides: Partial<AuthRepo> = {}): AuthRepo {
  return {
    getById: vi.fn(),
    ...overrides,
  };
}

describe('AuthService.login', () => {
  let repo: AuthRepo;

  beforeEach(() => {
    repo = makeMockRepo();
  });

  it('retorna un token JWT si las credenciales son válidas', async () => {
    const user = await makeHashedUser();
    vi.mocked(repo.getById).mockResolvedValue(user);

    const service = makeAuthService(repo);
    const token = await service.login({ eId: 'USR00001', password: 'password123' });

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    // JWT format: header.payload.signature
    expect(token.split('.')).toHaveLength(3);
  });

  it('lanza UnauthorizedError si el usuario no existe', async () => {
    vi.mocked(repo.getById).mockResolvedValue(null);

    const service = makeAuthService(repo);

    await expect(
      service.login({ eId: 'NOEXISTE', password: 'password123' })
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      service.login({ eId: 'NOEXISTE', password: 'password123' })
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('lanza UnauthorizedError si la contraseña es incorrecta', async () => {
    const user = await makeHashedUser();
    vi.mocked(repo.getById).mockResolvedValue(user);

    const service = makeAuthService(repo);

    await expect(
      service.login({ eId: 'USR00001', password: 'wrongpassword' })
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      service.login({ eId: 'USR00001', password: 'wrongpassword' })
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('no revela si el error es de usuario o contraseña (mismo mensaje)', async () => {
    const user = await makeHashedUser();

    const repoUserNotFound = makeMockRepo({ getById: vi.fn().mockResolvedValue(null) });
    const repoWrongPassword = makeMockRepo({ getById: vi.fn().mockResolvedValue(user) });

    const serviceA = makeAuthService(repoUserNotFound);
    const serviceB = makeAuthService(repoWrongPassword);

    const errorA = await serviceA.login({ eId: 'X', password: 'any' }).catch((e) => e);
    const errorB = await serviceB.login({ eId: 'USR00001', password: 'wrong' }).catch((e) => e);

    expect(errorA.message).toBe(errorB.message);
    expect(errorA.statusCode).toBe(errorB.statusCode);
  });

  it('lanza UnauthorizedError con statusCode 401', async () => {
    vi.mocked(repo.getById).mockResolvedValue(null);

    const service = makeAuthService(repo);
    const error = await service
      .login({ eId: 'NOEXISTE', password: 'pass' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('llama a repo.getById con el eId correcto', async () => {
    vi.mocked(repo.getById).mockResolvedValue(null);

    const service = makeAuthService(repo);
    await service.login({ eId: 'USR00001', password: 'pass' }).catch(() => {});

    expect(repo.getById).toHaveBeenCalledWith('USR00001');
    expect(repo.getById).toHaveBeenCalledTimes(1);
  });

  it('lanza error si el rol del usuario no es válido', async () => {
    const user = await makeHashedUser({ roleName: 'RolInexistente' });
    vi.mocked(repo.getById).mockResolvedValue(user);

    const service = makeAuthService(repo);

    // mapRole throws when role is not in the map
    await expect(
      service.login({ eId: 'USR00001', password: 'password123' })
    ).rejects.toThrow('Invalid role: RolInexistente');
  });
});
