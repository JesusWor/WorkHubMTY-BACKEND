import { Router } from "express";
import { OfficeSlotsController } from "./office-slots.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeWorkGroupsRouter(controller: OfficeSlotsController): Router {
    const router = Router();
    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getWorkGroups));
    return router;
}
