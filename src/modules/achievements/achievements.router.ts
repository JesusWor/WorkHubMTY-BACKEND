import { Router } from 'express';
import { AchievementsController } from './achievements.controller';
import { authMiddleware, roleMiddleware } from "../../middleware";
import { Roles } from "../../middleware";

export function makeAchievementsRouter(controller: AchievementsController): Router {
    const router = Router();

    router.get("/achievements/", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getAll);
    router.get("/achievements/:id", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getById);
    router.get("/achievements/code/:code", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getByCode);
    router.patch("/achievements/progress", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.updateAchievements);
    router.get("/achievements/:id/achivements", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getRanking);
    router.get("/achievements/:id/ranking", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getUserAchievements);
    router.get("/achievements/:id/stats", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getUserStats);

    return router;
}