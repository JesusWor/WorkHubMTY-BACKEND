import { Router } from "express";
import { UserController } from "./user.controller";
import { authenticate, authorize, Roles, RolePolicy } from "../../middleware";

export function makeUserRouter(controller: UserController): Router {
    const router = Router();

    const NOT_QUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    router.get("/", authenticate, authorize(NOT_QUEST_POLICY), controller.getAll);
    router.get("/:eId", authenticate, authorize(NOT_QUEST_POLICY), controller.getById);
    router.get("/name/:name", authenticate, authorize(NOT_QUEST_POLICY), controller.getAllByName);
    if(controller.TEMPORARY_CREATE) router.post("/create", controller.TEMPORARY_CREATE);

    return  router;
}