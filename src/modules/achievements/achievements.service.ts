import { AchievementsRepo } from "./achievements.repo.js";
import { AchievementProgressesByUser, Achievements, AchievementUserData, CreateAchievementInput, UserSummary } from "./achievements.schema.js";
import { BadRequestError, ConflictError } from "../../shared/errors/AppError.js";
import { UserRepo } from "../user/user.repo.js";

export type AchievementsService = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    createAchievement: (input: CreateAchievementInput) => Promise<{ id: number }>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<AchievementUserData[]>;
    getCompletedByUser: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
    getRecentActivity: (userId: string) => Promise<any>;
    getUserSummary: (userId: string) => Promise<UserSummary>;
}

export function makeAchievementsService(repo: AchievementsRepo, userRepo: UserRepo): AchievementsService {

    const getAll = async (): Promise<Achievements[]> => {
        return await repo.getAll();
    };

    const getById = async (id: number): Promise<Achievements | null> => {
        return await repo.getById(id);
    };

    const createAchievement = async (input: CreateAchievementInput): Promise<{ id: number }> => {
        const existing = await repo.getById(input.id);
        if (existing) {
            throw new ConflictError(`Ya existe un logro con el id "${input.id}"`);
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

    const getUserAchievements = async (userId: string): Promise<AchievementUserData[]> => {
        const userAchievements = await repo.getUserAchievements(userId);
        // const userData = await userRepo.getById(userId);
        const userAchievementsData = 
            userAchievements.map((currentAchievement) => {
                return {
                    id:currentAchievement.id,
                    title:currentAchievement.title,
                    description:currentAchievement.description,
                    icon:currentAchievement.icon,
                    userProgress:
                    {
                        current:currentAchievement.progress,
                        target:currentAchievement.goal,
                        status:currentAchievement.status
                    }
                }
            }
        )
        return userAchievementsData;
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
