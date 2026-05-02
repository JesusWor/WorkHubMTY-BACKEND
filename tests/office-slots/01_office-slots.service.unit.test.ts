import { describe, it, expect, vi } from 'vitest';
import { makeOfficeSlotsService } from '../../../src/modules/office-slots/office-slots.service';
import { OfficeSlotsRepo } from '../../../src/modules/office-slots/office-slots.repo';
import { OfficeSlot, SlotAvailabilityResult } from '../../../src/modules/office-slots/office-slots.schema';
import { NotFoundError, UnprocessableError } from '../../../src/shared/errors/AppError';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<OfficeSlot> = {}): OfficeSlot {
    return {
        id: 1,
        name: 'Sala A',
        capacity: 10,
        floor_id: 1,
        is_blocked: false,
        ...overrides,
    };
}

function makeAvailabilityResult(overrides: Partial<SlotAvailabilityResult> = {}): SlotAvailabilityResult {
    return {
        id: 1,
        name: 'Sala A',
        capacity: 10,
        floor_id: 1,
        floor_name: 'Piso 1',
        is_blocked: false,
        is_available: true,
        occupied_by_friends: [],
        ...overrides,
    };
}

function makeMockRepo(overrides: Partial<OfficeSlotsRepo> = {}): OfficeSlotsRepo {
    return {
        findAll: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(makeSlot()),
        findAvailable: vi.fn().mockResolvedValue([]),
        findFriendOccupancy: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(true),
        setBlocked: vi.fn().mockResolvedValue(true),
        floorExists: vi.fn().mockResolvedValue(true),
        ...overrides,
    };
}

const START = '2025-06-01T08:00:00';
const END = '2025-06-01T18:00:00';

// ─── getAvailableSlots ────────────────────────────────────────────────────────

