/**
 * NOTA SOBRE INTEGRACIÓN — office-slots solo tiene tests unitarios.
 *
 * El schema del código define `is_blocked: z.boolean()` en OfficeSlotSchema,
 * pero la tabla `reservables` en el dump SQL NO tiene esa columna.
 * Además, findFriendOccupancy y getUserStats del repo referencian una tabla
 * `friends` con columna `status='accepted'` que tampoco existe (la tabla real
 * se llama `friendships` y no tiene esa columna).
 *
 * Mientras esas discrepancias no se resuelvan en el schema de DB, los tests
 * de integración fallarían en runtime. Se dejan solo tests unitarios (schema
 * y servicio) que no tocan la base de datos.
 */

import { describe, it, expect } from 'vitest';
import {
    OfficeSlotSchema,
    FloorSchema,
    CreateOfficeSlotSchema,
    UpdateOfficeSlotSchema,
    BlockSlotBodySchema,
    AvailableOfficeSlotsSchema,
    SlotAvailabilityResultSchema,
    FriendOccupancySchema,
} from '../../../src/modules/office-slots/office-slots.schema';

// ─── OfficeSlotSchema ─────────────────────────────────────────────────────────

describe('OfficeSlotSchema', () => {
    const valid = { id: 1, name: 'Sala A', capacity: 10, floor_id: 1, is_blocked: false };

    it('acepta un slot válido', () => {
        expect(OfficeSlotSchema.safeParse(valid).success).toBe(true);
    });

    it('acepta is_blocked true', () => {
        expect(OfficeSlotSchema.safeParse({ ...valid, is_blocked: true }).success).toBe(true);
    });

    it('falla si id no es número', () => {
        expect(OfficeSlotSchema.safeParse({ ...valid, id: 'uno' }).success).toBe(false);
    });

    it('falla si capacity no es número', () => {
        expect(OfficeSlotSchema.safeParse({ ...valid, capacity: '10' }).success).toBe(false);
    });

    it('falla si is_blocked no es booleano', () => {
        expect(OfficeSlotSchema.safeParse({ ...valid, is_blocked: 1 }).success).toBe(false);
    });

    it('falla si name está ausente', () => {
        const { name: _, ...noName } = valid;
        expect(OfficeSlotSchema.safeParse(noName).success).toBe(false);
    });

    it('falla si floor_id está ausente', () => {
        const { floor_id: _, ...noFloor } = valid;
        expect(OfficeSlotSchema.safeParse(noFloor).success).toBe(false);
    });
});

// ─── FloorSchema ──────────────────────────────────────────────────────────────

describe('FloorSchema', () => {
    const valid = { id: 1, name: 'Piso 1', floor_number: 1 };

    it('acepta un piso válido', () => {
        expect(FloorSchema.safeParse(valid).success).toBe(true);
    });

    it('falla si floor_number no es número', () => {
        expect(FloorSchema.safeParse({ ...valid, floor_number: 'uno' }).success).toBe(false);
    });

    it('falla si name no es string', () => {
        expect(FloorSchema.safeParse({ ...valid, name: 123 }).success).toBe(false);
    });

    it('falla si faltan todos los campos', () => {
        const result = FloorSchema.safeParse({});
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('id');
        expect(fields).toContain('name');
        expect(fields).toContain('floor_number');
    });
});

// ─── CreateOfficeSlotSchema ───────────────────────────────────────────────────

describe('CreateOfficeSlotSchema', () => {
    const valid = { name: 'Sala B', capacity: 5, floor_id: 2 };

    it('acepta un body de creación válido', () => {
        expect(CreateOfficeSlotSchema.safeParse(valid).success).toBe(true);
    });

    it('falla si name está vacío', () => {
        expect(CreateOfficeSlotSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    });

    it('falla si capacity es 0', () => {
        expect(CreateOfficeSlotSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
    });

    it('falla si capacity es negativo', () => {
        expect(CreateOfficeSlotSchema.safeParse({ ...valid, capacity: -1 }).success).toBe(false);
    });

    it('falla si capacity no es entero', () => {
        expect(CreateOfficeSlotSchema.safeParse({ ...valid, capacity: 2.5 }).success).toBe(false);
    });

    it('falla si floor_id no es entero', () => {
        expect(CreateOfficeSlotSchema.safeParse({ ...valid, floor_id: 1.5 }).success).toBe(false);
    });

    it('falla si faltan todos los campos', () => {
        const result = CreateOfficeSlotSchema.safeParse({});
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('name');
        expect(fields).toContain('capacity');
        expect(fields).toContain('floor_id');
    });
});

// ─── UpdateOfficeSlotSchema ───────────────────────────────────────────────────

describe('UpdateOfficeSlotSchema', () => {
    it('acepta un body completamente vacío (todo opcional)', () => {
        expect(UpdateOfficeSlotSchema.safeParse({}).success).toBe(true);
    });

    it('acepta solo name', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ name: 'Sala C' }).success).toBe(true);
    });

    it('acepta solo capacity', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ capacity: 8 }).success).toBe(true);
    });

    it('acepta solo floor_id', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ floor_id: 3 }).success).toBe(true);
    });

    it('acepta los tres campos juntos', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ name: 'X', capacity: 3, floor_id: 1 }).success).toBe(true);
    });

    it('falla si name está presente pero vacío', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('falla si capacity es 0', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ capacity: 0 }).success).toBe(false);
    });

    it('falla si capacity es negativo', () => {
        expect(UpdateOfficeSlotSchema.safeParse({ capacity: -2 }).success).toBe(false);
    });
});

