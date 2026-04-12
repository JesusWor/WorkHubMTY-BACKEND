import { Router } from 'express';
import { AchievementsController } from './achievements.controller';
import { authenticate, authorize } from "../../middleware";
import { Roles } from "../../middleware";

export function makeAchievementsRouter(controller: AchievementsController): Router {
    const router = Router();

    router.get("/achievements/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getAll);
    router.get("/achievements/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getById);
    router.get("/achievements/code/:code", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getByCode);
    router.patch("/achievements/progress", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.updateAchievements);
    router.get("/achievements/:id/achivements", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getRanking);
    router.get("/achievements/:id/ranking", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getUserAchievements);
    router.get("/achievements/:id/stats", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), controller.getUserStats);

    return router;
}