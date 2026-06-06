import { Router } from 'express';
import { EventsController } from './guest-events.controller.js';
import { authenticate, authorize, SUPERVISOR_ROLES } from '../../middleware/index.js';
import { asyncHandler } from '../../middleware/index.js';

export function makeEventsRouter(controller: EventsController): Router {
    const router = Router();

    router.use(authenticate, authorize({ allow: SUPERVISOR_ROLES }));

    router.get('/', asyncHandler(controller.listEvents));
    router.get('/:id', asyncHandler(controller.getEventById));
    router.post('/', asyncHandler(controller.createEvent));
    router.post('/:id/resend/:guestId', asyncHandler(controller.resendToGuest));
    router.patch('/:id', asyncHandler(controller.patchEvent));
    router.delete('/:id', asyncHandler(controller.cancelEvent));

    return router;
}
