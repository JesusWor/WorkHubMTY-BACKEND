import { Router } from "express";
import { UserController } from "./user.controller";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware";

export function makeUserRouter(controller: UserController): Router {
    const router = Router();

    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAll));
    router.get("/name/:name", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllByName));
    router.get("/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getById));
    if (controller.TEMPORARY_CREATE) router.post("/create", asyncHandler(controller.TEMPORARY_CREATE));

    return router;
}
