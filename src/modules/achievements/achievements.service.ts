import { AchievementsRepo } from "./achievements.repo.js";
import { Achievements, CreateAchievementInput, UserSummary } from "./achievements.schema.js";
import { BadRequestError, ConflictError } from "../../shared/errors/AppError.js";

export type AchievementsService = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    getByCode: (code: string) => Promise<Achievements | null>;
    createAchievement: (input: CreateAchievementInput) => Promise<{ id: number }>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<any[]>;
    getCompletedByUser: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
    getRecentActivity: (userId: string) => Promise<any>;
    getUserSummary: (userId: string) => Promise<UserSummary>;
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

    const createAchievement = async (input: CreateAchievementInput): Promise<{ id: number }> => {
        const existing = await repo.getByCode(input.code);
        if (existing) {
            throw new ConflictError(`Ya existe un logro con el código "${input.code}"`);
        }

        return await repo.createAchievement(input);
    };

    const updateAchievements = async (
        userId: string,
        achievementId: number,
        increment: number
    ): Promise<void> => {
        if (!userId) throw new BadRequestError("The user is required");
        if (!achievementId) throw new BadRequestError("Achievement id is required");
        if (increment <= 0) throw new BadRequestError("The increment has to be more than 0");

        await repo.updateAchievements(userId, achievementId, increment);
    };

    const getRanking = async (userId: string): Promise<any[]> => {
        return await repo.getRanking(userId);
    };

    const getUserAchievements = async (userId: string): Promise<any[]> => {
        return await repo.getUserAchievements(userId);
    };

    const getCompletedByUser = async (userId: string): Promise<any[]> => {
        return await repo.getCompletedByUser(userId);
    };

    const getUserStats = async (userId: string): Promise<any> => {
        return await repo.getUserStats(userId);
    };

    const getRecentActivity = async (userId: string): Promise<any> => {
        return await repo.getRecentActivity(userId);
    };

    const getUserSummary = async (userId: string): Promise<UserSummary> => {
        return await repo.getUserSummary(userId);
    };

    return {
        getAll,
        getById,
        getByCode,
        createAchievement,
        updateAchievements,
        getRanking,
        getUserAchievements,
        getCompletedByUser,
        getUserStats,
        getRecentActivity,
        getUserSummary
    };
}
