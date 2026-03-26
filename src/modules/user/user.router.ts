import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware, roleMiddleware, Roles } from "../../middleware";


export function makeUserRouter(controller: UserController): Router {
    const router = Router();

    router.get("/", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getAll);
    router.get("/:eId", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getById);
    router.get("/name/:name", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getAllByName);
    if(controller.TEMPORARY_CREATE) router.post("/create", controller.TEMPORARY_CREATE);
    return  router;
}