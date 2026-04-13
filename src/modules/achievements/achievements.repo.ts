import { Db } from "../../infra/db/db";
import { Achievements, AchievementLevel, CreateAchievementInput } from "./achievements.schema";

export type AchievementsRepo = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    getByCode: (code: string) => Promise<Achievements | null>;
    createAchievement :(input: CreateAchievementInput) => Promise<{ id: number }>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
    getRecentActivity: (userId: string) => Promise<any>;
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

    const getByCode = async (code: string): Promise<Achievements | null> => {
        const { rows } = await db.query(
            "SELECT * FROM achievements WHERE code = ?",
            [code]
        );
        return rows[0] ?? null;
    };

    const createAchievement = async (input: CreateAchievementInput): Promise<{ id: number }> => {
        if (!input.code || !input.name) {
            throw new Error("code y name son obligatorios");
        }
        if (!input.levels || input.levels.length === 0) {
            throw new Error("El logro debe tener al menos un nivel");
        }
        
        const sortedLevels = { ...input.levels }.sort((a, b) => a.level - b.level);
        for (let i = 0; i < sortedLevels.length; i++) {
            if (sortedLevels[i].level !== i + 1) {
                throw new Error("Los niveles deben ser secuenciales y comenzar en 1");
            }
            if (sortedLevels[i].progress_required <= 0) {
                throw new Error("progress_required debe ser mayor a 0");
            }
        }

        for(let i = 0; i < sortedLevels.length; i++) {
            if(sortedLevels[i].progress_required <= sortedLevels[i - 1].progress_required) {
                throw new Error(`El progress_required del nivel ${sortedLevels[i].level} debe ser mayor que el del nivel ${sortedLevels[i - 1].level}`);
            }
        }

        await db.query("START TRANSACTION");
        try {
            const { rows: insertResult } = await db.query(
                "INSERT INTO achievements (code, name, description) VALUES (?, ?, ?)",
                [input.code, input.name, input.description]
            );
            const achievementId: number = (insertResult as any).insertId;

            const levelPlaceholders = sortedLevels.map(() => "(?, ?, ?)").join(", ");
            const levelValues = sortedLevels.flatMap(level => [achievementId, level.level, level.progress_required]);

            await db.query(
                `INSERT INTO achievement_levels (achievements_id, level, progress_required) VALUES ${levelPlaceholders}`,
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
            `INSERT INTO user_achievements (user_id, achievement_id, progress)
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
             JOIN user_achievements ua ON u.e_id = ua.user_id
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
             LEFT JOIN user_achievements ua ON u.e_id = ua.user_id
             WHERE u.e_id = ?
             GROUP BY u.e_id

             ORDER BY points DESC
             LIMIT 5`,
            [userId, userId, userId]
        );
        return rows;
    };

    // FIX: coma faltante después de "ua.progress", typo "progress.required" -> "progress_required"
    const getUserAchievements = async (userId: string): Promise<any[]> => {
        const { rows } = await db.query(
            `SELECT
                a.name,
                ua.progress,
                MAX(al.progress_required) AS goal,
                CASE
                    WHEN ua.progress >= MAX(al.progress_required) THEN 1
                    ELSE 0
                END AS completed
             FROM user_achievements ua
             JOIN achievements a ON ua.achievement_id = a.id
             JOIN achievement_levels al ON al.achievements_id = a.id
             WHERE ua.user_id = ?
             GROUP BY a.id, a.name, ua.progress`,
            [userId]
        );
        return rows;
    };

    // FIX: llaves {} invalidas, lógica OR para user_low / user_high
    const getUserStats = async (userId: string): Promise<any> => {
        const { rows: resRows } = await db.query(
            `SELECT COUNT(*) AS total
             FROM reservations
             WHERE user_id = ?`,
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
             WHERE user_id = ?
             ORDER BY start_time DESC
             LIMIT 1`,
            [userId]
        );

        const { rows: lastAchievement } = await db.query(
            `SELECT
                a.name,
                ua.achieved_at
             FROM user_achievements ua
             JOIN achievements a ON ua.achievement_id = a.id
             WHERE ua.user_id = ?
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

    return {
        getAll,
        getById,
        getByCode,
        createAchievement,
        updateAchievements,
        getRanking,
        getUserAchievements,
        getUserStats,
        getRecentActivity,
    };
}