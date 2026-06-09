import { ReportsRepo } from "./reports.repo.js";
import {
    Period,
    AttendanceSummary,
    ReservationSummary,
    GlobalAttendanceSummary,
    GlobalReservationSummary,
    TopUser,
} from "./reports.schema.js";
import { BadRequestError } from "../../shared/errors/AppError.js";

export type ReportsService = {
    getAttendanceStats:      (userId: string, period: Period, from?: string, to?: string) => Promise<AttendanceSummary>;
    getReservationStats:     (userId: string, period: Period, from?: string, to?: string) => Promise<ReservationSummary>;
    getGlobalAttendanceStats:(period: Period, from?: string, to?: string) => Promise<GlobalAttendanceSummary>;
    getGlobalReservationStats:(period: Period, from?: string, to?: string) => Promise<GlobalReservationSummary>;
    getTopUsersByAttendance: (period: Period, from?: string, to?: string, limit?: number) => Promise<TopUser[]>;
    getGlobalAttendanceExport:(period: Period, from?: string, to?: string) => Promise<any[]>;
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const resolveRange = (period: Period, from?: string, to?: string): { from: string; to: string } => {
    const now = new Date();
    const resolvedTo = to ?? toISODate(now);
    if (from) return { from, to: resolvedTo };
    const start = new Date(now);
    if (period === "day")   start.setDate(now.getDate() - 30);
    if (period === "week")  start.setDate(now.getDate() - 84);
    if (period === "month") start.setFullYear(now.getFullYear() - 1);
    return { from: toISODate(start), to: resolvedTo };
};

const validateDateOrder = (from: string, to: string): void => {
    if (new Date(from) > new Date(to))
        throw new BadRequestError("'from' must be earlier than or equal to 'to'");
};

export function makeReportsService(repo: ReportsRepo): ReportsService {

    const getAttendanceStats = async (userId: string, period: Period, from?: string, to?: string) => {
        if (!userId) throw new BadRequestError("userId is required");
        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);
        return repo.getAttendanceStats(userId, period, range.from, range.to);
    };

    const getReservationStats = async (userId: string, period: Period, from?: string, to?: string) => {
        if (!userId) throw new BadRequestError("userId is required");
        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);
        return repo.getReservationStats(userId, period, range.from, range.to);
    };

    const getGlobalAttendanceStats = async (period: Period, from?: string, to?: string) => {
        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);
        return repo.getGlobalAttendanceStats(period, range.from, range.to);
    };

    const getGlobalReservationStats = async (period: Period, from?: string, to?: string) => {
        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);
        return repo.getGlobalReservationStats(period, range.from, range.to);
    };

    const getTopUsersByAttendance = async (period: Period, from?: string, to?: string, limit = 10) => {
        if (limit < 1 || limit > 100) throw new BadRequestError("limit must be between 1 and 100");
        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);
        return repo.getTopUsersByAttendance(period, range.from, range.to, limit);
    };

    const getGlobalAttendanceExport = async (period: Period, from?: string, to?: string) => {
        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);
        return repo.getGlobalAttendanceExport(period, range.from, range.to);
    };

    return {
        getAttendanceStats,
        getReservationStats,
        getGlobalAttendanceStats,
        getGlobalReservationStats,
        getTopUsersByAttendance,
        getGlobalAttendanceExport,
    };
}