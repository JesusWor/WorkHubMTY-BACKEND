// office-slots.routes.ts
import { Router } from "express";
import { OfficeSlotsController } from "./office-slots.controller";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware";

export function makeOfficeSlotsRouter(controller: OfficeSlotsController): Router {
    const router = Router();

    router.get("/office-slots/available", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAvailable));
    router.get("/office-slots", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAll));
    router.get("/office-slots/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getById));
    router.post("/office-slots", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.create));
    router.patch("/office-slots/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.update));
    router.delete("/office-slots/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.remove));
    router.post("/office-slots/:id/block", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.setBlock));

    return router;
}