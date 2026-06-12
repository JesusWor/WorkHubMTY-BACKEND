import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeParkingSlotsService, CHECKIN_TOLERANCE_MINUTES } from '../../../src/modules/parking-slots/parking-slots.service';
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../../src/shared/errors/AppError';
import type { ParkingSlotsRepo } from '../../../src/modules/parking-slots/parking-slots.repo';
import type { FriendshipService } from '../../../src/modules/friendship/friendship.service';
import type { ParkingEventsEmitter } from '../../../src/infra/events/parking-events.emitter';

function makeBaseReservation(overrides = {}) {
    return {
        id: 1,
        user_id: 'USR00001',
        start_time: new Date('2024-01-01T08:00:00Z'),
        end_time: new Date('2024-01-01T10:00:00Z'),
        lifecycle_status: 'ACTIVE' as const,
        attendance_status: 'NOT_ARRIVED' as const,
        canceled_at: null,
        created_at: new Date('2024-01-01T07:00:00Z'),
        updated_at: new Date('2024-01-01T07:00:00Z'),
        ...overrides,
    };
}

function makeDeps(repoOverrides: Partial<ParkingSlotsRepo> = {}) {
    const repo: ParkingSlotsRepo = {
        getAllLots: vi.fn().mockResolvedValue([{ id: 1, name: 'Lot A', capacity: 10, priority: 1 }]),
        getLotById: vi.fn().mockResolvedValue({ id: 1, name: 'Lot A', capacity: 10, priority: 1 }),
        createLot: vi.fn().mockResolvedValue({ id: 2, name: 'Lot B', capacity: 5, priority: 2 }),
        updateLot: vi.fn().mockResolvedValue({ id: 1, name: 'Updated', capacity: 10, priority: 1 }),
        deleteLot: vi.fn().mockResolvedValue(true),
        listReservations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
        getReservationsByUser: vi.fn().mockResolvedValue([]),
        getReservationsByUserInRange: vi.fn().mockResolvedValue([]),
        getReservationById: vi.fn().mockResolvedValue(makeBaseReservation()),
        getReservationByIdAndUser: vi.fn().mockResolvedValue(makeBaseReservation()),
        hasActiveReservation: vi.fn().mockResolvedValue(false),
        createReservation: vi.fn().mockResolvedValue(makeBaseReservation()),
        updateAttendanceStatus: vi.fn().mockImplementation(async (_id, status) =>
            makeBaseReservation({ attendance_status: status }),
        ),
        cancelReservation: vi.fn().mockResolvedValue(
            makeBaseReservation({ attendance_status: 'CANCELED', lifecycle_status: 'CANCELED' }),
        ),
        getOverlaps: vi.fn().mockResolvedValue([]),
        getReservationCountInWindow: vi.fn().mockResolvedValue(0),
        markNoShowExpired: vi.fn().mockResolvedValue(0),
        ...repoOverrides,
    } as unknown as ParkingSlotsRepo;

    const friendshipService: FriendshipService = {
        areFriends: vi.fn().mockResolvedValue(true),
        getFriendIds: vi.fn().mockResolvedValue([]),
        getAll: vi.fn(),
        createFriendship: vi.fn(),
        removeFriendship: vi.fn(),
        getReceivedRequests: vi.fn(),
        getSentRequests: vi.fn(),
        createRequest: vi.fn(),
        acceptRequest: vi.fn(),
        cancelRequest: vi.fn(),
        rejectRequest: vi.fn(),
    } as unknown as FriendshipService;

    const queue = {
        add: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
    } as any;

    const emitter: ParkingEventsEmitter = { emit: vi.fn() } as any;

    const service = makeParkingSlotsService({ repo, friendshipService, queue, emitter });
    return { service, repo, friendshipService, queue, emitter };
}