// ─── BlockSlotBodySchema ──────────────────────────────────────────────────────

describe('BlockSlotBodySchema', () => {
    it('acepta is_blocked true sin reason', () => {
        expect(BlockSlotBodySchema.safeParse({ is_blocked: true }).success).toBe(true);
    });

    it('acepta is_blocked false sin reason', () => {
        expect(BlockSlotBodySchema.safeParse({ is_blocked: false }).success).toBe(true);
    });

    it('acepta is_blocked con reason', () => {
        expect(BlockSlotBodySchema.safeParse({ is_blocked: true, reason: 'Mantenimiento' }).success).toBe(true);
    });

    it('falla si is_blocked está ausente', () => {
        expect(BlockSlotBodySchema.safeParse({}).success).toBe(false);
    });

    it('falla si is_blocked no es booleano', () => {
        expect(BlockSlotBodySchema.safeParse({ is_blocked: 1 }).success).toBe(false);
        expect(BlockSlotBodySchema.safeParse({ is_blocked: 'true' }).success).toBe(false);
    });
});

// ─── AvailableOfficeSlotsSchema ───────────────────────────────────────────────

describe('AvailableOfficeSlotsSchema', () => {
    const START = '2025-06-01T08:00:00';
    const END = '2025-06-01T18:00:00';

    it('acepta query válida con solo start_time y end_time', () => {
        expect(AvailableOfficeSlotsSchema.safeParse({ start_time: START, end_time: END }).success).toBe(true);
    });

    it('acepta query con floor_id y user_id opcionales', () => {
        const result = AvailableOfficeSlotsSchema.safeParse({
            start_time: START,
            end_time: END,
            floor_id: 1,
            user_id: 'USR00001',
        });
        expect(result.success).toBe(true);
    });

    it('acepta floor_id como string numérico (coerce)', () => {
        const result = AvailableOfficeSlotsSchema.safeParse({
            start_time: START,
            end_time: END,
            floor_id: '2',
        });
        expect(result.success).toBe(true);
        expect(result.data?.floor_id).toBe(2);
    });

    it('falla si end_time es anterior a start_time (refine)', () => {
        const result = AvailableOfficeSlotsSchema.safeParse({ start_time: END, end_time: START });
        expect(result.success).toBe(false);
        expect(result.error!.issues[0].message).toBe('end_time must be after start_time');
    });

    it('falla si end_time es igual a start_time (refine)', () => {
        expect(AvailableOfficeSlotsSchema.safeParse({ start_time: START, end_time: START }).success).toBe(false);
    });

    it('falla si start_time está ausente', () => {
        const result = AvailableOfficeSlotsSchema.safeParse({ end_time: END });
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('start_time');
    });

    it('falla si end_time está ausente', () => {
        const result = AvailableOfficeSlotsSchema.safeParse({ start_time: START });
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('end_time');
    });
});

// ─── FriendOccupancySchema ────────────────────────────────────────────────────

describe('FriendOccupancySchema', () => {
    const valid = {
        user_id: 'USR00001',
        user_name: 'Ana Test',
        start_time: '2025-06-01T08:00:00',
        end_time: '2025-06-01T18:00:00',
    };

    it('acepta un objeto válido', () => {
        expect(FriendOccupancySchema.safeParse(valid).success).toBe(true);
    });

    it('coerce string a Date en start_time', () => {
        const result = FriendOccupancySchema.safeParse(valid);
        expect(result.success).toBe(true);
        expect(result.data?.start_time).toBeInstanceOf(Date);
    });

    it('falla si user_id está ausente', () => {
        const { user_id: _, ...noId } = valid;
        expect(FriendOccupancySchema.safeParse(noId).success).toBe(false);
    });

    it('falla si start_time no es fecha válida', () => {
        expect(FriendOccupancySchema.safeParse({ ...valid, start_time: 'not-a-date' }).success).toBe(false);
    });
});

// ─── SlotAvailabilityResultSchema ─────────────────────────────────────────────

describe('SlotAvailabilityResultSchema', () => {
    const valid = {
        id: 1,
        name: 'Sala A',
        capacity: 10,
        floor_id: 1,
        floor_name: 'Piso 1',
        is_blocked: false,
        is_available: true,
        occupied_by_friends: [],
    };

    it('acepta un resultado de disponibilidad válido', () => {
        expect(SlotAvailabilityResultSchema.safeParse(valid).success).toBe(true);
    });

    it('acepta occupied_by_friends con elementos', () => {
        const result = SlotAvailabilityResultSchema.safeParse({
            ...valid,
            occupied_by_friends: [{
                user_id: 'USR00002',
                user_name: 'Luis',
                start_time: '2025-06-01T08:00:00',
                end_time: '2025-06-01T10:00:00',
            }],
        });
        expect(result.success).toBe(true);
    });

    it('falla si is_available no es booleano', () => {
        expect(SlotAvailabilityResultSchema.safeParse({ ...valid, is_available: 1 }).success).toBe(false);
    });

    it('falla si occupied_by_friends no es arreglo', () => {
        expect(SlotAvailabilityResultSchema.safeParse({ ...valid, occupied_by_friends: null }).success).toBe(false);
    });

    it('falla si floor_name está ausente', () => {
        const { floor_name: _, ...noFloor } = valid;
        expect(SlotAvailabilityResultSchema.safeParse(noFloor).success).toBe(false);
    });
});
