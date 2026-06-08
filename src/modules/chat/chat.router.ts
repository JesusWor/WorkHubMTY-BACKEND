import { Router } from 'express';
import { ChatController } from './chat.controller.js';
import { authenticate } from '../../middleware/authentication.middleware.js';

export function makeChatRouter(controller: ChatController): Router {
    const router = Router();
    router.post('/', authenticate, controller.chat);
    return router;
}
