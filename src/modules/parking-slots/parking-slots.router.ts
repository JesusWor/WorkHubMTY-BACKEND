import { Router } from "express";
import { ParkingSlotsController } from "./parking-slots.controller.js";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware/index.js";

/**
 * Rutas de Parking Lots.
 * CRUD simple, ADMIN RW y USER RO.
 * 
 * Rutas de Reservaciones de Estacionamiento.
 * POST - Solo crea reserva por periodo.
 * GET - Calcula una proyección de disponibilidad por periodo (no se guardan reservas, solo se calcula la disponibilidad proyectada).
 * PATCH - Muta estados operativos (CHECKED_IN, CHECKED_OUT, NO_SHOW).
 * DELETE - Cancela una reserva sin eliminarla fisicamente (cambia a CANCELED y se vuelve inmutable).)
 * 
 * @param controller 
 * @returns 
 */
export function makeParkingSlotsRouter(controller: ParkingSlotsController): Router {
    const router = Router();

    const SUPERVISOR_POLICY: RolePolicy = { allow: [Roles.ADMIN] };
    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    // Reservations

    router.post("/reservations", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.createReservation));

    router.get("/reservations/", authenticate, authorize(SUPERVISOR_POLICY), asyncHandler(controller.listReservations));
    router.get("/reservations/buckets", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getBuckets));
    router.get("/reservations/me", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyReservations));
    router.get("/reservations/:id", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getReservationDetail));

    router.patch("/reservations/:id/attendance", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.patchAttendance));

    router.delete("/reservations/:id", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.cancelReservation));

    // Parking Slots

    router.post("/", authenticate, authorize(SUPERVISOR_POLICY), asyncHandler(controller.createLot));
    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllLots));
    router.get("/:id", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getLotById));
    router.patch("/:id", authenticate, authorize(SUPERVISOR_POLICY), asyncHandler(controller.updateLot));
    router.delete("/:id", authenticate, authorize(SUPERVISOR_POLICY), asyncHandler(controller.deleteLot));

    return router;
}
