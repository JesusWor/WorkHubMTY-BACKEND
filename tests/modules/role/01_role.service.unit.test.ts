import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRoleService } from '../../../src/modules/role/role.service';
import { InternalError, NotFoundError } from '../../../src/shared/errors/AppError';
import type { RoleRepo } from '../../../src/modules/role/role.repo';

function makeRepo(overrides: Partial<RoleRepo> = {}): RoleRepo {
    return {
        getAll: vi.fn().mockResolvedValue([{ id: 1, name: 'ADMIN' }]),
        getById: vi.fn().mockResolvedValue({ id: 1, name: 'ADMIN' }),
        create: vi.fn().mockResolvedValue({ id: 2, name: 'MANAGER' }),
        update: vi.fn().mockResolvedValue({ id: 1, name: 'SUPER_ADMIN' }),
        delete: vi.fn().mockResolvedValue(true),
        ...overrides,
    } as unknown as RoleRepo;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('RoleService.getAll', () => {
    it('retorna todos los roles', async () => {
        const service = makeRoleService(makeRepo());
        const result = await service.getAll();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('ADMIN');
    });
});

describe('RoleService.getById', () => {
    it('retorna el role si existe', async () => {
        const service = makeRoleService(makeRepo());
        const result = await service.getById(1);
        expect(result?.name).toBe('ADMIN');
    });

    it('retorna null si no existe', async () => {
        const repo = makeRepo({ getById: vi.fn().mockResolvedValue(null) });
        const service = makeRoleService(repo);
        const result = await service.getById(99);
        expect(result).toBeNull();
    });
});

describe('RoleService.create', () => {
    it('crea un role y lo retorna', async () => {
        const service = makeRoleService(makeRepo());
        const result = await service.create({ name: 'MANAGER' });
        expect(result.name).toBe('MANAGER');
    });

    it('lanza InternalError si el repo retorna null', async () => {
        const repo = makeRepo({ create: vi.fn().mockResolvedValue(null) });
        const service = makeRoleService(repo);
        await expect(service.create({ name: 'MANAGER' })).rejects.toBeInstanceOf(InternalError);
    });
});

describe('RoleService.update', () => {
    it('actualiza el role y lo retorna', async () => {
        const service = makeRoleService(makeRepo());
        const result = await service.update(1, { name: 'SUPER_ADMIN' });
        expect(result?.name).toBe('SUPER_ADMIN');
    });

    it('lanza NotFoundError si el repo retorna null', async () => {
        const repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
        const service = makeRoleService(repo);
        await expect(service.update(99, { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('RoleService.delete', () => {
    it('elimina el role y retorna true', async () => {
        const service = makeRoleService(makeRepo());
        const result = await service.delete(1);
        expect(result).toBe(true);
    });

    it('lanza NotFoundError si el repo retorna false', async () => {
        const repo = makeRepo({ delete: vi.fn().mockResolvedValue(false) });
        const service = makeRoleService(repo);
        await expect(service.delete(99)).rejects.toBeInstanceOf(NotFoundError);
    });
});
