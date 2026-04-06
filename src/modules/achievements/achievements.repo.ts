import { Db } from "../../infra/db/db";
import { Achievements } from "./achievements.schema";

export type AchievementsRepo = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    getByCode: (code: string) => Promise<Achievements | null>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
}   

export function makeAchivementsRepo(db: Db): AchievementsRepo {

    const getAll = async (): Promise<Achievements[]> => {
        const { rows } = await db.query("SELECT * FROM achievements");
        return rows as Achievements[];
    }

    const getById = async (id: number): Promise<Achievements | null> => {
        const { rows } = await db.query("SELECT * FROM achivements WHERE id = ?", [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    const getByCode = async (code: string): Promise<Achievements | null> => {
        const { rows } = await db.query(
        "SELECT * FROM achievements WHERE code = ?",
        [code]
        );

        return rows[0] ?? null;
    };

    const updateAchievements = async (userId: string, achievementId: number, increment: number): Promise<void> => {
        await db.query(`INSERT INTO user_achievements (user_id, achievements, progress) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE progress = progress + ? 
        `,[userId, achievementId, increment, increment]);
    };

    const getRanking = async (userId: string): Promise<any[]> => {
        const { rows } = await db.query(`
            SELECT 
                u.name,
                SUM(ua.progress) AS points
            FROM users u
            JOIN user_achievements ua
            ON u.e_id = ua.user_id
            JOIN friends as f
            ON (f.user_low = ? AND f.user_high = u.e_id)
            OR (f.user_high = ? AND f.user.low = u.e_id)
            WHERE f_status = 'accepted'
            GROUP BY u.e_id
            ORDER BY points DESC
            LIMIT 5
        `, [userId, userId]);
        
        return rows;
    };

    const getUserAchievements = async (userId: string): Promise<any[]> => {
        const { rows } = await db.query(`
            SELECT
                a.name, 
                ua.progress
                MAX(al.progress_required) AS goal,
                CASE
                    WHEN ua.progress >= MAX(al.progress.required) THEN 1
                    ELSE 0
                END AS completed 
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            JOIN achievement_levels al
                ON al.achievements_id = a.id
            WHERE ua.user_id = ?
            GROUP BY a.id
        `, [userId]);

        return rows;
    };

    const getUserStats = async (userId: string): Promise<any> => {
        const [[reservations]]: any = await db.query(`
            SELECT COUNT(*) AS total
            FROM reservations
            WEHERE user_id = ?
        `, [userId]);
        const [[friends]]: any = await db.query(`
            SELECT COUNT(*) AS total
            FROM friends
            WEHERE {user_low = ? AND user_high = ?}
            AND status = 'accepted'
        `, [userId, userId]);

        return {
            reservations: reservations.total,
            friends: friends.total
        };
    };

    return {
        getAll,
        getById,
        getByCode,
        updateAchievements,
        getRanking,
        getUserAchievements,
        getUserStats
    }
}