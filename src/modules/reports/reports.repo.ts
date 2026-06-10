import { Db } from "../../infra/db/db.js";
import {
    Period,
    AttendanceSummary,
    ReservationSummary,
    ReportsBucket,
    ReservationBucket,
    GlobalAttendanceSummary,
    GlobalReservationSummary,
    TopUser,
} from "./reports.schema.js";

export type ReportsRepo = {
    getAttendanceStats: (userId: string, period: Period, from: string, to: string) => Promise<AttendanceSummary>;
    getReservationStats: (userId: string, period: Period, from: string, to: string) => Promise<ReservationSummary>;
    getGlobalAttendanceStats: (period: Period, from: string, to: string) => Promise<GlobalAttendanceSummary>;
    getGlobalReservationStats: (period: Period, from: string, to: string) => Promise<GlobalReservationSummary>;
    getTopUsersByAttendance: (period: Period, from: string, to: string, limit: number) => Promise<TopUser[]>;
    getGlobalAttendanceExport: (period: Period, from: string, to: string) => Promise<any[]>;
};

const FORMAT_BY_PERIOD: Record<Period, string> = {
    day:   "DATE_FORMAT(r.start_time, '%Y-%m-%d')",
    week:  "DATE_FORMAT(r.start_time, '%x-W%v')",
    month: "DATE_FORMAT(r.start_time, '%Y-%m')",
};

// Statuses que cuentan como "asistió"
const ATTENDED_STATUSES = `('CHECKED_IN', 'CHECKED_OUT')`;
// Statuses que cuentan como "faltó"
const MISSED_STATUSES   = `('NO_SHOW')`;
// Statuses cancelados/rechazados
const CANCELED_STATUSES = `('CANCELED', 'REJECTED')`;

