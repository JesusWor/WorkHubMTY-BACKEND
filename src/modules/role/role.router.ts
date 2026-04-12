import { Router } from "express";
import { RoleController } from "./role.controller";
import { authenticate, authorize } from "../../middleware";
import { Roles } from "../../middleware";

export function makeRoleRouter(controller: RoleController): Router {
    const router = Router();

    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN] }), controller.getAll);
    router.get("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), controller.getById);
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN] }), controller.create);
    router.put("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), controller.update);
    router.delete("/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), controller.delete);

    return router;
}