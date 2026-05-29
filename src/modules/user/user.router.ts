import { Router } from "express";
import { UserController } from "./user.controller.js";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware/index.js";

export function makeUserRouter(controller: UserController): Router {
    const router = Router();

    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };
    const ADMIN_ONLY_POLICY: RolePolicy = { allow: [Roles.ADMIN] };

    router.get("/groups", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllGroups));
    router.get("/groups/me", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyGroups));
    router.patch("/groups/:groupId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.updateGroup));
    router.delete("/groups/:groupId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.removeGroup));
    router.patch("/groups/:groupId/members", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.addGroupMembers));
    router.delete("/groups/:groupId/members", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.removeGroupMembers));

    // router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAll));
    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUsers));

    router.get("/guests", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllGuests));
    router.get("/guests/:guestId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getGuestById));
    router.post("/guests", authenticate, authorize(ADMIN_ONLY_POLICY), asyncHandler(controller.createGuest));
    router.patch("/guests/:guestId", authenticate, authorize(ADMIN_ONLY_POLICY), asyncHandler(controller.updateGuest));
    router.delete("/guests/:guestId", authenticate, authorize(ADMIN_ONLY_POLICY), asyncHandler(controller.removeGuest));

    router.get("/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getById));

    router.get("/me/friendships", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyFriendships));
    router.get("/:eId/friendships", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUserFriendships));

    router.get("/name/:name", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllByName));

    router.get("/profile/me", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyFullProfile));
    router.get("/profile/:eId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getUserFullProfile));

    if (controller.TEMPORARY_CREATE) router.post("/create", asyncHandler(controller.TEMPORARY_CREATE));

    return router;
}
