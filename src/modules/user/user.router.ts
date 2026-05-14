import { Router } from "express";
import { UserController } from "./user.controller.js";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware/index.js";

export function makeUserRouter(controller: UserController): Router {
    const router = Router();

    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAll));
    router.get("/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getById));

    router.get("/me/friendships", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyFriendships));
    router.get("/:eId/friendships", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUserFriendships));

    router.get("/name/:name", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllByName));

    router.get("/profile/me", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyFullProfile));
    router.get("/profile/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUserFullProfile));

    if (controller.TEMPORARY_CREATE) router.post("/create", asyncHandler(controller.TEMPORARY_CREATE));

    return router;
}
