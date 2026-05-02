import { Router } from 'express';
import { AchievementsController } from './achievements.controller';
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware";

export function makeAchievementsRouter(controller: AchievementsController): Router {
    const router = Router();

    router.get("/",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getAll));

    router.get("/me",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getMyAchievements));

    router.get("/code/:code",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getByCode));

    router.get("/:id",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getById));
    
    router.post("/",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }),
        asyncHandler(controller.createAchievement));

    router.patch("/progress",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.updateAchievements));

    router.get("/:id/ranking",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getRanking));

    router.get("/:id/list",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getUserAchievements));

    router.get("/:id/stats",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getUserStats));

    router.get("/:id/activity",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getRecentActivity));

    return router;
}