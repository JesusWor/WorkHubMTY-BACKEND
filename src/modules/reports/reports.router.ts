import { Router } from "express";
import { ReportsController } from "./reports.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeReportsRouter(controller: ReportsController): Router {
    const router = Router();

    // GET /stats/global/attendance
    router.get("/stats/global/attendance",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }),
        asyncHandler(controller.getGlobalAttendanceStats));

    // GET /stats/global/reservations
    router.get("/stats/global/reservations",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }),
        asyncHandler(controller.getGlobalReservationStats));

    // GET /stats/global/top?limit=10
    router.get("/stats/global/top",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }),
        asyncHandler(controller.getTopUsersByAttendance));

    // GET /stats/global/export → descarga .xlsx
    router.get("/stats/global/export",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT] }),
        asyncHandler(controller.exportGlobalAttendance));

    // GET /stats/:userId/attendance
    router.get("/stats/:userId/attendance",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getAttendanceStats));

    // GET /stats/:userId/reservations
    router.get("/stats/:userId/reservations",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
        asyncHandler(controller.getReservationStats));

    return router;
}