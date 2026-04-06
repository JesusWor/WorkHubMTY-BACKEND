import { Router } from "express";
import { RoleController } from "./role.controller";
import { authMiddleware, roleMiddleware } from "../../middleware";
import { Roles } from "../../middleware";

export function makeRoleRouter(controller: RoleController): Router {
    const router = Router();

    router.get("/", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.getAll);
    router.get("/:id", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.getById);
    router.post("/", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.create);
    router.put("/:id", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.update);
    router.delete("/:id", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.delete);

    return router;
}