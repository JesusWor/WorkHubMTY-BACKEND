import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeParkingSlotsService } from '../../../src/modules/parking-slots/parking-slots.service';
import { ParkingSlotsRepo } from '../../../src/modules/parking-slots/parking-slots.repo';
import { ParkingReservation, ParkingReservationCount } from '../../../src/modules/parking-slots/parking-slots.schema';
import { BadRequestError, ConflictError, NotFoundError } from '../../../src/shared/errors/AppError';
import { JwtPayload } from '../../../src/shared/schemas/auth.schema';
import { Roles } from '../../../src/middleware';

function makeReservation(overrides: Partial<ParkingReservation> = {}): ParkingReservation {
    return {
        id: 1,
        parking_lot_id: 1,
        user_id: 'USR00001',
        start_time: '2025-06-01T08:00:00',
        end_time: '2025-06-01T18:00:00',
        checked_in: false,
        ...overrides,
    };
}

function makeLots(overrides: Partial<ParkingReservationCount>[] = []): ParkingReservationCount[] {
    // Ordered by capacity ASC as the repo returns them
    const defaults: ParkingReservationCount[] = [
        { id: 1, name: 'Lote Pequeño', capacity: 50,  reservedCount: 0  },
        { id: 2, name: 'Lote Mediano', capacity: 200, reservedCount: 0  },
        { id: 3, name: 'Lote Grande',  capacity: 500, reservedCount: 0  },
    ];
    return defaults.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }));
}

function makeMockRepo(overrides: Partial<ParkingSlotsRepo> = {}): ParkingSlotsRepo {
    return {
        getAll: vi.fn().mockResolvedValue([]),
        getAvailabilityBetween: vi.fn().mockResolvedValue(makeLots()),
        reserveBetween: vi.fn().mockResolvedValue(makeReservation()),
        reassignParkingReservation: vi.fn().mockResolvedValue(makeReservation()),
        remove: vi.fn().mockResolvedValue(true),
        getById: vi.fn().mockResolvedValue(makeReservation()),
        getByIdAndUser: vi.fn().mockResolvedValue(makeReservation()),
        hasActiveReservation: vi.fn().mockResolvedValue(false),
        ...overrides,
    };
}

const adminUser: JwtPayload = { eId: 'ADM00001', role: Roles.ADMIN };
const regularUser: JwtPayload = { eId: 'USR00001', role: Roles.USER };

const START = '2025-06-01T08:00:00';
const END = '2025-06-01T18:00:00';

describe('ParkingService.getAll', () => {
    it('retorna todas las reservaciones', async () => {
        const reservations = [makeReservation(), makeReservation({ id: 2, user_id: 'USR00002' })];
        const repo = makeMockRepo({ getAll: vi.fn().mockResolvedValue(reservations) });
        const service = makeParkingSlotsService(repo);

        const result = await service.getAll();
        expect(result).toHaveLength(2);
        expect(repo.getAll).toHaveBeenCalledTimes(1);
    });

    it('retorna arreglo vacío si no hay reservaciones', async () => {
        const repo = makeMockRepo({ getAll: vi.fn().mockResolvedValue([]) });
        const service = makeParkingSlotsService(repo);

        const result = await service.getAll();
        expect(result).toEqual([]);
    });
});

describe('ParkingService.getAvailabilityBetween', () => {
    it('retorna disponibilidad de lotes', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        const result = await service.getAvailabilityBetween(START, END);
        expect(result).toHaveLength(3);
        expect(repo.getAvailabilityBetween).toHaveBeenCalledWith(START, END);
    });

    it('lanza BadRequestError si end_time <= start_time', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        await expect(service.getAvailabilityBetween(END, START))
            .rejects.toThrow(BadRequestError);
        await expect(service.getAvailabilityBetween(START, START))
            .rejects.toThrow(BadRequestError);
    });
});

