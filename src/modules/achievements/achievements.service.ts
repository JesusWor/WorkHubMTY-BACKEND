import { AchievementsRepo } from "./achievements.repo";
import { Achievements } from "./achievements.schema";

export type AchievementsService = {
    getAll: () => Promise<Achievements[]>;
    getById: (id: number) => Promise<Achievements | null>;
    getByCode: (code: string) => Promise<Achievements | null>;
    updateAchievements: (userId: string, achievementId: number, increment: number) => Promise<void>;
    getRanking: (userId: string) => Promise<any[]>;
    getUserAchievements: (userId: string) => Promise<any[]>;
    getUserStats: (userId: string) => Promise<any>;
}

export function makeAchievementsService(achievements: AchievementsRepo): AchievementsService {
    const getAll = async (): Promise<Achievements[]> => {
        return await achievements.getAll();
    };

    const getById = async (id: number): Promise<Achievements | null> => {
        return await achievements.getById(id);
    };

    const getByCode = async (code: string): Promise<Achievements | null> => {
        return await achievements.getByCode(code);
    };

    const updateAchievements = async (userId: string, achievementId: number, increment: number): Promise<void> => {
        if(!userId){
            throw new Error("The user is requeride");
        }
        if(!achievementId){
            throw new Error("Achievement not found");
        }
        if(increment <= 0) {
            throw new Error("The incerment has to be more than 0");
        }

        await achievements.updateAchievements(userId, achievementId, increment);
    };

    const getRanking = async (userId: string): Promise<any[]>  => {
        return await achievements.getRanking(userId);
    };

    const getUserAchievements  = async (userId: string): Promise<any[]>  => {
        return await achievements.getUserAchievements(userId);
    };

    const getUserStats  = async (userId: string): Promise<any>  => {
        return await achievements.getUserStats(userId);
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