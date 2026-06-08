import { Db } from "../../infra/db/db.js";
import { Period, AttendanceSummary, ReservationSummary, ReportsBucket, ReservationBucket } from "./reports.schema.js";

export type ReportsRepo = {
    getAttendanceStats: (userId: string, period: Period, from: string, to: string) => Promise<AttendanceSummary>;
    getReservationStats: (userId: string, period: Period, from: string, to: string) => Promise<ReservationSummary>;
};

const FORMAT_BY_PERIOD: Record<Period, string> = {
    day: "DATE_FORMAT(r.start_time, '%Y-%m-%d')",
    week: "DATE_FORMAT(r.start_time, '%x-W%v')",
    month: "DATE_FORMAT(r.start_time, '%Y-%m')",
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
                SUM(rp.attendance_status IN ('CHECKED_IN', 'CHECKED_OUT')) AS attended,
                SUM(rp.attendance_status = 'NO_SHOW') AS missed,
                SUM(rp.attendance_status IN ('CANCELED', 'REJECTED')) AS canceled,
                SUM(rp.attendance_status NOT IN (
                    'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELED', 'REJECTED'
                )) AS pending
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             WHERE rp.user_id = ?
               AND r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [userId, `${from} 00:00:00`, `${to} 23:59:59`]
        );

        const buckets: ReportsBucket[] = rows.map((r) => {
            const attended = Number(r.attended);
            const total = Number(r.total);
            return {
                period_label: r.period_label,
                total,
                attended,
                missed: Number(r.missed),
                canceled: Number(r.canceled),
                pending: Number(r.pending),
                attendance_rate: total > 0
                    ? Math.round((attended / total) * 100 * 100) / 100
                    : 0,
            };
        });

        const totalAgg = buckets.reduce((s, b) => s + b.total, 0);
        const attendAgg = buckets.reduce((s, b) => s + b.attended, 0);
        const missedAgg = buckets.reduce((s, b) => s + b.missed, 0);
        const canceledAgg = buckets.reduce((s, b) => s + b.canceled, 0);
        const pendingAgg = buckets.reduce((s, b) => s + b.pending, 0);

        return {
            total: totalAgg,
            attended: attendAgg,
            missed: missedAgg,
            canceled: canceledAgg,
            pending: pendingAgg,
            attendance_rate: totalAgg > 0
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
                SUM(r.attendance_status IN ('CHECKED_IN', 'CHECKED_OUT')) AS checked_in,
                SUM(r.attendance_status = 'NO_SHOW') AS not_checked_in,
                SUM(r.attendance_status = 'CANCELED') AS canceled,
                SUM(r.attendance_status = 'NOT_ARRIVED') AS pending
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             WHERE rp.user_id = ?
               AND r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [userId, `${from} 00:00:00`, `${to} 23:59:59`]
        );

        const buckets: ReservationBucket[] = rows.map((r) => ({
            period_label: r.period_label,
            total: Number(r.total),
            checked_in: Number(r.checked_in),
            not_checked_in: Number(r.not_checked_in),
            canceled: Number(r.canceled),
            pending: Number(r.pending),
        }));

        const totalAgg = buckets.reduce((s, b) => s + b.total, 0);
        const checkedAgg = buckets.reduce((s, b) => s + b.checked_in, 0);
        const notCheckedAgg = buckets.reduce((s, b) => s + b.not_checked_in, 0);
        const canceledAgg = buckets.reduce((s, b) => s + b.canceled, 0);
        const pendingAgg = buckets.reduce((s, b) => s + b.pending, 0);

        return {
            total: totalAgg,
            checked_in: checkedAgg,
            not_checked_in: notCheckedAgg,
            canceled: canceledAgg,
            pending: pendingAgg,
            buckets,
        };
    };

    return {
        getAttendanceStats,
        getReservationStats,
    };
}