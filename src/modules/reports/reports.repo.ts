import { Db } from "../../infra/db/db.js";
import { Period, AttendanceSummary, ReservationSummary, ReportsBucket, ReservationBucket,} from "./reports.schema.js";

export type ReportsRepo = {
    getAttendanceStats: (userId: string, period: Period, from: string, to: string) => Promise<AttendanceSummary>;
    getReservationStats: (userId: string, period: Period, from: string, to: string) => Promise<ReservationSummary>;
};

const FORMAT_BY_PERIOD: Record<Period, string> = {
    day: "DATE_FORMAT(start_time, '%Y-%m-%d')",
    week: "DATE_FORMAT(start_time, '%x-W%v')",
    month: "DATE_FORMAT(start_time, '%Y-%m')",
};

export function makeReportsRepo(db: Db): ReportsRepo {
    const getAttendanceStats = async (
        userId: string,
        period: Period,
        from: string,
        to: string
    ): Promise<AttendanceSummary> => {

        const fmt = FORMAT_BY_PERIOD[period];

        const { rows } = await db.query(
            `SELECT
                ${fmt} AS period_label,
                COUNT(*) AS total,
                SUM(checked_in = 1) AS attended,
                SUM(checked_in = 0) AS missed
             FROM reservations
             WHERE user_id = ?
               AND start_time >= ?
               AND start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [userId, `${from} 00:00:00`, `${to} 23:59:59`]
        );

        const buckets: ReportsBucket[] = rows.map((r) => ({
            period_label: r.period_label,
            total: Number(r.total),
            attended: Number(r.attended),
            missed: Number(r.missed),
            attendance_rate:
                Number(r.total) > 0
                    ? Math.round((Number(r.attended) / Number(r.total)) * 100 * 100) / 100
                    : 0,
        }));

        const totalAgg = buckets.reduce((s, b) => s + b.total, 0);
        const attendAgg = buckets.reduce((s, b) => s + b.attended, 0);
        const missedAgg = buckets.reduce((s, b) => s + b.missed, 0);

        return {
            total: totalAgg,
            attended: attendAgg,
            missed: missedAgg,
            attendance_rate:
                totalAgg > 0
                    ? Math.round((attendAgg / totalAgg) * 100 * 100) / 100
                    : 0,
            buckets,
        };
    };

    const getReservationStats = async (
        userId: string,
        period: Period,
        from: string,
        to: string
    ): Promise<ReservationSummary> => {

        const fmt = FORMAT_BY_PERIOD[period];

        const { rows } = await db.query(
            `SELECT
                ${fmt} AS period_label,
                COUNT(*) AS total,
                SUM(checked_in = 1) AS checked_in,
                SUM(checked_in = 0) AS not_checked_in
             FROM reservations
             WHERE user_id = ?
               AND start_time >= ?
               AND start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [userId, `${from} 00:00:00`, `${to} 23:59:59`]
        );

        const buckets: ReservationBucket[] = rows.map((r) => ({
            period_label: r.period_label,
            total: Number(r.total),
            checked_in: Number(r.checked_in),
            not_checked_in: Number(r.not_checked_in),
        }));

        const totalAgg = buckets.reduce((s, b) => s + b.total, 0);
        const checkedAgg = buckets.reduce((s, b) => s + b.checked_in, 0);
        const notCheckedAgg = buckets.reduce((s, b) => s + b.not_checked_in, 0);

        return {
            total: totalAgg,
            checked_in: checkedAgg,
            not_checked_in: notCheckedAgg,
            buckets,
        };
    };

    return {
        getAttendanceStats,
        getReservationStats,
    };
}