import { describe, it, expect } from 'vitest';
import {
    ParkingLotSchema,
    CreateParkingLotSchema,
    UpdateParkingLotSchema,
    ParkingReservationSchema,
    CreateParkingReservationSchema,
    ListReservationsQuerySchema,
    ReservationBucketsQuerySchema,
    PatchAttendanceSchema,
    AttendanceStatusSchema,
    LifecycleStatusSchema,
    inferLifecycleStatus,
} from '../../../src/modules/parking-slots/parking-slots.schema';

describe('AttendanceStatusSchema / LifecycleStatusSchema', () => {
    it('acepta todos los estados de asistencia', () => {
        ['NOT_ARRIVED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELED'].forEach((s) =>
            expect(AttendanceStatusSchema.safeParse(s).success).toBe(true),
        );
    });

    it('acepta todos los lifecycle statuses', () => {
        ['ACTIVE', 'CANCELED', 'FINALIZED'].forEach((s) =>
            expect(LifecycleStatusSchema.safeParse(s).success).toBe(true),
        );
    });
});

describe('inferLifecycleStatus', () => {
    it('mapea attendance a lifecycle correctamente', () => {
        expect(inferLifecycleStatus('NOT_ARRIVED')).toBe('ACTIVE');
        expect(inferLifecycleStatus('CHECKED_IN')).toBe('ACTIVE');
        expect(inferLifecycleStatus('CANCELED')).toBe('CANCELED');
        expect(inferLifecycleStatus('CHECKED_OUT')).toBe('FINALIZED');
        expect(inferLifecycleStatus('NO_SHOW')).toBe('FINALIZED');
    });
});

describe('ParkingLotSchema', () => {
    it('acepta un cajón válido', () => {
        const result = ParkingLotSchema.safeParse({ id: 1, name: 'Lot A', capacity: 10, priority: 1 });
        expect(result.success).toBe(true);
    });

    it('rechaza capacidad negativa', () => {
        const result = ParkingLotSchema.safeParse({ id: 1, name: 'Lot A', capacity: -1, priority: 1 });
        expect(result.success).toBe(false);
    });

    it('rechaza nombre vacío', () => {
        const result = CreateParkingLotSchema.safeParse({ name: '', capacity: 5, priority: 0 });
        expect(result.success).toBe(false);
    });
});

describe('UpdateParkingLotSchema', () => {
    it('acepta un update parcial', () => {
        expect(UpdateParkingLotSchema.safeParse({ capacity: 20 }).success).toBe(true);
        expect(UpdateParkingLotSchema.safeParse({}).success).toBe(true);
    });
});

describe('CreateParkingReservationSchema', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const dayAfter = new Date(Date.now() + 172800000).toISOString();

    it('acepta rango válido', () => {
        const result = CreateParkingReservationSchema.safeParse({
            start_time: tomorrow,
            end_time: dayAfter,
        });
        expect(result.success).toBe(true);
    });

    it('rechaza cuando end_time <= start_time', () => {
        const result = CreateParkingReservationSchema.safeParse({
            start_time: dayAfter,
            end_time: tomorrow,
        });
        expect(result.success).toBe(false);
    });
});

describe('ListReservationsQuerySchema', () => {
    it('acepta query vacía con defaults', () => {
        const result = ListReservationsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data?.include).toEqual([]);
        expect(result.data?.cursor).toBeNull();
    });

    it('acepta include=parking_lot como csv', () => {
        const result = ListReservationsQuerySchema.safeParse({ include: 'parking_lot' });
        expect(result.success).toBe(true);
        expect(result.data?.include).toContain('parking_lot');
    });

    it('lanza al parsear include con valor inválido (transform usa .parse interno)', () => {
        expect(() => ListReservationsQuerySchema.safeParse({ include: 'unknown_value' })).toThrow();
    });
});

describe('ReservationBucketsQuerySchema', () => {
    const t1 = new Date('2024-01-01T08:00:00Z').toISOString();
    const t2 = new Date('2024-01-01T10:00:00Z').toISOString();

    it('acepta parámetros válidos con step por defecto', () => {
        const result = ReservationBucketsQuerySchema.safeParse({ start_time: t1, end_time: t2 });
        expect(result.success).toBe(true);
        expect(result.data?.step_minutes).toBe('15');
    });

    it('rechaza si end_time <= start_time', () => {
        const result = ReservationBucketsQuerySchema.safeParse({ start_time: t2, end_time: t1 });
        expect(result.success).toBe(false);
    });
});

describe('PatchAttendanceSchema', () => {
    it('acepta status válido', () => {
        expect(PatchAttendanceSchema.safeParse({ attendance_status: 'CHECKED_IN' }).success).toBe(true);
    });

    it('rechaza status inválido', () => {
        expect(PatchAttendanceSchema.safeParse({ attendance_status: 'UNKNOWN' }).success).toBe(false);
    });
});
