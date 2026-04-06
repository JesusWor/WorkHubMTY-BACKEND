import { AchievementsService } from "./achievements.service";
import { AchivementsSchema } from "./achievements.schema";
import { Request, Response } from "express";
import { GlobalResponse } from "../../shared/response/globalresponse";

export type AchievementsController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;
    getByCode: (req: Request, res: Response) => Promise<void>;
    updateAchievements: (req: Request, res: Response) => Promise<void>;
    getRanking: (req: Request, res: Response) => Promise<void>;
    getUserAchievements: (req: Request, res: Response) => Promise<void>;
    getUserStats: (req: Request, res: Response) => Promise<void>;
}

export function makeAchievementsController(service: AchievementsService): AchievementsController {
    const getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const achievements = await service.getAll();
            GlobalResponse.okWithData(res, achievements);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message: undefined);
        }
    };

    const getById = async (req: Request, res: Response): Promise<void> => {
        try {
            if (req.params.id) {
                GlobalResponse.badRequest(res, "Achievements is required");
                return;
            }

            const id = Number(req.params.id);
            if (isNaN(id)) {
                GlobalResponse.badRequest(res, "Invalid achievments id");
            }

            const achievements = await service.getById(id);
            if (!achievements) {
                GlobalResponse.notFound(res, "Achievements nos found");
                return
            }

            GlobalResponse.okWithData(res, achievements);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const getByCode = async (req: Request, res: Response): Promise<void> => {
        try {
            const code = String(req.params.code);
            if (!code){
                GlobalResponse.badRequest(res, "Code is required");
                return;
            }

            const achievements = await service.getByCode(code);
            if (!achievements) {
                GlobalResponse.notFound(res, "Achievement not found");
                return;
            }

            GlobalResponse.okWithData(res, achievements);
            } catch (error) {
                GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);        
        }
    };
    
    const updateAchievements = async (req: Request, res: Response): Promise<void> => {
        try {
            const {userId, achievementId, increment} = req.body;
            if(!userId || !achievementId || !increment){
                GlobalResponse.badRequest(res, "Missing required files");
                return;
            }

            await service.updateAchievements(userId, achievementId, increment);

            GlobalResponse.ok(res, "Achievement updated");
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const getRanking = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = String(req.params.id);
            if (!id) {
                GlobalResponse.badRequest(res, "User id is requiered");
                return;
            }
            
            const ranking = await service.getRanking(id);
            GlobalResponse.okWithData(res, ranking);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const getUserAchievements = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = String(req.params.id);

            if (!id) {
                GlobalResponse.badRequest(res, "User id is required");
                return;
            }

            const achievements = await service.getUserAchievements(id);

            GlobalResponse.okWithData(res, achievements);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const getUserStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = String(req.params.id);
            if (!id) {
                GlobalResponse.badRequest(res, "User id is required");
                return;
            }

            const stats = await service.getUserStats(id);
            GlobalResponse.okWithData(res, stats);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    return {
        getAll,
        getById,
        getByCode,
        updateAchievements,
        getRanking,
        getUserAchievements,
        getUserStats
    };
}