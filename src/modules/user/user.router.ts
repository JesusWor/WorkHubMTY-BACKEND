import { Router } from "express";
import { UserController } from "./user.controller.js";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware/index.js";

export function makeUserRouter(controller: UserController): Router {
    const router = Router();
    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };
    const ADMIN_ONLY_POLICY: RolePolicy = { allow: [Roles.ADMIN] };

    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUsers));
    router.get("/guests", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllGuests));
    router.get("/guests/:guestId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getGuestById));
    router.post("/guests", authenticate, authorize(ADMIN_ONLY_POLICY), asyncHandler(controller.createGuest));
    router.patch("/guests/:guestId", authenticate, authorize(ADMIN_ONLY_POLICY), asyncHandler(controller.updateGuest));
    router.delete("/guests/:guestId", authenticate, authorize(ADMIN_ONLY_POLICY), asyncHandler(controller.removeGuest));

    router.get("/me/friendships", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyFriendships));
    router.get("/profile/me", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyFullProfile));
    router.get("/profile/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUserFullProfile));
    router.get("/name/:name", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllByName));
    router.get("/:eId/friendships", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUserFriendships));
    router.get("/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getById));

    if (controller.TEMPORARY_CREATE) router.post("/create", asyncHandler(controller.TEMPORARY_CREATE));

    return router;
}
