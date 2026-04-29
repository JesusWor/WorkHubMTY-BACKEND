import { Router } from "express";
import { ParkingSlotsController } from "./parking-slots.controller";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware";

export function makeParkingSlotsRouter(controller: ParkingSlotsController): Router {
    const router = Router();

    const SUPERVISOR_POLICY: RolePolicy = { allow: [Roles.ADMIN] };
    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    router.get("/admin", authenticate, authorize(SUPERVISOR_POLICY), asyncHandler(controller.getAll));
    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAvailabilityBetween)); 

    router.post("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.autoReserveBetween)); 
    router.put("/:id", authenticate, authorize(SUPERVISOR_POLICY), asyncHandler(controller.reassignParkingReservation)); 

    router.delete("/:id", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.remove));

    return router;
}
