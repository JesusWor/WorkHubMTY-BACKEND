import { Router } from "express";
import { UserTimelineController } from "./user-timeline.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../../middleware/index.js";

export function mountUserTimelineRoutes(
    router: Router,
    controller: UserTimelineController
): void {
    router.get(
        "/:eId/timeline",
        authenticate,
        authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getTimeline)
    );
}
