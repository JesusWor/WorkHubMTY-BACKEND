import { Router } from 'express';
import { AchievementsController } from './achievements.controller';
import { authenticate, authorize, Roles } from "../../middleware";

export function makeAchievementsRouter(controller: AchievementsController): Router {
    const router = Router();

    router.get("/achievements", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getAll);
    router.get("/achievements/code/:code", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getByCode);
    router.get("/achievements/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getById);
    router.post("/achievements", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), controller.createAchievement);
    router.patch("/achievements/progress", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.updateAchievements);
    router.get("/achievements/:id/ranking", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getRanking);
    router.get("/achievements/:id/list",authenticate,authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),controller.getUserAchievements);
    router.get("/achievements/:id/stats", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getUserStats);
    router.get("/achievements/:id/activity", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getRecentActivity);

    return router;
}