function makeUser(role = 'USER', eId = 'USR00001') {
    return { eId, role } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ParkingSlotsService — Lots', () => {
    it('getLotById lanza NotFoundError si no existe', async () => {
        const { service } = makeDeps({ getLotById: vi.fn().mockResolvedValue(null) });
        await expect(service.getLotById(99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('createLot lanza ConflictError si el repo retorna null', async () => {
        const { service } = makeDeps({ createLot: vi.fn().mockResolvedValue(null) });
        await expect(service.createLot({ name: 'X', capacity: 5, priority: 1 })).rejects.toBeInstanceOf(ConflictError);
    });

    it('updateLot lanza NotFoundError si el repo retorna null', async () => {
        const { service } = makeDeps({ updateLot: vi.fn().mockResolvedValue(null) });
        await expect(service.updateLot(1, { name: 'Y' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deleteLot lanza NotFoundError si el repo retorna false', async () => {
        const { service } = makeDeps({ deleteLot: vi.fn().mockResolvedValue(false) });
        await expect(service.deleteLot(1)).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('ParkingSlotsService — createReservation', () => {
    it('lanza ForbiddenError si un USER intenta crear para otro usuario', async () => {
        const { service } = makeDeps();
        await expect(
            service.createReservation(makeUser('USER', 'USR00001'), {
                user_id: 'USR00002',
                start_time: new Date(),
                end_time: new Date(Date.now() + 3600000),
            }),
        ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('lanza ConflictError si ya hay reservación activa', async () => {
        const { service } = makeDeps({ hasActiveReservation: vi.fn().mockResolvedValue(true) });
        await expect(
            service.createReservation(makeUser('USER'), {
                start_time: new Date(),
                end_time: new Date(Date.now() + 3600000),
            }),
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('crea reservación correctamente y encola jobs', async () => {
        const { service, queue } = makeDeps();
        const result = await service.createReservation(makeUser('USER'), {
            start_time: new Date(),
            end_time: new Date(Date.now() + 3600000),
        });
        expect(result.reservation).toBeDefined();
        expect(queue.add).toHaveBeenCalledTimes(2);
    });
});

describe('ParkingSlotsService — patchAttendance', () => {
    it('lanza NotFoundError si la reservación no existe', async () => {
        const { service } = makeDeps({ getReservationByIdAndUser: vi.fn().mockResolvedValue(null) });
        await expect(service.patchAttendance(1, 'CHECKED_IN', makeUser())).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lanza ConflictError si la transición no es válida', async () => {
        const { service } = makeDeps({
            getReservationByIdAndUser: vi.fn().mockResolvedValue(
                makeBaseReservation({ attendance_status: 'CHECKED_OUT' }),
            ),
        });
        await expect(service.patchAttendance(1, 'CHECKED_IN', makeUser())).rejects.toBeInstanceOf(ConflictError);
    });

    it('permite check-in desde NOT_ARRIVED', async () => {
        const { service } = makeDeps();
        const result = await service.patchAttendance(1, 'CHECKED_IN', makeUser());
        expect(result.attendance_status).toBe('CHECKED_IN');
    });
});

describe('ParkingSlotsService — cancelReservation', () => {
    it('lanza ConflictError si ya está cancelada', async () => {
        const { service } = makeDeps({
            getReservationByIdAndUser: vi.fn().mockResolvedValue(
                makeBaseReservation({ attendance_status: 'CANCELED' }),
            ),
        });
        await expect(service.cancelReservation(1, makeUser())).rejects.toBeInstanceOf(ConflictError);
    });

    it('lanza ConflictError si ya fue consumida (CHECKED_IN)', async () => {
        const { service } = makeDeps({
            getReservationByIdAndUser: vi.fn().mockResolvedValue(
                makeBaseReservation({ attendance_status: 'CHECKED_IN' }),
            ),
        });
        await expect(service.cancelReservation(1, makeUser())).rejects.toBeInstanceOf(ConflictError);
    });

    it('cancela correctamente y elimina jobs de la queue', async () => {
        const { service, queue } = makeDeps();
        const result = await service.cancelReservation(1, makeUser());
        expect(result.attendance_status).toBe('CANCELED');
        expect(queue.remove).toHaveBeenCalledTimes(2);
    });
});

describe('ParkingSlotsService — listReservations', () => {
    it('lanza BadRequestError si limit está fuera de rango', async () => {
        const { service } = makeDeps();
        await expect(
            service.listReservations({ limit: 0, include: [], cursor: null } as any),
        ).rejects.toBeInstanceOf(BadRequestError);
        await expect(
            service.listReservations({ limit: 101, include: [], cursor: null } as any),
        ).rejects.toBeInstanceOf(BadRequestError);
    });
});
