import { Router } from "express";
import { OfficeSlotsController } from "./office-slots.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeReservationsRouter(controller: OfficeSlotsController): Router {
    const router = Router();

    router.get("/me", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getMyReservations));
    router.get("/me/friends", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getMyFriendsReservations));
    router.get("/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getReservationDetail));
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.createReservations));
    router.patch("/participants/:pid/status", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.updateParticipantStatus));

    return router;
}
