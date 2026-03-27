import { Router } from "express";
import { RoleController } from "./role.controller";
import { authMiddleware, roleMiddleware, Roles } from "../../middleware";

export function makeRoleRouter(controller: RoleController): Router {
    const router = Router();

    router.get("/", authMiddleware, roleMiddleware(Roles.ADMIN), controller.getAll);
    router.get("/:id", authMiddleware, roleMiddleware(Roles.ADMIN), controller.getById);
    router.post("/", authMiddleware, roleMiddleware(Roles.ADMIN), controller.create);
    router.put("/:id", authMiddleware, roleMiddleware(Roles.ADMIN), controller.update);
    router.delete("/:id", authMiddleware, roleMiddleware(Roles.ADMIN), controller.delete);

    return router;
}