describe('ParkingService.autoReserveBetween', () => {
    it('elige el cajón de MENOR capacidad disponible (primer lugar con espacio)', async () => {
        // Lots ordered by capacity ASC: 50, 200, 500 — all available
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        await service.autoReserveBetween('USR00001', START, END);
        // Should pick id=1 (capacity 50), not id=2 or id=3
        expect(repo.reserveBetween).toHaveBeenCalledWith(1, 'USR00001', START, END);
    });

    it('salta cajones llenos y toma el siguiente de menor capacidad', async () => {
        // Lote Pequeño (50) está lleno, Lote Mediano (200) tiene espacio
        const lots = makeLots([
            { id: 1, capacity: 50,  reservedCount: 50  }, // full
            { id: 2, capacity: 200, reservedCount: 150 }, // available
            { id: 3, capacity: 500, reservedCount: 0   },
        ]);
        const repo = makeMockRepo({ getAvailabilityBetween: vi.fn().mockResolvedValue(lots) });
        const service = makeParkingSlotsService(repo);

        await service.autoReserveBetween('USR00001', START, END);
        expect(repo.reserveBetween).toHaveBeenCalledWith(2, 'USR00001', START, END);
    });

    it('el reservedCount refleja empalmes reales (no reservas fuera del rango)', async () => {
        // This validates that the repo is called with the correct time range
        // so only overlapping reservations are counted
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        await service.autoReserveBetween('USR00001', START, END);
        expect(repo.getAvailabilityBetween).toHaveBeenCalledWith(START, END);
    });

    it('lanza BadRequestError si end_time <= start_time', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        await expect(service.autoReserveBetween('USR00001', END, START))
            .rejects.toThrow(BadRequestError);
    });

    it('lanza ConflictError si el usuario ya tiene reservación activa', async () => {
        const repo = makeMockRepo({ hasActiveReservation: vi.fn().mockResolvedValue(true) });
        const service = makeParkingSlotsService(repo);

        await expect(service.autoReserveBetween('USR00001', START, END))
            .rejects.toThrow(ConflictError);
        await expect(service.autoReserveBetween('USR00001', START, END))
            .rejects.toThrow('Ya tienes una reservación de estacionamiento en ese horario');
    });

    it('lanza ConflictError si todos los cajones están llenos (empalme completo)', async () => {
        const fullLots = makeLots([
            { id: 1, capacity: 50,  reservedCount: 50  },
            { id: 2, capacity: 200, reservedCount: 200 },
            { id: 3, capacity: 500, reservedCount: 500 },
        ]);
        const repo = makeMockRepo({ getAvailabilityBetween: vi.fn().mockResolvedValue(fullLots) });
        const service = makeParkingSlotsService(repo);

        await expect(service.autoReserveBetween('USR00001', START, END))
            .rejects.toThrow(ConflictError);
        await expect(service.autoReserveBetween('USR00001', START, END))
            .rejects.toThrow('No hay lugares de estacionamiento disponibles');
    });

    it('llama a hasActiveReservation con los parámetros correctos', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        await service.autoReserveBetween('USR00001', START, END);
        expect(repo.hasActiveReservation).toHaveBeenCalledWith('USR00001', START, END);
    });
});

describe('ParkingService.reassignParkingReservation', () => {
    it('reasigna a un lote con disponibilidad', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        // Lot 1 is available (capacity=5, reserved=0)
        const result = await service.reassignParkingReservation(1, 1);
        expect(result).not.toBeNull();
        expect(repo.reassignParkingReservation).toHaveBeenCalledWith(1, 1);
    });

    it('lanza NotFoundError si la reservación no existe', async () => {
        const repo = makeMockRepo({ getById: vi.fn().mockResolvedValue(null) });
        const service = makeParkingSlotsService(repo);

        await expect(service.reassignParkingReservation(99, 1))
            .rejects.toThrow(NotFoundError);
        await expect(service.reassignParkingReservation(99, 1))
            .rejects.toThrow('no existe');
    });

    it('lanza NotFoundError si el lote destino no existe', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        // parking_lot_id 99 is not in the availability list
        await expect(service.reassignParkingReservation(1, 99))
            .rejects.toThrow(NotFoundError);
    });

    it('lanza ConflictError si el cajón destino está lleno (con empalme)', async () => {
        const fullLots = makeLots([
            { id: 1, capacity: 50,  reservedCount: 50  },
            { id: 2, capacity: 200, reservedCount: 200 },
            { id: 3, capacity: 500, reservedCount: 500 },
        ]);
        const repo = makeMockRepo({ getAvailabilityBetween: vi.fn().mockResolvedValue(fullLots) });
        const service = makeParkingSlotsService(repo);

        await expect(service.reassignParkingReservation(1, 1))
            .rejects.toThrow(ConflictError);
    });
});

describe('ParkingService.remove', () => {
    it('admin puede eliminar cualquier reservación', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        const result = await service.remove(1, adminUser);
        expect(result).toBe(true);
        expect(repo.getById).toHaveBeenCalledWith(1);
        expect(repo.remove).toHaveBeenCalledWith(1);
    });

    it('usuario regular solo puede eliminar sus propias reservaciones', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        await service.remove(1, regularUser);
        expect(repo.getByIdAndUser).toHaveBeenCalledWith(1, 'USR00001');
        expect(repo.getById).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si la reservación no existe (admin)', async () => {
        const repo = makeMockRepo({ getById: vi.fn().mockResolvedValue(null) });
        const service = makeParkingSlotsService(repo);

        await expect(service.remove(99, adminUser))
            .rejects.toThrow(NotFoundError);
    });

    it('lanza NotFoundError si la reservación no le pertenece al usuario', async () => {
        const repo = makeMockRepo({ getByIdAndUser: vi.fn().mockResolvedValue(null) });
        const service = makeParkingSlotsService(repo);

        await expect(service.remove(1, regularUser))
            .rejects.toThrow(NotFoundError);
    });

    it('retorna true cuando la eliminación es exitosa', async () => {
        const repo = makeMockRepo();
        const service = makeParkingSlotsService(repo);

        const result = await service.remove(1, adminUser);
        expect(result).toBe(true);
    });
});
