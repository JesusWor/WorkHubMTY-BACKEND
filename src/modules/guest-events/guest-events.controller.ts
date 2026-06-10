import { Request, Response } from 'express';
import { z } from 'zod';
import { EventsService } from './guest-events.service.js';
import { CreateEventSchema, ListEventsQuerySchema, PatchEventSchema } from './guest-events.schema.js';
import { GlobalResponse } from '../../shared/response/globalresponse.js';

export type EventsController = {
    listEvents: (req: Request, res: Response) => Promise<void>;
    getEventById: (req: Request, res: Response) => Promise<void>;
    createEvent: (req: Request, res: Response) => Promise<void>;
    resendToGuest: (req: Request, res: Response) => Promise<void>;
    patchEvent: (req: Request, res: Response) => Promise<void>;
    cancelEvent: (req: Request, res: Response) => Promise<void>;
};

export function makeEventsController(service: EventsService): EventsController {

    const parseEventId = (req: Request, res: Response): number | null => {
        const parsed = z.coerce.number().int().positive().safeParse(req.params.id);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, 'id must be a positive integer');
            return null;
        }
        return parsed.data;
    };

    const listEvents = async (req: Request, res: Response): Promise<void> => {
        const parsed = ListEventsQuerySchema.parse(req.query);
        const page = await service.listEvents(parsed);
        GlobalResponse.okWithData(res, page);
    };

    const getEventById = async (req: Request, res: Response): Promise<void> => {
        const id = parseEventId(req, res);
        if (id === null) return;
        const event = await service.getEventById(id);
        GlobalResponse.okWithData(res, event);
    };

    const createEvent = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateEventSchema.parse(req.body);
        const event = await service.createEvent(parsed, req.user!.eId);
        GlobalResponse.created(res, event);
    };

    const resendToGuest = async (req: Request, res: Response): Promise<void> => {
        const eventId = parseEventId(req, res);
        if (eventId === null) return;

        const guestParsed = z.coerce.number().int().positive().safeParse(req.params.guestId);
        if (!guestParsed.success) {
            GlobalResponse.badRequest(res, 'guestId must be a positive integer');
            return;
        }

        await service.resendToGuest(eventId, guestParsed.data);
        GlobalResponse.okNoContent(res, 'Correo reenviado');
    };

    const patchEvent = async (req: Request, res: Response): Promise<void> => {
        const id = parseEventId(req, res);
        if (id === null) return;

        const parsed = PatchEventSchema.parse(req.body);

        const updated = await service.patchEvent(id, parsed, req.user!.eId);
        GlobalResponse.okWithData(res, updated);
    };

    const cancelEvent = async (req: Request, res: Response): Promise<void> => {
        const id = parseEventId(req, res);
        if (id === null) return;
        await service.cancelEvent(id);
        GlobalResponse.ok(res, 'Evento cancelado');
    };

    return {
        listEvents,
        getEventById,
        createEvent,
        resendToGuest,
        patchEvent,
        cancelEvent,
    };
}
