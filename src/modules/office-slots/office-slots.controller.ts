import { Request, Response } from "express";
import { OfficeSlotsService } from "./office-slots.service.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import {
    CreateOfficeSlotSchema,
    UpdateOfficeSlotSchema,
    BlockSlotBodySchema,
    AvailableOfficeSlotsSchema,
    CreateReservationBatchSchema,
    UpdateParticipantStatusSchema,
    SlotIdParamSchema,
    ParticipantIdParamSchema,
    CreateEventSchema,
    GetEventsQuerySchema,
} from "./office-slots.schema.js";

export type OfficeSlotsController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getAvailable: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;
    create: (req: Request, res: Response) => Promise<void>;
    update: (req: Request, res: Response) => Promise<void>;
    remove: (req: Request, res: Response) => Promise<void>;
    setBlock: (req: Request, res: Response) => Promise<void>;
    getWorkGroups: (req: Request, res: Response) => Promise<void>;
    getUsers: (req: Request, res: Response) => Promise<void>;
    getGuests: (req: Request, res: Response) => Promise<void>;
    getReservationDetail: (req: Request, res: Response) => Promise<void>;
    createReservations: (req: Request, res: Response) => Promise<void>;
    updateParticipantStatus: (req: Request, res: Response) => Promise<void>;
    getMyReservations: (req: Request, res: Response) => Promise<void>;
    getMyFriendsReservations: (req: Request, res: Response) => Promise<void>;
    // ─── Events ───────────────────────────────────────────────────────────────────
    getEvents: (req: Request, res: Response) => Promise<void>;
    getEventById: (req: Request, res: Response) => Promise<void>;
    createEvent: (req: Request, res: Response) => Promise<void>;
}

export function makeOfficeSlotsController(service: OfficeSlotsService): OfficeSlotsController {
    // FEATURE 1: OFFICE SLOTS (Espacios de trabajo)

    const getAll = async (req: Request, res: Response): Promise<void> => {
        const floor_id = req.query.floor_id ? Number(req.query.floor_id) : undefined;
        const slots = await service.getAllSlots({ floor_id });
        GlobalResponse.okWithData(res, slots);
    };

    const getAvailable = async (req: Request, res: Response): Promise<void> => {
        const query = AvailableOfficeSlotsSchema.parse(req.query);
        const slots = await service.getAvailableSlots(query);
        GlobalResponse.okWithData(res, slots);
    };

    const getById = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const slot = await service.getSlotById(id);
        GlobalResponse.okWithData(res, slot);
    };

    const create = async (req: Request, res: Response): Promise<void> => {
        const body = CreateOfficeSlotSchema.parse(req.body);
        const slot = await service.createSlot(body);
        GlobalResponse.created(res, slot);
    };

    const update = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const body = UpdateOfficeSlotSchema.parse(req.body);
        const slot = await service.updateSlot(id, body);
        GlobalResponse.okWithData(res, slot);
    };

    const remove = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const result = await service.deleteSlot(id);
        GlobalResponse.ok(res, result.message);
    };

    const setBlock = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const body = BlockSlotBodySchema.parse(req.body);
        const slot = await service.setBlockStatus(id, body);
        GlobalResponse.okWithData(res, slot);
    };

    // FEATURE 2: WORK GROUPS (Grupos de trabajo)

    const getWorkGroups = async (req: Request, res: Response): Promise<void> => {
        const workGroups = await service.getWorkGroups();
        GlobalResponse.okWithData(res, workGroups);
    };

    // FEATURE 3: RESERVATIONS (Reservaciones)

    const getReservationDetail = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const detail = await service.getReservationDetail(id);
        GlobalResponse.okWithData(res, detail);
    };

    const createReservations = async (req: Request, res: Response): Promise<void> => {
        const body = CreateReservationBatchSchema.parse(req.body);
        const reservations = await service.createReservationBatch(body);
        GlobalResponse.created(res, reservations);
    };

    const updateParticipantStatus = async (req: Request, res: Response): Promise<void> => {
        const { pid } = ParticipantIdParamSchema.parse(req.params);
        const body = UpdateParticipantStatusSchema.parse(req.body);
        const participant = await service.updateParticipantStatus(pid, body.status, body.reinvite);
        GlobalResponse.okWithData(res, participant);
    };

    const getMyReservations = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?.eId;
        if (!userId) {
            GlobalResponse.badRequest(res, "User not authenticated");
            return;
        }
        const reservations = await service.getMyReservations(userId);
        GlobalResponse.okWithData(res, reservations);
    };

    const getMyFriendsReservations = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?.eId;
        if (!userId) {
            GlobalResponse.badRequest(res, "User not authenticated");
            return;
        }
        const reservations = await service.getMyFriendsReservations(userId);
        GlobalResponse.okWithData(res, reservations);
    };

    // FEATURE 4: EVENTS (Eventos)

    const getEvents = async (req: Request, res: Response): Promise<void> => {
        const query = GetEventsQuerySchema.parse(req.query);
        const events = await service.getEvents(query);
        GlobalResponse.okWithData(res, events);
    };

    const getEventById = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const event = await service.getEventById(id);
        GlobalResponse.okWithData(res, event);
    };

    const createEvent = async (req: Request, res: Response): Promise<void> => {
        const body = CreateEventSchema.parse(req.body);
        const event = await service.createEvent(body);
        GlobalResponse.created(res, event);
    };

    // METADATA ENDPOINTS (Metadata para clientes)

    const getUsers = async (req: Request, res: Response): Promise<void> => {
        const users = await service.getUsers();
        GlobalResponse.okWithData(res, users);
    };

    const getGuests = async (req: Request, res: Response): Promise<void> => {
        const guests = await service.getGuests();
        GlobalResponse.okWithData(res, guests);
    };

    return {
        getAll,
        getAvailable,
        getById,
        create,
        update,
        remove,
        setBlock,
        getWorkGroups,
        getUsers,
        getGuests,
        getReservationDetail,
        createReservations,
        updateParticipantStatus,
        getMyReservations,
        getMyFriendsReservations,
        getEvents,
        getEventById,
        createEvent,
    };
}
