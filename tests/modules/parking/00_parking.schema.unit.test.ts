import { describe, it, expect } from 'vitest';
import {
    ParkingReservationSchema,
    CreateParkingReservationSchema,
    ReassignParkingReservationSchema,
    ParkingIdParamSchema,
    ParkingAvailabilityQuerySchema,
    ParkingReservationCountSchema,
} from '../../../src/modules/parking-slots/parking-slots.schema';

describe('ParkingReservationCountSchema', () => {
    const valid = { id: 1, name: 'Lote A', capacity: 10, reservedCount: 3 };

    it('acepta un objeto válido', () => {
        expect(ParkingReservationCountSchema.safeParse(valid).success).toBe(true);
    });

    it('falla si capacity es negativo', () => {
        expect(ParkingReservationCountSchema.safeParse({ ...valid, capacity: -1 }).success).toBe(false);
    });

    it('falla si reservedCount es negativo', () => {
        expect(ParkingReservationCountSchema.safeParse({ ...valid, reservedCount: -1 }).success).toBe(false);
    });

    it('falla si falta name', () => {
        const { name: _, ...rest } = valid;
        expect(ParkingReservationCountSchema.safeParse(rest).success).toBe(false);
    });
});

describe('ParkingReservationSchema', () => {
    const valid = {
        id: 1,
        parking_lot_id: 2,
        user_id: 'USR00001',
        start_time: '2025-06-01T08:00:00',
        end_time: '2025-06-01T18:00:00',
        checked_in: 0,
    };

    it('acepta un objeto válido y convierte checked_in a boolean', () => {
        const result = ParkingReservationSchema.safeParse(valid);
        expect(result.success).toBe(true);
        expect(result.data?.checked_in).toBe(false);
    });

    it('convierte checked_in = 1 a true', () => {
        const result = ParkingReservationSchema.safeParse({ ...valid, checked_in: 1 });
        expect(result.success).toBe(true);
        expect(result.data?.checked_in).toBe(true);
    });

    it('falla si user_id está vacío', () => {
        const result = ParkingReservationSchema.safeParse({ ...valid, user_id: '' });
        expect(result.success).toBe(false);
        expect(result.error!.issues[0].message).toBe('El e_id es requerido');
    });

    it('falla si user_id supera 8 caracteres', () => {
        const result = ParkingReservationSchema.safeParse({ ...valid, user_id: 'TOOLONGID' });
        expect(result.success).toBe(false);
        expect(result.error!.issues[0].message).toBe('El e_id no puede superar 8 caracteres');
    });

    it('falla si faltan campos requeridos', () => {
        const result = ParkingReservationSchema.safeParse({ id: 1 });
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('parking_lot_id');
        expect(fields).toContain('user_id');
        expect(fields).toContain('start_time');
        expect(fields).toContain('end_time');
    });
});

describe('CreateParkingReservationSchema', () => {
    const valid = {
        start_time: '2025-06-01T08:00:00',
        end_time: '2025-06-01T18:00:00',
    };

    it('acepta tiempos válidos', () => {
        expect(CreateParkingReservationSchema.safeParse(valid).success).toBe(true);
    });

    it('falla si end_time es igual a start_time', () => {
        const result = CreateParkingReservationSchema.safeParse({
            start_time: '2025-06-01T08:00:00',
            end_time: '2025-06-01T08:00:00',
        });
        expect(result.success).toBe(false);
    });

    it('falla si end_time es anterior a start_time', () => {
        const result = CreateParkingReservationSchema.safeParse({
            start_time: '2025-06-01T18:00:00',
            end_time: '2025-06-01T08:00:00',
        });
        expect(result.success).toBe(false);
        expect(result.error!.issues[0].message).toBe('end_time debe ser posterior a start_time');
    });

    it('falla si falta start_time', () => {
        const result = CreateParkingReservationSchema.safeParse({ end_time: valid.end_time });
        expect(result.success).toBe(false);
    });

    it('no incluye user_id ni parking_lot_id ni checked_in', () => {
        const result = CreateParkingReservationSchema.safeParse({
            ...valid,
            user_id: 'USR00001',
            parking_lot_id: 1,
            checked_in: 0,
        });
        // Should still succeed — extra keys are stripped
        expect(result.success).toBe(true);
        expect((result.data as any).user_id).toBeUndefined();
        expect((result.data as any).parking_lot_id).toBeUndefined();
    });
});

describe('ReassignParkingReservationSchema', () => {
    it('acepta un parking_lot_id positivo', () => {
        expect(ReassignParkingReservationSchema.safeParse({ parking_lot_id: 3 }).success).toBe(true);
    });

    it('falla si parking_lot_id es 0', () => {
        expect(ReassignParkingReservationSchema.safeParse({ parking_lot_id: 0 }).success).toBe(false);
    });

    it('falla si parking_lot_id es negativo', () => {
        expect(ReassignParkingReservationSchema.safeParse({ parking_lot_id: -1 }).success).toBe(false);
    });

    it('falla si parking_lot_id no es número', () => {
        expect(ReassignParkingReservationSchema.safeParse({ parking_lot_id: 'A' }).success).toBe(false);
    });

    it('falla si el campo está ausente', () => {
        expect(ReassignParkingReservationSchema.safeParse({}).success).toBe(false);
    });
});

describe('ParkingIdParamSchema', () => {
    it('acepta un id numérico positivo', () => {
        expect(ParkingIdParamSchema.safeParse({ id: 5 }).success).toBe(true);
    });

    it('coerce string a número', () => {
        const result = ParkingIdParamSchema.safeParse({ id: '5' });
        expect(result.success).toBe(true);
        expect(result.data?.id).toBe(5);
    });

    it('falla si id es 0', () => {
        expect(ParkingIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
    });

    it('falla si id es negativo', () => {
        expect(ParkingIdParamSchema.safeParse({ id: -3 }).success).toBe(false);
    });

    it('falla si id no es parseable como número', () => {
        expect(ParkingIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
    });
});

describe('ParkingAvailabilityQuerySchema', () => {
    const valid = {
        start_time: '2025-06-01T08:00:00',
        end_time: '2025-06-01T18:00:00',
    };

    it('acepta query válida', () => {
        expect(ParkingAvailabilityQuerySchema.safeParse(valid).success).toBe(true);
    });

    it('falla si end_time es anterior a start_time', () => {
        const result = ParkingAvailabilityQuerySchema.safeParse({
            start_time: '2025-06-01T18:00:00',
            end_time: '2025-06-01T08:00:00',
        });
        expect(result.success).toBe(false);
        expect(result.error!.issues[0].message).toBe('end_time debe ser posterior a start_time');
    });

    it('falla si start_time está vacío', () => {
        const result = ParkingAvailabilityQuerySchema.safeParse({ ...valid, start_time: '' });
        expect(result.success).toBe(false);
    });

    it('falla si falta end_time', () => {
        const result = ParkingAvailabilityQuerySchema.safeParse({ start_time: valid.start_time });
        expect(result.success).toBe(false);
    });
});
