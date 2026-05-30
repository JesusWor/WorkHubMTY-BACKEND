import { describe, it, expect } from 'vitest';
import {
    ListReservationsQuerySchema,
    ListReservationsCursorSchema,
} from '../../../src/modules/parking-slots/parking-slots.schema.js';

describe('ListReservationsCursorSchema', () => {
    it('acepta un cursor valido', () => {
        expect(ListReservationsCursorSchema.safeParse({ lastId: 10 }).success).toBe(true);
    });

    it('falla si lastId no es positivo', () => {
        expect(ListReservationsCursorSchema.safeParse({ lastId: 0 }).success).toBe(false);
    });
});

describe('ListReservationsQuerySchema', () => {
    it('deja limit opcional y cursor en null por defecto', () => {
        const result = ListReservationsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data?.limit).toBeUndefined();
        expect(result.data?.cursor).toBeNull();
    });

    it('acepta cursor encoded como string', () => {
        const result = ListReservationsQuerySchema.safeParse({ cursor: 'eyJsYXN0SWQiOjF9' });
        expect(result.success).toBe(true);
        expect(result.data?.cursor).toBe('eyJsYXN0SWQiOjF9');
    });

    it('acepta limit fuera de rango en schema para delegar la validacion al service', () => {
        const result = ListReservationsQuerySchema.safeParse({ limit: 0 });
        expect(result.success).toBe(true);
        expect(result.data?.limit).toBe(0);
    });

    it('rechaza un cursor no string', () => {
        expect(ListReservationsQuerySchema.safeParse({ cursor: 123 }).success).toBe(false);
    });
});
