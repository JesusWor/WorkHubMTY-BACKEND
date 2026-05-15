import { Router } from "express";
import { OfficeSlotsController } from "./office-slots.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeReservablesRouter(controller: OfficeSlotsController): Router {
    const router = Router();

    router.get("/available", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAvailable));
    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAll));
    router.get("/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getById));
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.create));
    router.patch("/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.update));
    router.delete("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.remove));
    router.post("/:id/block", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.setBlock));

    return router;
}
