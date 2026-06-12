import { describe, it, expect } from 'vitest';
import {
    PeriodSchema,
    ReportsQuerySchema,
    GlobalReportsQuerySchema,
    ReportsBucketSchema,
    AttendanceSummarySchema,
} from '../../../src/modules/reports/reports.schema';

describe('PeriodSchema', () => {
    it('acepta day, week, month', () => {
        ['day', 'week', 'month'].forEach((p) =>
            expect(PeriodSchema.safeParse(p).success).toBe(true),
        );
    });

    it('rechaza valores no válidos', () => {
        expect(PeriodSchema.safeParse('year').success).toBe(false);
    });
});

describe('ReportsQuerySchema', () => {
    it('acepta query válida con defaults', () => {
        const result = ReportsQuerySchema.safeParse({ userId: 'USR0001' });
        expect(result.success).toBe(true);
        expect(result.data?.period).toBe('week');
    });

    it('acepta from y to en formato YYYY-MM-DD', () => {
        const result = ReportsQuerySchema.safeParse({
            userId: 'USR0001',
            period: 'day',
            from: '2024-01-01',
            to: '2024-01-31',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza userId vacío', () => {
        expect(ReportsQuerySchema.safeParse({ userId: '' }).success).toBe(false);
    });

    it('rechaza from con formato incorrecto', () => {
        const result = ReportsQuerySchema.safeParse({ userId: 'USR0001', from: '01-01-2024' });
        expect(result.success).toBe(false);
    });

    it('rechaza userId mayor a 8 chars', () => {
        expect(ReportsQuerySchema.safeParse({ userId: 'USR000123456' }).success).toBe(false);
    });
});

describe('GlobalReportsQuerySchema', () => {
    it('acepta query vacía con defaults', () => {
        const result = GlobalReportsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data?.period).toBe('week');
    });
});

describe('ReportsBucketSchema', () => {
    it('acepta un bucket válido', () => {
        const result = ReportsBucketSchema.safeParse({
            period_label: '2024-W01',
            total: 10,
            attended: 8,
            missed: 1,
            pending: 1,
            canceled: 0,
            attendance_rate: 0.8,
        });
        expect(result.success).toBe(true);
    });
});

describe('AttendanceSummarySchema', () => {
    it('acepta un summary válido con buckets', () => {
        const result = AttendanceSummarySchema.safeParse({
            total: 10,
            attended: 8,
            missed: 1,
            pending: 1,
            canceled: 0,
            attendance_rate: 0.8,
            buckets: [],
        });
        expect(result.success).toBe(true);
    });
});
