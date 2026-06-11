import { Db } from "../../infra/db/db.js";
import { Achievements, AchievementLevel, CreateAchievementInput, UserSummary, AchievementProgressesByUser } from "./achievements.schema.js";

export type AchievementsRepo = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    createAchievement :(input: CreateAchievementInput) => Promise<{ id: number }>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<AchievementProgressesByUser[]>;
    getCompletedByUser: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
    getRecentActivity: (userId: string) => Promise<any>;
    getUserSummary: (userId: string) => Promise<UserSummary>
}

export function makeAchievementsRepo(db: Db): AchievementsRepo {

    const getAll = async (): Promise<Achievements[]> => {
        const { rows } = await db.query("SELECT * FROM achievements");
        return rows as Achievements[];
    };

    const getById = async (id: number): Promise<Achievements | null> => {
        const { rows } = await db.query(
            "SELECT * FROM achievements WHERE id = ?",
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    };


    const createAchievement = async (input: CreateAchievementInput): Promise<{ id: number }> => {
        if (!input.id || !input.name) {
            throw new Error("id y name son obligatorios");
        }
        if (!input.levels || input.levels.length === 0) {
            throw new Error("El logro debe tener al menos un nivel");
        }
        
        const sortedLevels = { ...input.levels }.sort((a, b) => a.level - b.level);
        for (let i = 0; i < sortedLevels.length; i++) {
            if (sortedLevels[i].level !== i + 1) {
                throw new Error("Los niveles deben ser secuenciales y comenzar en 1");
            }
            if (sortedLevels[i].progressRequired <= 0) {
                throw new Error("progressRequired debe ser mayor a 0");
            }
        }

        for(let i = 0; i < sortedLevels.length; i++) {
            if(sortedLevels[i].progressRequired <= sortedLevels[i - 1].progressRequired) {
                throw new Error(`El progressRequired del nivel ${sortedLevels[i].level} debe ser mayor que el del nivel ${sortedLevels[i - 1].level}`);
            }
        }

        await db.query("START TRANSACTION");
        try {
            const { rows: insertResult } = await db.query(
                "INSERT INTO achievements (id, name) VALUES (?, ?)",
                [input.id, input.name]
            );
            const achievementId: number = (insertResult as any).insertId;

            const levelPlaceholders = sortedLevels.map(() => "(?, ?, ?)").join(", ");
            const levelValues = sortedLevels.flatMap(level => [achievementId, level.level, level.progressRequired, level.description]);

            await db.query(
                `INSERT INTO achievement_levels (achievementId, level, progressRequired, description) VALUES ${levelPlaceholders}`,
                levelValues
            );

            await db.query("COMMIT");
            return { id: achievementId };
        } catch (error) {
            await db.query("ROLLBACK");
            throw error;
        }
    }

    const updateAchievements = async (userId: string, achievementId: number, increment: number): Promise<void> => {
        await db.query(
            `INSERT INTO user_achievements (userId, achievementId, progress)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE progress = progress + ?`,
            [userId, achievementId, increment, increment]
        );
    };

    const getRanking = async (userId: string): Promise<any[]> => {
        const { rows } = await db.query(
            `SELECT
                u.e_id,
                u.name,
                SUM(ua.progress) AS points
             FROM users u
             JOIN user_achievements ua ON u.e_id = ua.userId
             JOIN friends f
                ON (f.user_low = ? AND f.user_high = u.e_id)
                OR (f.user_high = ? AND f.user_low = u.e_id)
             WHERE f.status = 'accepted'

             UNION

             SELECT
                u.e_id,
                u.name,
                COALESCE(SUM(ua.progress), 0) AS points
             FROM users u
             LEFT JOIN user_achievements ua ON u.e_id = ua.userId
             WHERE u.e_id = ?
             GROUP BY u.e_id

             ORDER BY points DESC
             LIMIT 5`,
            [userId, userId, userId]
        );
        return rows;
    };

    // FIX: coma faltante después de "ua.progress", typo "progress.required" -> "progressRequired"
    const getUserAchievements = async (userId: string): Promise<AchievementProgressesByUser[]> => {
        const { rows } = await db.query(
            `SELECT
                a.id,
                a.name AS title,
                al.description,
                ai.name AS icon,
                COALESCE(ua.progress, 0) AS progress,
                al.progressRequired AS goal,
                CASE
                    WHEN COALESCE(ua.progress, 0) >= al.progressRequired THEN 'completed'
                    WHEN COALESCE(ua.progress, 0) > 0 THEN 'in_progress'
                    ELSE 'locked'
                END AS status,
                al.level
            FROM achievements a
            JOIN achievement_levels al 
                ON al.achievementId = a.id
                AND al.progressRequired = (
                    SELECT MIN(al2.progressRequired)
                    FROM achievement_levels al2
                    WHERE al2.achievementId = a.id
                    AND al2.progressRequired > COALESCE(
                        (
                            SELECT ua2.progress
                            FROM user_achievements ua2
                            WHERE ua2.achievementId = a.id
                                AND ua2.userId = ?
                            LIMIT 1
                        ),
                        0
                    )
                )
            JOIN achievement_icons ai 
                ON a.iconId = ai.id
            LEFT JOIN user_achievements ua 
                ON ua.achievementId = a.id 
                AND ua.userId = ?
            ORDER BY a.id;
            `,
            [userId, userId]
        );
        return rows;
    };

    const getCompletedByUser = async (userId: string): Promise<any[]> => {
        const { rows } = await db.query(
            `SELECT
                a.id,
                a.name,
                ua.progress,
                MAX(al.progressRequired) AS goal
             FROM user_achievements ua
             JOIN achievements a ON ua.achievementId = a.id
             JOIN achievement_levels al ON al.achievementId = a.id
             WHERE ua.userId = ?
             GROUP BY a.id, a.name, ua.progress
             HAVING ua.progress >= MAX(al.progressRequired)`,
            [userId]
        );
        return rows;
    };

    // FIX: llaves {} invalidas, lógica OR para user_low / user_high
    const getUserStats = async (userId: string): Promise<any> => {
        const { rows: resRows } = await db.query(
            `SELECT COUNT(*) AS total
             FROM reservations
             WHERE userId = ?`,
            [userId]
        );

        const { rows: friendRows } = await db.query(
            `SELECT COUNT(*) AS total
             FROM friends
             WHERE (user_low = ? OR user_high = ?)
             AND status = 'accepted'`,
            [userId, userId]
        );

        return {
            reservations: resRows[0].total,
            friends: friendRows[0].total,
        };
    };

    // NEW: última reserva y último logro obtenido
    // NOTA: requiere agregar la columna "achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    // a la tabla user_achievements para que funcione getLastAchievement.
    const getRecentActivity = async (userId: string): Promise<any> => {
        const { rows: lastReservation } = await db.query(
            `SELECT start_time
             FROM reservations
             WHERE userId = ?
             ORDER BY start_time DESC
             LIMIT 1`,
            [userId]
        );

        const { rows: lastAchievement } = await db.query(
            `SELECT
                a.name,
                ua.achieved_at
             FROM user_achievements ua
             JOIN achievements a ON ua.achievementId = a.id
             WHERE ua.userId = ?
             ORDER BY ua.achieved_at DESC
             LIMIT 1`,
            [userId]
        );

        return {
            lastReservation: lastReservation[0]?.start_time ?? null,
            lastAchievement: {
                name: lastAchievement[0]?.name ?? null,
                date: lastAchievement[0]?.achieved_at ?? null,
            },
        };
    };

    const getUserSummary = async (userId: string): Promise<UserSummary> => {
        const { rows } = await db.query(
            `SELECT
                COALESCE(SUM(ua.progress), 0) AS points,
                COUNT(a.id) AS totalAchievements,
                SUM(CASE WHEN ua.progress >= al.max_goal THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN ua.progress > 0
                        AND ua.progress < al.max_goal THEN 1 ELSE 0 END) AS inProgress,
                SUM(CASE WHEN ua.progress IS NULL
                        OR ua.progress = 0 THEN 1 ELSE 0 END) AS notStarted
            FROM achievements a
            LEFT JOIN user_achievements ua
                ON ua.achievementId = a.id AND ua.userId = ?
            LEFT JOIN (
                SELECT achievementId, MAX(progressRequired) AS max_goal
                FROM achievement_levels
                GROUP BY achievementId
            ) al ON al.achievementId = a.id`,
            [userId]
        );
        return rows[0];
    };

    return {
        getAll,
        getById,
        createAchievement,
        updateAchievements,
        getRanking,
        getUserAchievements,
        getCompletedByUser,
        getUserStats,
        getRecentActivity,
        getUserSummary,
    };
}