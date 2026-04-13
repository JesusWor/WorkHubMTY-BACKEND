import { AchievementsRepo } from "./achievements.repo";
import { Achievements, CreateAchievementInput } from "./achievements.schema";

export type AchievementsService = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    getByCode: (code: string) => Promise<Achievements | null>;
    createAchievement: (input: CreateAchievementInput) => Promise<{ id: number }>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
    getRecentActivity: (userId: string) => Promise<any>;
}

export function makeAchievementsService(repo: AchievementsRepo): AchievementsService {

    const getAll = async (): Promise<Achievements[]> => {
        return await repo.getAll();
    };

    const getById = async (id: number): Promise<Achievements | null> => {
        return await repo.getById(id);
    };

    const getByCode = async (code: string): Promise<Achievements | null> => {
        return await repo.getByCode(code);
    };

    // NEW
    const createAchievement = async (input: CreateAchievementInput): Promise<{ id: number }> => {
        // Verificar que el code no esté ya en uso
        const existing = await repo.getByCode(input.code);
        if (existing) {
            throw new Error(`Ya existe un logro con el código "${input.code}"`);
        }

        return await repo.createAchievement(input);
    };

    const updateAchievements = async (
        userId: string,
        achievementId: number,
        increment: number
    ): Promise<void> => {
        if (!userId) {
            throw new Error("The user is required");
        }
        if (!achievementId) {
            throw new Error("Achievement id is required");
        }
        // FIX: "incerment" -> "increment"
        if (increment <= 0) {
            throw new Error("The increment has to be more than 0");
        }

        await repo.updateAchievements(userId, achievementId, increment);
    };

    const getRanking = async (userId: string): Promise<any[]> => {
        return await repo.getRanking(userId);
    };

    const getUserAchievements = async (userId: string): Promise<any[]> => {
        return await repo.getUserAchievements(userId);
    };

    const getUserStats = async (userId: string): Promise<any> => {
        return await repo.getUserStats(userId);
    };

    // NEW
    const getRecentActivity = async (userId: string): Promise<any> => {
        return await repo.getRecentActivity(userId);
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