describe('OfficeSlotsService.getAvailableSlots', () => {
    it('retorna slots disponibles sin user_id (sin ocupación de amigos)', async () => {
        const rawSlots = [
            { id: 1, name: 'Sala A', capacity: 10, floor_id: 1, floor_name: 'Piso 1', is_blocked: 0, is_available: 1 },
            { id: 2, name: 'Sala B', capacity: 5, floor_id: 1, floor_name: 'Piso 1', is_blocked: 0, is_available: 1 },
        ];
        const repo = makeMockRepo({ findAvailable: vi.fn().mockResolvedValue(rawSlots) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getAvailableSlots({ start_time: START, end_time: END });
        expect(result).toHaveLength(2);
        expect(repo.findFriendOccupancy).not.toHaveBeenCalled();
    });

    it('consulta ocupación de amigos cuando se proporciona user_id', async () => {
        const rawSlot = { id: 1, name: 'Sala A', capacity: 10, floor_id: 1, floor_name: 'Piso 1', is_blocked: 0, is_available: 1 };
        const friendOccupancy = [{ slot_id: 1, user_id: 'USR00002', user_name: 'Luis', start_time: START, end_time: END }];
        const repo = makeMockRepo({
            findAvailable: vi.fn().mockResolvedValue([rawSlot]),
            findFriendOccupancy: vi.fn().mockResolvedValue(friendOccupancy),
        });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getAvailableSlots({ start_time: START, end_time: END, user_id: 'USR00001' });
        expect(repo.findFriendOccupancy).toHaveBeenCalledWith([1], 'USR00001', START, END);
        expect(result[0].occupied_by_friends).toHaveLength(1);
    });

    it('convierte is_blocked e is_available a booleanos', async () => {
        const rawSlot = { id: 1, name: 'Sala A', capacity: 5, floor_id: 1, floor_name: 'Piso 1', is_blocked: 0, is_available: 1 };
        const repo = makeMockRepo({ findAvailable: vi.fn().mockResolvedValue([rawSlot]) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getAvailableSlots({ start_time: START, end_time: END });
        expect(result[0].is_blocked).toBe(false);
        expect(result[0].is_available).toBe(true);
    });

    it('retorna arreglo vacío si no hay slots', async () => {
        const repo = makeMockRepo({ findAvailable: vi.fn().mockResolvedValue([]) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getAvailableSlots({ start_time: START, end_time: END });
        expect(result).toEqual([]);
        expect(repo.findFriendOccupancy).not.toHaveBeenCalled();
    });

    it('no llama findFriendOccupancy si el arreglo de slots está vacío', async () => {
        const findFriendMock = vi.fn().mockResolvedValue([]);
        const repo = makeMockRepo({
            findAvailable: vi.fn().mockResolvedValue([]),
            findFriendOccupancy: findFriendMock,
        });
        const service = makeOfficeSlotsService(repo);

        await service.getAvailableSlots({ start_time: START, end_time: END, user_id: 'USR00001' });
        expect(findFriendMock).toHaveBeenCalledWith([], 'USR00001', START, END);
    });

    it('pasa floor_id al repo cuando está definido', async () => {
        const findMock = vi.fn().mockResolvedValue([]);
        const repo = makeMockRepo({ findAvailable: findMock });
        const service = makeOfficeSlotsService(repo);

        await service.getAvailableSlots({ start_time: START, end_time: END, floor_id: 2 });
        expect(findMock).toHaveBeenCalledWith(START, END, { floor_id: 2 });
    });
});

// ─── getAllSlots ──────────────────────────────────────────────────────────────

describe('OfficeSlotsService.getAllSlots', () => {
    it('retorna todos los slots', async () => {
        const slots = [makeSlot(), makeSlot({ id: 2, name: 'Sala B' })];
        const repo = makeMockRepo({ findAll: vi.fn().mockResolvedValue(slots) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getAllSlots({});
        expect(result).toHaveLength(2);
        expect(repo.findAll).toHaveBeenCalledWith({});
    });

    it('pasa filtro floor_id al repo', async () => {
        const findAllMock = vi.fn().mockResolvedValue([]);
        const repo = makeMockRepo({ findAll: findAllMock });
        const service = makeOfficeSlotsService(repo);

        await service.getAllSlots({ floor_id: 3 });
        expect(findAllMock).toHaveBeenCalledWith({ floor_id: 3 });
    });

    it('retorna arreglo vacío si no hay slots', async () => {
        const repo = makeMockRepo({ findAll: vi.fn().mockResolvedValue([]) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getAllSlots({});
        expect(result).toEqual([]);
    });
});

// ─── getSlotById ──────────────────────────────────────────────────────────────

describe('OfficeSlotsService.getSlotById', () => {
    it('retorna el slot si existe', async () => {
        const slot = makeSlot();
        const repo = makeMockRepo({ findById: vi.fn().mockResolvedValue(slot) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.getSlotById(1);
        expect(result).toEqual(slot);
        expect(repo.findById).toHaveBeenCalledWith(1);
    });

    it('lanza NotFoundError si el slot no existe', async () => {
        const repo = makeMockRepo({ findById: vi.fn().mockResolvedValue(null) });
        const service = makeOfficeSlotsService(repo);

        await expect(service.getSlotById(999)).rejects.toThrow(NotFoundError);
        await expect(service.getSlotById(999)).rejects.toThrow('999');
    });
});

// ─── createSlot ───────────────────────────────────────────────────────────────

describe('OfficeSlotsService.createSlot', () => {
    const validData = { name: 'Sala Nueva', capacity: 8, floor_id: 1 };

    it('crea el slot y lo retorna si el piso existe', async () => {
        const created = makeSlot({ name: 'Sala Nueva', capacity: 8 });
        const repo = makeMockRepo({
            floorExists: vi.fn().mockResolvedValue(true),
            create: vi.fn().mockResolvedValue(1),
            findById: vi.fn().mockResolvedValue(created),
        });
        const service = makeOfficeSlotsService(repo);

        const result = await service.createSlot(validData);
        expect(result).toEqual(created);
        expect(repo.create).toHaveBeenCalledWith(validData);
    });

    it('lanza UnprocessableError si el piso no existe', async () => {
        const repo = makeMockRepo({ floorExists: vi.fn().mockResolvedValue(false) });
        const service = makeOfficeSlotsService(repo);

        await expect(service.createSlot(validData)).rejects.toThrow(UnprocessableError);
        await expect(service.createSlot(validData)).rejects.toThrow('1');
    });

    it('no llama a repo.create si el piso no existe', async () => {
        const createMock = vi.fn();
        const repo = makeMockRepo({
            floorExists: vi.fn().mockResolvedValue(false),
            create: createMock,
        });
        const service = makeOfficeSlotsService(repo);

        await service.createSlot(validData).catch(() => {});
        expect(createMock).not.toHaveBeenCalled();
    });

    it('verifica la existencia del piso con el floor_id correcto', async () => {
        const floorExistsMock = vi.fn().mockResolvedValue(true);
        const repo = makeMockRepo({ floorExists: floorExistsMock });
        const service = makeOfficeSlotsService(repo);

        await service.createSlot(validData);
        expect(floorExistsMock).toHaveBeenCalledWith(1);
    });
});

// ─── updateSlot ───────────────────────────────────────────────────────────────

describe('OfficeSlotsService.updateSlot', () => {
    it('actualiza y retorna el slot si existe', async () => {
        const updated = makeSlot({ name: 'Sala Renombrada' });
        const repo = makeMockRepo({
            findById: vi.fn().mockResolvedValue(makeSlot()).mockResolvedValueOnce(makeSlot()).mockResolvedValueOnce(updated),
            update: vi.fn().mockResolvedValue(true),
        });
        const service = makeOfficeSlotsService(repo);

        const result = await service.updateSlot(1, { name: 'Sala Renombrada' });
        expect(repo.update).toHaveBeenCalledWith(1, { name: 'Sala Renombrada' });
        expect(result).toEqual(updated);
    });

    it('lanza NotFoundError si el slot no existe', async () => {
        const repo = makeMockRepo({ findById: vi.fn().mockResolvedValue(null) });
        const service = makeOfficeSlotsService(repo);

        await expect(service.updateSlot(999, { name: 'X' })).rejects.toThrow(NotFoundError);
    });

    it('verifica existencia del piso si se actualiza floor_id', async () => {
        const floorExistsMock = vi.fn().mockResolvedValue(true);
        const repo = makeMockRepo({ floorExists: floorExistsMock });
        const service = makeOfficeSlotsService(repo);

        await service.updateSlot(1, { floor_id: 3 });
        expect(floorExistsMock).toHaveBeenCalledWith(3);
    });

    it('lanza UnprocessableError si el nuevo floor_id no existe', async () => {
        const repo = makeMockRepo({
            findById: vi.fn().mockResolvedValue(makeSlot()),
            floorExists: vi.fn().mockResolvedValue(false),
        });
        const service = makeOfficeSlotsService(repo);

        await expect(service.updateSlot(1, { floor_id: 99 })).rejects.toThrow(UnprocessableError);
    });

    it('no verifica piso si floor_id no está en el update', async () => {
        const floorExistsMock = vi.fn();
        const repo = makeMockRepo({ floorExists: floorExistsMock });
        const service = makeOfficeSlotsService(repo);

        await service.updateSlot(1, { name: 'Solo nombre' });
        expect(floorExistsMock).not.toHaveBeenCalled();
    });
});

// ─── deleteSlot ───────────────────────────────────────────────────────────────

describe('OfficeSlotsService.deleteSlot', () => {
    it('elimina el slot y retorna mensaje de confirmación', async () => {
        const repo = makeMockRepo({ remove: vi.fn().mockResolvedValue(true) });
        const service = makeOfficeSlotsService(repo);

        const result = await service.deleteSlot(1);
        expect(result).toEqual({ message: 'Slot 1 eliminado' });
        expect(repo.remove).toHaveBeenCalledWith(1);
    });

    it('lanza NotFoundError si el slot no existe', async () => {
        const repo = makeMockRepo({ findById: vi.fn().mockResolvedValue(null) });
        const service = makeOfficeSlotsService(repo);

        await expect(service.deleteSlot(999)).rejects.toThrow(NotFoundError);
    });

    it('no llama repo.remove si el slot no existe', async () => {
        const removeMock = vi.fn();
        const repo = makeMockRepo({
            findById: vi.fn().mockResolvedValue(null),
            remove: removeMock,
        });
        const service = makeOfficeSlotsService(repo);

        await service.deleteSlot(999).catch(() => {});
        expect(removeMock).not.toHaveBeenCalled();
    });
});

// ─── setBlockStatus ───────────────────────────────────────────────────────────

describe('OfficeSlotsService.setBlockStatus', () => {
    it('bloquea el slot y lo retorna actualizado', async () => {
        const blocked = makeSlot({ is_blocked: true });
        const repo = makeMockRepo({
            setBlocked: vi.fn().mockResolvedValue(true),
            findById: vi.fn()
                .mockResolvedValueOnce(makeSlot())   // getSlotById interno
                .mockResolvedValueOnce(blocked),      // findById al final
        });
        const service = makeOfficeSlotsService(repo);

        const result = await service.setBlockStatus(1, { is_blocked: true });
        expect(repo.setBlocked).toHaveBeenCalledWith(1, true);
        expect(result.is_blocked).toBe(true);
    });

    it('desbloquea el slot cuando is_blocked es false', async () => {
        const unblocked = makeSlot({ is_blocked: false });
        const repo = makeMockRepo({
            setBlocked: vi.fn().mockResolvedValue(true),
            findById: vi.fn()
                .mockResolvedValueOnce(makeSlot({ is_blocked: true }))
                .mockResolvedValueOnce(unblocked),
        });
        const service = makeOfficeSlotsService(repo);

        const result = await service.setBlockStatus(1, { is_blocked: false });
        expect(repo.setBlocked).toHaveBeenCalledWith(1, false);
        expect(result.is_blocked).toBe(false);
    });

    it('lanza NotFoundError si el slot no existe', async () => {
        const repo = makeMockRepo({ findById: vi.fn().mockResolvedValue(null) });
        const service = makeOfficeSlotsService(repo);

        await expect(service.setBlockStatus(999, { is_blocked: true })).rejects.toThrow(NotFoundError);
    });

    it('no llama repo.setBlocked si el slot no existe', async () => {
        const setBlockedMock = vi.fn();
        const repo = makeMockRepo({
            findById: vi.fn().mockResolvedValue(null),
            setBlocked: setBlockedMock,
        });
        const service = makeOfficeSlotsService(repo);

        await service.setBlockStatus(999, { is_blocked: true }).catch(() => {});
        expect(setBlockedMock).not.toHaveBeenCalled();
    });
});
