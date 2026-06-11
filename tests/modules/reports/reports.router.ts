import { Router } from "express";
import { ReportsController } from "./reports.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeReportsRouter(controller: ReportsController): Router {
    const router = Router();

    /*
        GET /stats/:userId/attendance
        Query params: period (day|week|month), from (YYYY-MM-DD), to (YYYY-MM-DD)
    */
    router.get("/stats/:userId/attendance", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getAttendanceStats));

    /*
        GET /stats/:userId/reservations
        Query params: period (day|week|month), from (YYYY-MM-DD), to (YYYY-MM-DD)
    */
    router.get("/stats/:userId/reservations", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getReservationStats));

    return router;
}