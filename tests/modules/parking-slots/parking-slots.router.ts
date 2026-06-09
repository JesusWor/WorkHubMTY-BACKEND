import { Router } from "express";
import { ParkingSlotsController } from "./parking-slots.controller.js";
import { authenticate, authorize, INTERNAL_ROLES, SUPERVISOR_ROLES, STAFF_ROLES, asyncHandler } from "../../middleware/index.js";

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

    // Reservations

    router.post("/reservations", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.createReservation));

    router.get("/reservations", authenticate, authorize({ allow: SUPERVISOR_ROLES }), asyncHandler(controller.listReservations));
    router.get("/reservations/buckets", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.getBuckets));
    router.get("/reservations/me", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.getMyReservations));
    router.get("/reservations/:id", authenticate, authorize({ allow: [...INTERNAL_ROLES, ...STAFF_ROLES] }), asyncHandler(controller.getReservationDetail));

    router.patch("/reservations/:id/attendance", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.patchAttendance));
    router.post("/reservations/:id/checkin", authenticate, authorize({ allow: [...INTERNAL_ROLES, ...STAFF_ROLES] }), asyncHandler(controller.checkInAttendant));

    router.delete("/reservations/:id", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.cancelReservation));

    // Parking Slots

    router.post("/", authenticate, authorize({ allow: SUPERVISOR_ROLES }), asyncHandler(controller.createLot));
    router.get("/", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.getAllLots));
    router.get("/:id", authenticate, authorize({ allow: INTERNAL_ROLES }), asyncHandler(controller.getLotById));
    router.patch("/:id", authenticate, authorize({ allow: SUPERVISOR_ROLES }), asyncHandler(controller.updateLot));
    router.delete("/:id", authenticate, authorize({ allow: SUPERVISOR_ROLES }), asyncHandler(controller.deleteLot));

    return router;
}
