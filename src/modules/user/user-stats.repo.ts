import type { Db } from "../../infra/db/db.js";

export type UserStats = {
    user_id: string;
    streak: number;
    missed_days: number;
    last_assist: Date | null;
    total_work_hours: number;
    ap: number;
};

export type UserStatsRepo = {
    getByUserId(userId: string): Promise<UserStats | null>;
    upsertOnCheckout(userId: string, minutesWorked: number): Promise<void>;
    runDailyStreakTick(assistanceWindow: number): Promise<void>;
    applyDailyApDecay(multiplier: number): Promise<void>;
};

export function makeUserStatsRepo(db: Db): UserStatsRepo {
    const getByUserId = async (userId: string): Promise<UserStats | null> => {
        const { rows } = await db.query(
            `SELECT
                user_id,
                streak,
                missed_days,
                last_assist,
                total_work_hours,
                ap
             FROM user_stats
             WHERE user_id = ?;`,
            [userId],
        );
        return rows.length > 0 ? (rows[0] as UserStats) : null;
    };

    const upsertOnCheckout = async (userId: string, minutesWorked: number): Promise<void> => {
        const hoursWorked = minutesWorked / 60;

        await db.execute(
            `INSERT INTO user_stats (user_id, streak, missed_days, last_assist, total_work_hours, ap)
             VALUES (?, 0, 0, NOW(), ?, ?)
             ON DUPLICATE KEY UPDATE
                last_assist = NOW(),
                total_work_hours = total_work_hours + VALUES(total_work_hours),
                ap = ap + VALUES(ap);`,
            [userId, hoursWorked, minutesWorked],
        );
    };

    const runDailyStreakTick = async (assistanceWindow: number): Promise<void> => {
        // Attended: bump streak, clear miss counter and sentinel
        await db.execute(
            `UPDATE user_stats
             SET streak = streak + 1,
                 missed_days = 0,
                 last_assist = NULL
             WHERE last_assist IS NOT NULL;`,
        );

        // Absent but within grace window: only increment missed_days
        await db.execute(
            `UPDATE user_stats
             SET missed_days = missed_days + 1
             WHERE last_assist IS NULL
               AND missed_days + 1 < ?;`,
            [assistanceWindow],
        );

        // Absent and hit the window: reset streak
        await db.execute(
            `UPDATE user_stats
             SET streak = 0,
                 missed_days = 0
             WHERE last_assist IS NULL
                AND missed_days + 1 >= ?;`,
            [assistanceWindow],
        );
    };

    const applyDailyApDecay = async (multiplier: number): Promise<void> => {
        await db.execute(
            `UPDATE user_stats
             SET ap = FLOOR(ap * ?);`,
            [multiplier],
        );
    };

    return {
        getByUserId,
        upsertOnCheckout,
        runDailyStreakTick,
        applyDailyApDecay,
    };
}
