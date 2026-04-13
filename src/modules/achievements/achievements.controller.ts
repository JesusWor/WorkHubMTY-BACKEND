import { AchievementsService } from "./achievements.service";
import { CreateAchievementInputSchema } from "./achievements.schema";
import { Request, Response } from "express";
import { GlobalResponse } from "../../shared/response/globalresponse";

export type AchievementsController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;
    getByCode: (req: Request, res: Response) => Promise<void>;
    createAchievement: (req: Request, res: Response) => Promise<void>;
    updateAchievements: (req: Request, res: Response) => Promise<void>;
    getRanking: (req: Request, res: Response) => Promise<void>;
    getUserAchievements: (req: Request, res: Response) => Promise<void>;
    getUserStats: (req: Request, res: Response) => Promise<void>;
    getRecentActivity: (req: Request, res: Response) => Promise<void>;
}

export function makeAchievementsController(service: AchievementsService): AchievementsController {

    const getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const achievements = await service.getAll();
            GlobalResponse.okWithData(res, achievements);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const getById = async (req: Request, res: Response): Promise<void> => {
        try {
            // FIX: la condición estaba invertida, faltaba el "!"
            if (!req.params.id) {
                GlobalResponse.badRequest(res, "Achievement id is required");
                return;
            }

            const id = Number(req.params.id);
            if (isNaN(id)) {
                GlobalResponse.badRequest(res, "Invalid achievement id");
                return; // FIX: faltaba return para cortar la ejecución
            }

            const achievement = await service.getById(id);
            if (!achievement) {
                GlobalResponse.notFound(res, "Achievement not found");
                return;
            }

            GlobalResponse.okWithData(res, achievement);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const getByCode = async (req: Request, res: Response): Promise<void> => {
        try {
            const code = String(req.params.code);
            if (!code) {
                GlobalResponse.badRequest(res, "Code is required");
                return;
            }

            const achievement = await service.getByCode(code);
            if (!achievement) {
                GlobalResponse.notFound(res, "Achievement not found");
                return;
            }

            GlobalResponse.okWithData(res, achievement);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // NEW
    const createAchievement = async (req: Request, res: Response): Promise<void> => {
        try {
            const parsed = CreateAchievementInputSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.badRequest(
                    res,
                    parsed.error.issues.map((i) => i.message).join(", ")
                );
                return;
            }

            const result = await service.createAchievement(parsed.data);
            GlobalResponse.okWithData(res, result);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    const updateAchievements = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, achievementId, increment } = req.body;
            // FIX: "files" -> "fields"
            if (!userId || !achievementId || !increment) {
                GlobalResponse.badRequest(res, "Missing required fields");
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
                GlobalResponse.badRequest(res, "User id is required");
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

    const getRecentActivity = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = String(req.params.id);
            if (!id) {
                GlobalResponse.badRequest(res, "User id is required");
                return;
            }

            const activity = await service.getRecentActivity(id);
            GlobalResponse.okWithData(res, activity);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
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