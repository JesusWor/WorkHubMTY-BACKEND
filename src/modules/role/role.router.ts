import { Router } from "express";
import { RoleController } from "./role.controller";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware";

export function makeRoleRouter(controller: RoleController): Router {
    const router = Router();

    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.getAll));
    router.get("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.getById));
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.create));
    router.put("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.update));
    router.delete("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.delete));

    return router;
}
