import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware, roleMiddleware, Roles, RolePolicy } from "../../middleware";

export function makeUserRouter(controller: UserController): Router {
    const router = Router();

    const NOT_QUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    router.get("/", authMiddleware, roleMiddleware(NOT_QUEST_POLICY), controller.getAll);
    router.get("/:eId", authMiddleware, roleMiddleware(NOT_QUEST_POLICY), controller.getById);
    router.get("/name/:name", authMiddleware, roleMiddleware(NOT_QUEST_POLICY), controller.getAllByName);
    if(controller.TEMPORARY_CREATE) router.post("/create", controller.TEMPORARY_CREATE);

    return  router;
}