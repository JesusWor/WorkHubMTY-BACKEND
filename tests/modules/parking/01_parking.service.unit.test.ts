import { describe, it, expect, vi } from 'vitest';
import { makeParkingSlotsService } from '../../../src/modules/parking-slots/parking-slots.service.js';
import { ParkingSlotsRepo } from '../../../src/modules/parking-slots/parking-slots.repo.js';
import { BadRequestError } from '../../../src/shared/errors/AppError.js';
import { JwtPayload } from '../../../src/shared/schemas/auth.schema.js';
import { Roles } from '../../../src/middleware/index.js';
import type {
    ParkingLot,
    ParkingReservation,
    ListReservationsPage,
} from '../../../src/modules/parking-slots/parking-slots.schema.js';

function makeReservation(id: number): ParkingReservation {
    return {
        id,
        user_id: 'USR00001',
        start_time: new Date('2025-06-01T08:00:00.000Z'),
        end_time: new Date('2025-06-01T18:00:00.000Z'),
        lifecycle_status: 'ACTIVE',
        attendance_status: 'NOT_ARRIVED',
        allocation_state: 'SOFT',
        created_at: new Date('2025-06-01T07:00:00.000Z'),
        updated_at: new Date('2025-06-01T07:00:00.000Z'),
    };
}

function makePage(ids: number[], nextCursor: string | null = null): ListReservationsPage {
    return {
        items: ids.map(makeReservation),
        nextCursor,
    };
}

function makeMockRepo(overrides: Partial<ParkingSlotsRepo> = {}): ParkingSlotsRepo {
    const noopLot = { id: 1, name: 'Lote A', capacity: 10, priority: 1 } satisfies ParkingLot;

    return {
        getAllLots: vi.fn().mockResolvedValue([noopLot]),
        getLotById: vi.fn(),
        createLot: vi.fn(),
        updateLot: vi.fn(),
        deleteLot: vi.fn(),
        listReservations: vi.fn().mockResolvedValue(makePage([1, 2])),
        getReservationById: vi.fn(),
        getReservationsByUser: vi.fn(),
        getReservationByIdAndUser: vi.fn(),
        hasActiveReservation: vi.fn(),
        getOverlaps: vi.fn(),
        getReservationCountInWindow: vi.fn(),
        createReservation: vi.fn(),
        cancelReservation: vi.fn(),
        updateAttendanceStatus: vi.fn(),
        markNoShowExpired: vi.fn(),
        markNoShowForReservation: vi.fn(),
        getPendingNoShowReservations: vi.fn(),
        ...overrides,
    } as unknown as ParkingSlotsRepo;
}

const adminUser: JwtPayload = { eId: 'ADM00001', role: Roles.ADMIN };

describe('ParkingService.listReservations', () => {
    it('retorna la pagina del repo cuando el limit esta en rango', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService({
            repo,
            friendshipService: { areFriends: vi.fn().mockResolvedValue(true) } as any,
            queue: { add: vi.fn(), remove: vi.fn() } as any,
            emitter: { emit: vi.fn() } as any,
        });

        const result = await service.listReservations({ limit: 50, cursor: null });

        expect(result.items).toHaveLength(2);
        expect(result.nextCursor).toBeNull();
        expect(repo.listReservations).toHaveBeenCalledWith({ limit: 50, cursor: null });
    });

    it('deja limit ausente cuando no viene en la query', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService({
            repo,
            friendshipService: { areFriends: vi.fn().mockResolvedValue(true) } as any,
            queue: { add: vi.fn(), remove: vi.fn() } as any,
            emitter: { emit: vi.fn() } as any,
        });

        await service.listReservations({ cursor: null });

        expect(repo.listReservations).toHaveBeenCalledWith({ cursor: null });
    });

    it('rechaza limit menor a 1', async () => {
        const service = makeParkingSlotsService({
            repo: makeMockRepo(),
            friendshipService: { areFriends: vi.fn().mockResolvedValue(true) } as any,
            queue: { add: vi.fn(), remove: vi.fn() } as any,
            emitter: { emit: vi.fn() } as any,
        });

        await expect(service.listReservations({ limit: 0, cursor: null }))
            .rejects.toBeInstanceOf(BadRequestError);
    });

    it('rechaza limit mayor a 100', async () => {
        const service = makeParkingSlotsService({
            repo: makeMockRepo(),
            friendshipService: { areFriends: vi.fn().mockResolvedValue(true) } as any,
            queue: { add: vi.fn(), remove: vi.fn() } as any,
            emitter: { emit: vi.fn() } as any,
        });

        await expect(service.listReservations({ limit: 101, cursor: null }))
            .rejects.toBeInstanceOf(BadRequestError);
    });

    it('pasa el cursor encoded al repo sin decodificarlo en service', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService({
            repo,
            friendshipService: { areFriends: vi.fn().mockResolvedValue(true) } as any,
            queue: { add: vi.fn(), remove: vi.fn() } as any,
            emitter: { emit: vi.fn() } as any,
        });

        await service.listReservations({ limit: 10, cursor: 'eyJsYXN0SWQiOjV9' });

        expect(repo.listReservations).toHaveBeenCalledWith({
            limit: 10,
            cursor: 'eyJsYXN0SWQiOjV9',
        });
    });
});

describe('ParkingService smoke', () => {
    it('sigue pudiendo crear una reserva con el contrato actual', async () => {
        const repo = makeMockRepo({
            hasActiveReservation: vi.fn().mockResolvedValue(false),
            createReservation: vi.fn().mockResolvedValue(makeReservation(99)),
        });

        const service = makeParkingSlotsService({
            repo,
            friendshipService: { areFriends: vi.fn().mockResolvedValue(true) } as any,
            queue: { add: vi.fn(), remove: vi.fn() } as any,
            emitter: { emit: vi.fn() } as any,
        });

        const reservation = await service.createReservation(adminUser, {
            user_id: 'USR00001',
            start_time: new Date('2025-06-02T08:00:00.000Z'),
            end_time: new Date('2025-06-02T18:00:00.000Z'),
        });

        expect(reservation.id).toBe(99);
    });
});
