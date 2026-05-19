import { ReportsRepo } from "./reports.repo.js";
import { Period, AttendanceSummary, ReservationSummary } from "./reports.schema.js";
import { BadRequestError } from "../../shared/errors/AppError.js";

export type ReportsService = {
    getAttendanceStats: (
        userId: string,
        period: Period,
        from?: string,
        to?: string
    ) => Promise<AttendanceSummary>;

    getReservationStats: (
        userId: string,
        period: Period,
        from?: string,
        to?: string
    ) => Promise<ReservationSummary>;
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const resolveRange = (
    period: Period,
    from?: string,
    to?: string
): { from: string; to: string } => {
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
    if (new Date(from) > new Date(to)) {
        throw new BadRequestError("'from' must be earlier than or equal to 'to'");
    }
};

export function makeReportsService(repo: ReportsRepo): ReportsService {

    const getAttendanceStats = async (
        userId: string,
        period: Period,
        from?: string,
        to?: string
    ): Promise<AttendanceSummary> => {
        if (!userId) throw new BadRequestError("userId is required");

        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);

        return repo.getAttendanceStats(userId, period, range.from, range.to);
    };

    const getReservationStats = async (
        userId: string,
        period: Period,
        from?: string,
        to?: string
    ): Promise<ReservationSummary> => {
        if (!userId) throw new BadRequestError("userId is required");

        const range = resolveRange(period, from, to);
        validateDateOrder(range.from, range.to);

        return repo.getReservationStats(userId, period, range.from, range.to);
    };

    return {
        getAttendanceStats,
        getReservationStats,
    };
}