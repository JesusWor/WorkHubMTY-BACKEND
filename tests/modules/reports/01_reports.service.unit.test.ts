import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReportsService } from '../../../src/modules/reports/reports.service';
import { BadRequestError } from '../../../src/shared/errors/AppError';
import type { ReportsRepo } from '../../../src/modules/reports/reports.repo';

const fakeSummary = {
    total: 5,
    attended: 4,
    missed: 1,
    pending: 0,
    canceled: 0,
    attendance_rate: 0.8,
    buckets: [],
};

function makeRepo(overrides: Partial<ReportsRepo> = {}): ReportsRepo {
    return {
        getAttendanceStats: vi.fn().mockResolvedValue(fakeSummary),
        getReservationStats: vi.fn().mockResolvedValue({ ...fakeSummary, checked_in: 4, not_checked_in: 1 }),
        getGlobalAttendanceStats: vi.fn().mockResolvedValue(fakeSummary),
        getGlobalReservationStats: vi.fn().mockResolvedValue(fakeSummary),
        getTopUsersByAttendance: vi.fn().mockResolvedValue([]),
        getGlobalAttendanceExport: vi.fn().mockResolvedValue([]),
        ...overrides,
    } as unknown as ReportsRepo;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ReportsService.getAttendanceStats', () => {
    it('lanza BadRequestError si userId está vacío', async () => {
        const service = makeReportsService(makeRepo());
        await expect(service.getAttendanceStats('', 'week')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('llama al repo con rango resuelto', async () => {
        const repo = makeRepo();
        const service = makeReportsService(repo);
        await service.getAttendanceStats('USR00001', 'week', '2024-01-01', '2024-01-31');
        expect(repo.getAttendanceStats).toHaveBeenCalledWith(
            'USR00001',
            'week',
            '2024-01-01',
            '2024-01-31',
        );
    });

    it('lanza BadRequestError si from > to', async () => {
        const service = makeReportsService(makeRepo());
        await expect(
            service.getAttendanceStats('USR00001', 'week', '2024-02-01', '2024-01-01'),
        ).rejects.toBeInstanceOf(BadRequestError);
    });
});

describe('ReportsService.getReservationStats', () => {
    it('lanza BadRequestError si userId está vacío', async () => {
        const service = makeReportsService(makeRepo());
        await expect(service.getReservationStats('', 'day')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('llama al repo correctamente', async () => {
        const repo = makeRepo();
        const service = makeReportsService(repo);
        await service.getReservationStats('USR00001', 'month', '2024-01-01', '2024-12-31');
        expect(repo.getReservationStats).toHaveBeenCalledWith(
            'USR00001',
            'month',
            '2024-01-01',
            '2024-12-31',
        );
    });
});

describe('ReportsService.getTopUsersByAttendance', () => {
    it('lanza BadRequestError si limit < 1', async () => {
        const service = makeReportsService(makeRepo());
        await expect(service.getTopUsersByAttendance('week', undefined, undefined, 0)).rejects.toBeInstanceOf(BadRequestError);
    });

    it('lanza BadRequestError si limit > 100', async () => {
        const service = makeReportsService(makeRepo());
        await expect(service.getTopUsersByAttendance('week', undefined, undefined, 101)).rejects.toBeInstanceOf(BadRequestError);
    });

    it('llama al repo con limit por defecto de 10', async () => {
        const repo = makeRepo();
        const service = makeReportsService(repo);
        await service.getTopUsersByAttendance('week', '2024-01-01', '2024-01-31');
        expect(repo.getTopUsersByAttendance).toHaveBeenCalledWith(
            'week',
            '2024-01-01',
            '2024-01-31',
            10,
        );
    });
});

describe('ReportsService.getGlobalAttendanceStats', () => {
    it('llama al repo con el rango resuelto', async () => {
        const repo = makeRepo();
        const service = makeReportsService(repo);
        await service.getGlobalAttendanceStats('day', '2024-01-01', '2024-01-07');
        expect(repo.getGlobalAttendanceStats).toHaveBeenCalledWith('day', '2024-01-01', '2024-01-07');
    });
});
