// office-slots.routes.ts
import { Router } from "express";
import { OfficeSlotsController } from "./office-slots.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeOfficeSlotsRouter(controller: OfficeSlotsController): Router {
    const router = Router();

    // FEATURE 1: OFFICE SLOTS (Espacios de trabajo)
    router.get("/office-slots/available", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAvailable));
    router.get("/office-slots", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAll));
    router.get("/office-slots/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getById));
    router.post("/office-slots", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.create));
    router.patch("/office-slots/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.update));
    router.delete("/office-slots/:id", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.remove));
    router.post("/office-slots/:id/block", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }), asyncHandler(controller.setBlock));

    // FEATURE 2: WORK GROUPS (Grupos de trabajo)
    router.get("/work-groups", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getWorkGroups));

    // FEATURE 3: RESERVATIONS (Reservaciones)
    router.get("/me", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getMyReservations));
    router.get("/me/friends", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getMyFriendsReservations));
    router.get("/:id", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getReservationDetail));
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.createReservations));
    router.patch("/participants/:id/status", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.updateParticipantStatus));

    // METADATA ENDPOINTS (Metadata para clientes)
    router.get("/users", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getUsers));
    router.get("/guests", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getGuests));

    return router;
}