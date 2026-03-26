import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware, roleMiddleware, Roles } from "../../middleware";


export type UserRouter = {
    router: Router;
}

export function makeUserRouter(controller: UserController): UserRouter {
    const router = Router();

    router.get("/", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getAll);
    router.get("/:eId", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getById);
    router.get("/name/:name", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getAllByName);

    return { router }
}