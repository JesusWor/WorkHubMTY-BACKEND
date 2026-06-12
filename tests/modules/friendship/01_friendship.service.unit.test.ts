import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFriendshipService } from '../../../src/modules/friendship/friendship.service';
import { BadRequestError, ConflictError, NotFoundError } from '../../../src/shared/errors/AppError';
import type { FriendshipRepo } from '../../../src/modules/friendship/friendship.repo';

vi.mock('../../../src/infra/events/index.js', () => ({
    userEvents: { emit: vi.fn() },
}));

function makeRepo(overrides: Partial<FriendshipRepo> = {}): FriendshipRepo {
    return {
        getAll: vi.fn().mockResolvedValue([]),
        getFriendIds: vi.fn().mockResolvedValue([]),
        areFriends: vi.fn().mockResolvedValue(false),
        createFriendship: vi.fn().mockResolvedValue({
            userLow: 'USR00001',
            userHigh: 'USR00002',
            source: 'REQUEST',
            createdAt: '2024-01-01T00:00:00.000Z',
        }),
        removeFriendship: vi.fn().mockResolvedValue(true),
        getReceivedRequests: vi.fn().mockResolvedValue([]),
        getSentRequests: vi.fn().mockResolvedValue([]),
        createRequest: vi.fn().mockResolvedValue([]),
        acceptRequest: vi.fn().mockResolvedValue({
            id: 1,
            fromUser: 'USR00001',
            toUserIds: ['USR00002'],
            status: 'ACCEPTED',
            createdAt: '2024-01-01T00:00:00.000Z',
            resolvedAt: '2024-01-02T00:00:00.000Z',
        }),
        cancelRequest: vi.fn().mockResolvedValue({
            id: 1,
            fromUser: 'USR00001',
            toUserIds: ['USR00002'],
            status: 'CANCELLED',
            createdAt: '2024-01-01T00:00:00.000Z',
            resolvedAt: '2024-01-02T00:00:00.000Z',
        }),
        rejectRequest: vi.fn().mockResolvedValue({
            id: 1,
            fromUser: 'USR00001',
            toUserIds: ['USR00002'],
            status: 'REJECTED',
            createdAt: '2024-01-01T00:00:00.000Z',
            resolvedAt: '2024-01-02T00:00:00.000Z',
        }),
        ...overrides,
    } as unknown as FriendshipRepo;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('FriendshipService.getFriendIds', () => {
    it('lanza BadRequestError si eId está vacío', async () => {
        const service = makeFriendshipService(makeRepo());
        await expect(service.getFriendIds('')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('llama al repo con el eId correcto', async () => {
        const repo = makeRepo();
        const service = makeFriendshipService(repo);
        await service.getFriendIds('USR00001');
        expect(repo.getFriendIds).toHaveBeenCalledWith('USR00001');
    });
});

describe('FriendshipService.areFriends', () => {
    it('lanza BadRequestError si falta algún userId', async () => {
        const service = makeFriendshipService(makeRepo());
        await expect(service.areFriends('', 'USR00002')).rejects.toBeInstanceOf(BadRequestError);
        await expect(service.areFriends('USR00001', '')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('retorna true si user1 === user2', async () => {
        const service = makeFriendshipService(makeRepo());
        const result = await service.areFriends('USR00001', 'USR00001');
        expect(result).toBe(true);
    });
});

describe('FriendshipService.createFriendship', () => {
    it('lanza BadRequestError si un usuario se agrega a sí mismo', async () => {
        const service = makeFriendshipService(makeRepo());
        await expect(service.createFriendship('USR00001', 'USR00001', 'REQUEST')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('lanza ConflictError si el repo retorna null', async () => {
        const repo = makeRepo({ createFriendship: vi.fn().mockResolvedValue(null) });
        const service = makeFriendshipService(repo);
        await expect(service.createFriendship('USR00001', 'USR00002', 'ADMIN')).rejects.toBeInstanceOf(ConflictError);
    });

    it('normaliza el orden userLow/userHigh al llamar al repo', async () => {
        const repo = makeRepo();
        const service = makeFriendshipService(repo);
        await service.createFriendship('USR00002', 'USR00001', 'ADMIN');
        expect(repo.createFriendship).toHaveBeenCalledWith('USR00001', 'USR00002', 'ADMIN');
    });
});

describe('FriendshipService.removeFriendship', () => {
    it('lanza NotFoundError si el repo retorna false', async () => {
        const repo = makeRepo({ removeFriendship: vi.fn().mockResolvedValue(false) });
        const service = makeFriendshipService(repo);
        await expect(service.removeFriendship('USR00001', 'USR00002')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('retorna true cuando se elimina correctamente', async () => {
        const service = makeFriendshipService(makeRepo());
        const result = await service.removeFriendship('USR00001', 'USR00002');
        expect(result).toBe(true);
    });
});

describe('FriendshipService.createRequest', () => {
    it('lanza BadRequestError si fromUser envía solicitud a sí mismo', async () => {
        const service = makeFriendshipService(makeRepo());
        await expect(service.createRequest('USR00001', ['USR00001'])).rejects.toBeInstanceOf(BadRequestError);
    });

    it('lanza ConflictError si ya son amigos', async () => {
        const repo = makeRepo({ areFriends: vi.fn().mockResolvedValue(true) });
        const service = makeFriendshipService(repo);
        await expect(service.createRequest('USR00001', ['USR00002'])).rejects.toBeInstanceOf(ConflictError);
    });

    it('lanza BadRequestError si toUserIds está vacío', async () => {
        const service = makeFriendshipService(makeRepo());
        await expect(service.createRequest('USR00001', [])).rejects.toBeInstanceOf(BadRequestError);
    });
});

describe('FriendshipService.cancelRequest', () => {
    it('lanza NotFoundError si el repo retorna null', async () => {
        const repo = makeRepo({ cancelRequest: vi.fn().mockResolvedValue(null) });
        const service = makeFriendshipService(repo);
        await expect(service.cancelRequest('USR00001', 'USR00002')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('retorna true cuando la cancelación es exitosa', async () => {
        const service = makeFriendshipService(makeRepo());
        const result = await service.cancelRequest('USR00001', 'USR00002');
        expect(result).toBe(true);
    });
});

describe('FriendshipService.rejectRequest', () => {
    it('lanza NotFoundError si el repo retorna null', async () => {
        const repo = makeRepo({ rejectRequest: vi.fn().mockResolvedValue(null) });
        const service = makeFriendshipService(repo);
        await expect(service.rejectRequest('USR00002', 'USR00001')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('retorna true cuando el rechazo es exitoso', async () => {
        const service = makeFriendshipService(makeRepo());
        const result = await service.rejectRequest('USR00002', 'USR00001');
        expect(result).toBe(true);
    });
});