export function makeReportsRepo(db: Db): ReportsRepo {

    // ─── Por usuario ──────────────────────────────────────────────────────────

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
                COUNT(*)                                                              AS total,
                SUM(rp.attendance_status IN ${ATTENDED_STATUSES})                    AS attended,
                SUM(rp.attendance_status IN ${MISSED_STATUSES})                      AS missed,
                SUM(rp.attendance_status IN ${CANCELED_STATUSES})                    AS canceled,
                SUM(rp.attendance_status NOT IN ${ATTENDED_STATUSES}
                    AND rp.attendance_status NOT IN ${MISSED_STATUSES}
                    AND rp.attendance_status NOT IN ${CANCELED_STATUSES})             AS pending
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             WHERE rp.user_id = ?
               AND r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [userId, `${from} 00:00:00`, `${to} 23:59:59`]
        );

        return buildAttendanceSummary(rows);
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
                COUNT(*)                                                              AS total,
                SUM(rp.attendance_status IN ${ATTENDED_STATUSES})                    AS checked_in,
                SUM(rp.attendance_status IN ${MISSED_STATUSES})                      AS not_checked_in,
                SUM(rp.attendance_status IN ${CANCELED_STATUSES})                    AS canceled,
                SUM(rp.attendance_status NOT IN ${ATTENDED_STATUSES}
                    AND rp.attendance_status NOT IN ${MISSED_STATUSES}
                    AND rp.attendance_status NOT IN ${CANCELED_STATUSES})             AS pending
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             WHERE rp.user_id = ?
               AND r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [userId, `${from} 00:00:00`, `${to} 23:59:59`]
        );

        return buildReservationSummary(rows);
    };

    // ─── Globales ─────────────────────────────────────────────────────────────

    const getGlobalAttendanceStats = async (
        period: Period,
        from: string,
        to: string
    ): Promise<GlobalAttendanceSummary> => {
        const fmt = FORMAT_BY_PERIOD[period];

        const { rows } = await db.query(
            `SELECT
                ${fmt} AS period_label,
                COUNT(*)                                                              AS total,
                SUM(rp.attendance_status IN ${ATTENDED_STATUSES})                    AS attended,
                SUM(rp.attendance_status IN ${MISSED_STATUSES})                      AS missed,
                SUM(rp.attendance_status IN ${CANCELED_STATUSES})                    AS canceled,
                SUM(rp.attendance_status NOT IN ${ATTENDED_STATUSES}
                    AND rp.attendance_status NOT IN ${MISSED_STATUSES}
                    AND rp.attendance_status NOT IN ${CANCELED_STATUSES})             AS pending
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             WHERE r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [`${from} 00:00:00`, `${to} 23:59:59`]
        );

        return buildAttendanceSummary(rows);
    };

    const getGlobalReservationStats = async (
        period: Period,
        from: string,
        to: string
    ): Promise<GlobalReservationSummary> => {
        const fmt = FORMAT_BY_PERIOD[period];

        const { rows } = await db.query(
            `SELECT
                ${fmt} AS period_label,
                COUNT(*)                                                              AS total,
                SUM(rp.attendance_status IN ${ATTENDED_STATUSES})                    AS checked_in,
                SUM(rp.attendance_status IN ${MISSED_STATUSES})                      AS not_checked_in,
                SUM(rp.attendance_status IN ${CANCELED_STATUSES})                    AS canceled,
                SUM(rp.attendance_status NOT IN ${ATTENDED_STATUSES}
                    AND rp.attendance_status NOT IN ${MISSED_STATUSES}
                    AND rp.attendance_status NOT IN ${CANCELED_STATUSES})             AS pending
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             WHERE r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY period_label
             ORDER BY period_label ASC`,
            [`${from} 00:00:00`, `${to} 23:59:59`]
        );

        return buildReservationSummary(rows);
    };

    const getTopUsersByAttendance = async (
        period: Period,
        from: string,
        to: string,
        limit: number
    ): Promise<TopUser[]> => {
        const { rows } = await db.query(
            `SELECT
                u.e_id                                                                AS user_id,
                u.name                                                                AS user_name,
                COUNT(*)                                                              AS total,
                SUM(rp.attendance_status IN ${ATTENDED_STATUSES})                    AS attended,
                SUM(rp.attendance_status IN ${MISSED_STATUSES})                      AS missed,
                ROUND(
                    SUM(rp.attendance_status IN ${ATTENDED_STATUSES}) / COUNT(*) * 100,
                    2
                )                                                                     AS attendance_rate
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             JOIN users u        ON u.e_id = rp.user_id
             WHERE r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY u.e_id, u.name
             ORDER BY attended DESC
             LIMIT ?`,
            [`${from} 00:00:00`, `${to} 23:59:59`, limit]
        );

        return rows.map((r) => ({
            user_id:         r.user_id,
            user_name:       r.user_name,
            total:           Number(r.total),
            attended:        Number(r.attended),
            missed:          Number(r.missed),
            attendance_rate: Number(r.attendance_rate),
        }));
    };

    // ─── Export (filas planas para XLSX) ─────────────────────────────────────

    const getGlobalAttendanceExport = async (
        period: Period,
        from: string,
        to: string
    ): Promise<any[]> => {
        const fmt = FORMAT_BY_PERIOD[period];

        const { rows } = await db.query(
            `SELECT
                u.e_id                                                                AS user_id,
                u.name                                                                AS user_name,
                ${fmt}                                                                AS period_label,
                COUNT(*)                                                              AS total,
                SUM(rp.attendance_status IN ${ATTENDED_STATUSES})                    AS attended,
                SUM(rp.attendance_status IN ${MISSED_STATUSES})                      AS missed,
                SUM(rp.attendance_status IN ${CANCELED_STATUSES})                    AS canceled,
                SUM(rp.attendance_status NOT IN ${ATTENDED_STATUSES}
                    AND rp.attendance_status NOT IN ${MISSED_STATUSES}
                    AND rp.attendance_status NOT IN ${CANCELED_STATUSES})             AS pending,
                ROUND(
                    SUM(rp.attendance_status IN ${ATTENDED_STATUSES}) / COUNT(*) * 100,
                    2
                )                                                                     AS attendance_rate
             FROM reservation_participants rp
             JOIN reservations r ON r.id = rp.reservations_id
             JOIN users u        ON u.e_id = rp.user_id
             WHERE r.start_time >= ?
               AND r.start_time <= ?
             GROUP BY u.e_id, u.name, period_label
             ORDER BY period_label ASC, attended DESC`,
            [`${from} 00:00:00`, `${to} 23:59:59`]
        );

        return rows.map((r) => ({
            "ID Usuario":       r.user_id,
            "Nombre":           r.user_name,
            "Periodo":          r.period_label,
            "Total":            Number(r.total),
            "Asistencias":      Number(r.attended),
            "Faltas":           Number(r.missed),
            "Canceladas":       Number(r.canceled),
            "Pendientes":       Number(r.pending),
            "Tasa asistencia %": Number(r.attendance_rate),
        }));
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAttendanceSummary(rows: any[]): AttendanceSummary {
    const buckets: ReportsBucket[] = rows.map((r) => {
        const attended = Number(r.attended);
        const total    = Number(r.total);
        return {
            period_label:    r.period_label,
            total,
            attended,
            missed:          Number(r.missed),
            canceled:        Number(r.canceled),
            pending:         Number(r.pending),
            attendance_rate: total > 0
                ? Math.round((attended / total) * 100 * 100) / 100
                : 0,
        };
    });

    const totalAgg    = buckets.reduce((s, b) => s + b.total,    0);
    const attendAgg   = buckets.reduce((s, b) => s + b.attended, 0);

    return {
        total:           totalAgg,
        attended:        attendAgg,
        missed:          buckets.reduce((s, b) => s + b.missed,   0),
        canceled:        buckets.reduce((s, b) => s + b.canceled, 0),
        pending:         buckets.reduce((s, b) => s + b.pending,  0),
        attendance_rate: totalAgg > 0
            ? Math.round((attendAgg / totalAgg) * 100 * 100) / 100
            : 0,
        buckets,
    };
}

function buildReservationSummary(rows: any[]): ReservationSummary {
    const buckets: ReservationBucket[] = rows.map((r) => ({
        period_label:    r.period_label,
        total:           Number(r.total),
        checked_in:      Number(r.checked_in),
        not_checked_in:  Number(r.not_checked_in),
        canceled:        Number(r.canceled),
        pending:         Number(r.pending),
    }));

    return {
        total:          buckets.reduce((s, b) => s + b.total,          0),
        checked_in:     buckets.reduce((s, b) => s + b.checked_in,     0),
        not_checked_in: buckets.reduce((s, b) => s + b.not_checked_in, 0),
        canceled:       buckets.reduce((s, b) => s + b.canceled,       0),
        pending:        buckets.reduce((s, b) => s + b.pending,        0),
        buckets,
    };
}