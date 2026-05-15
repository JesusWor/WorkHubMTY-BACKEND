import { Router } from "express";
import { OfficeSlotsController } from "./office-slots.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeEventsRouter(controller: OfficeSlotsController): Router {
    const router = Router();

    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getEvents));
    router.get("/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getEventById));
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.createEvent));

    return router;
}
