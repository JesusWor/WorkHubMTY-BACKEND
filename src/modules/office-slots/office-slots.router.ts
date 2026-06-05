import { Router } from 'express';
import { OfficeSlotsController } from './office-slots.controller.js';
import {
    authenticate,
    authorize,
    INTERNAL_ROLES,
    SUPERVISOR_ROLES,
    STAFF_ROLES,
    asyncHandler,
} from '../../middleware/index.js';

export function makeOfficeSlotsRouter(controller: OfficeSlotsController): Router {
    const router = Router();

    // Reservables - Office slots
    router.get(
        '/slots',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.getAllReservables),
    );
    router.get(
        '/slots/available',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.getAvailableReservables),
    );
    router.post(
        '/slots',
        authenticate,
        authorize({ allow: SUPERVISOR_ROLES }),
        asyncHandler(controller.createReservable),
    );
    router.get(
        '/slots/:id',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.getReservableById),
    );
    router.patch(
        '/slots/:id',
        authenticate,
        authorize({ allow: SUPERVISOR_ROLES }),
        asyncHandler(controller.updateReservable),
    );
    router.delete(
        '/slots/:id',
        authenticate,
        authorize({ allow: SUPERVISOR_ROLES }),
        asyncHandler(controller.deleteReservable),
    );

    // Reservations
    router.post(
        '/reservations',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.createReservationBatch),
    );
    router.get(
        '/reservations',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.listReservations),
    );
    router.get(
        '/reservations/me',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.getMyReservations),
    );
    router.get(
        '/reservations/:id',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.getReservationDetail),
    );

    router.post(
        '/reservations/:id/checkin',
        authenticate,
        authorize({ allow: [...INTERNAL_ROLES, ...STAFF_ROLES] }),
        asyncHandler(controller.participantCheckin),
    );
    router.post(
        '/reservations/:id/checkout',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.participantCheckout),
    );

    router.patch(
        '/reservations/:id/attendance',
        authenticate,
        authorize({ allow: [...SUPERVISOR_ROLES, ...STAFF_ROLES] }),
        asyncHandler(controller.patchReservationAttendance),
    );

    router.patch(
        '/reservations/:id/participants/:participantId/attendance',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.patchParticipantAttendance),
    );

    router.delete(
        '/reservations/:id',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.cancelReservation),
    );

    // User view
    router.get(
        '/users/:userId/reservations',
        authenticate,
        authorize({ allow: INTERNAL_ROLES }),
        asyncHandler(controller.getUserReservationsList),
    );

    return router;
}
