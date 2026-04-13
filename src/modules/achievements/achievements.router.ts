import { Router } from 'express';
import { AchievementsController } from './achievements.controller';
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware";

export function makeAchievementsRouter(controller: AchievementsController): Router {
    const router = Router();

    router.get("/achievements",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getAll));

    router.get("/achievements/code/:code",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getByCode));

    router.get("/achievements/:id",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getById));
    
    router.post("/achievements",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }),
        asyncHandler(controller.createAchievement));

    router.patch("/achievements/progress",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.updateAchievements));

    router.get("/achievements/:id/ranking",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getRanking));

    router.get("/achievements/:id/list",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getUserAchievements));

    router.get("/achievements/:id/stats",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getUserStats));

    router.get("/achievements/:id/activity",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getRecentActivity));

    return router;
}