import { Request, Response } from 'express';
import { OfficeSlotsService } from './office-slots.service.js';
import { GlobalResponse } from '../../shared/response/globalresponse.js';
import {
    CreateReservableSchema,
    UpdateReservableSchema,
    CreateReservationBatchSchema,
    BlockBatchSchema,
    PatchReservationAttendanceSchema,
    PatchParticipantAttendanceSchema,
    ListReservationsQuerySchema,
    ReservationIdParamSchema,
    ParticipantIdParamSchema,
    UserIdParamSchema,
    AvailableReservablesQuerySchema,
    ReservationIdBodySchema,
    ReservationDetailQuerySchema,
    SlotCodeParamSchema,
    MyReservationsQuerySchema,
} from './office-slots.schema.js';
import { JwtPayload } from '../../shared/schemas/auth.schema.js';

export type OfficeSlotsController = {
    // Reservables
    getAllReservables: (req: Request, res: Response) => Promise<void>;
    getAvailableReservables: (req: Request, res: Response) => Promise<void>;
    getReservableById: (req: Request, res: Response) => Promise<void>;
    createReservable: (req: Request, res: Response) => Promise<void>;
    updateReservable: (req: Request, res: Response) => Promise<void>;
    deleteReservable: (req: Request, res: Response) => Promise<void>;
    getReservationsForSlot: (req: Request, res: Response) => Promise<void>;

    // Blocks
    createBlockBatch: (req: Request, res: Response) => Promise<void>;
    cancelBlock: (req: Request, res: Response) => Promise<void>;

    // Reservations
    listReservations: (req: Request, res: Response) => Promise<void>;
    getReservationDetail: (req: Request, res: Response) => Promise<void>;
    getMyReservations: (req: Request, res: Response) => Promise<void>;
    createReservationBatch: (req: Request, res: Response) => Promise<void>;
    cancelReservation: (req: Request, res: Response) => Promise<void>;
    participantCheckin: (req: Request, res: Response) => Promise<void>;
    participantCheckout: (req: Request, res: Response) => Promise<void>;
    patchReservationAttendance: (req: Request, res: Response) => Promise<void>;
    patchParticipantAttendance: (req: Request, res: Response) => Promise<void>;

    // Vista por usuario
    getUserReservationsList: (req: Request, res: Response) => Promise<void>;

    // Self check-in by slot code
    slotCheckin: (req: Request, res: Response) => Promise<void>;
};

export function makeOfficeSlotsController(service: OfficeSlotsService): OfficeSlotsController {
    // Reservables

    const getAllReservables = async (_req: Request, res: Response): Promise<void> => {
        const slots = await service.getAllReservables();
        GlobalResponse.okWithData(res, slots);
    };

    const getAvailableReservables = async (_req: Request, res: Response): Promise<void> => {
        const parsed = AvailableReservablesQuerySchema.safeParse(_req.query);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const slots = await service.getAvailableReservables(parsed.data);
        GlobalResponse.okWithData(res, slots);
    };

    const getReservableById = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const parsedQuery = ReservationDetailQuerySchema.safeParse(req.query);

        const slot = await service.getReservableById(
            parsed.data.id,
            parsedQuery.data ? parsedQuery.data.detail : undefined,
        );
        GlobalResponse.okWithData(res, slot);
    };

    const createReservable = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateReservableSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const slot = await service.createReservable(parsed.data);
        GlobalResponse.created(res, slot);
    };

    const updateReservable = async (req: Request, res: Response): Promise<void> => {
        const paramParsed = ReservationIdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
            GlobalResponse.zodError(res, paramParsed.error);
            return;
        }
        const bodyParsed = UpdateReservableSchema.safeParse(req.body);
        if (!bodyParsed.success) {
            GlobalResponse.zodError(res, bodyParsed.error);
            return;
        }
        const slot = await service.updateReservable(paramParsed.data.id, bodyParsed.data);
        GlobalResponse.okWithData(res, slot);
    };

    const deleteReservable = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        await service.deleteReservable(parsed.data.id);
        GlobalResponse.ok(res, `Slot ${parsed.data.id} eliminado`);
    };

    const getReservationsForSlot = async (req: Request, res: Response): Promise<void> => {
        const parsedParams = ReservationIdParamSchema.safeParse(req.params);

        if (!parsedParams.success) {
            GlobalResponse.zodError(res, parsedParams.error);
            return;
        }

        const parsedQuery = ReservationDetailQuerySchema.safeParse(req.query);

        if (!parsedQuery.success) {
            GlobalResponse.zodError(res, parsedQuery.error);
            return;
        }

        const parsedBody = ReservationIdBodySchema.safeParse(req.body ?? {});

        if (!parsedBody.success) {
            GlobalResponse.zodError(res, parsedBody.error);
            return;
        }

        const reservations = await service.getReservationsForSlot(
            parsedParams.data.id,
            {
                dates: parsedBody.data.dates,
                startTime: parsedBody.data.start_time,
                endTime: parsedBody.data.end_time,
            },
            parsedQuery.data.detail,
            parsedQuery.data.showInactiveReservations
        );

        GlobalResponse.okWithData(res, reservations);
    };
    // Reservations

    const listReservations = async (req: Request, res: Response): Promise<void> => {
        const parsed = ListReservationsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const { items, nextCursor } = await service.listReservations(parsed.data, caller);
        GlobalResponse.okWithCursor(res, items, nextCursor);
    };

    const getReservationDetail = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const detail = await service.getReservationDetail(parsed.data.id, caller);
        GlobalResponse.okWithData(res, detail);
    };

    const getMyReservations = async (req: Request, res: Response): Promise<void> => {
        const caller = req.user as JwtPayload;
        const parsedQuery = MyReservationsQuerySchema.safeParse(req.query)

        if(!parsedQuery.success){
            GlobalResponse.zodError(res, parsedQuery.error)
            return;
        }

        const reservations = await service.getMyReservations(caller, parsedQuery.data?.scope);
        GlobalResponse.okWithData(res, reservations);
    };

    const createReservationBatch = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateReservationBatchSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const created = await service.createReservationBatch(parsed.data, caller);
        GlobalResponse.created(res, created);
    };

    const cancelReservation = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const updated = await service.cancelReservation(parsed.data.id, caller);
        GlobalResponse.okWithData(res, updated);
    };

    const participantCheckin = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const result = await service.participantCheckin(parsed.data.id, caller);
        GlobalResponse.okWithData(res, result);
    };

    const participantCheckout = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const result = await service.participantCheckout(parsed.data.id, caller);
        GlobalResponse.okWithData(res, result);
    };

    const patchReservationAttendance = async (req: Request, res: Response): Promise<void> => {
        const paramParsed = ReservationIdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
            GlobalResponse.zodError(res, paramParsed.error);
            return;
        }
        const bodyParsed = PatchReservationAttendanceSchema.safeParse(req.body);
        if (!bodyParsed.success) {
            GlobalResponse.zodError(res, bodyParsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const updated = await service.patchReservationAttendance(
            paramParsed.data.id,
            bodyParsed.data.attendance_status,
            caller,
        );
        GlobalResponse.okWithData(res, updated);
    };

    const patchParticipantAttendance = async (req: Request, res: Response): Promise<void> => {
        const paramParsed = ParticipantIdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
            GlobalResponse.zodError(res, paramParsed.error);
            return;
        }
        const bodyParsed = PatchParticipantAttendanceSchema.safeParse(req.body);
        if (!bodyParsed.success) {
            GlobalResponse.zodError(res, bodyParsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const updated = await service.patchParticipantAttendance(
            paramParsed.data.id,
            paramParsed.data.participantId,
            bodyParsed.data.attendance_status,
            caller,
        );
        GlobalResponse.okWithData(res, updated);
    };

    // Vista por usuario

    const getUserReservationsList = async (req: Request, res: Response): Promise<void> => {
        const parsed = UserIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        const result = await service.getUserReservationsView(parsed.data.userId, caller);
        GlobalResponse.okWithData(res, result);
    };

    const slotCheckin = async (req: Request, res: Response): Promise<void> => {
        const parsed = SlotCodeParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const caller = req.user as JwtPayload;
        try {
            const result = await service.slotCheckin(parsed.data.code, caller);
            GlobalResponse.okWithData(res, result);
        } catch (err: any) {
            // 425 Too Early — send structured early-checkin payload
            if (err?.statusCode === 425) {
                res.status(425).json({ data: err.payload });
                return;
            }
            throw err;
        }
    };

    // Blocks

    const createBlockBatch = async (req: Request, res: Response): Promise<void> => {
        const parsed = BlockBatchSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const created = await service.createBlockBatch(parsed.data);
        GlobalResponse.created(res, created);
    };

    const cancelBlock = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        await service.cancelBlock(parsed.data.id);
        GlobalResponse.ok(res);
    };

    return {
        getAllReservables,
        getAvailableReservables,
        getReservableById,
        createReservable,
        updateReservable,
        deleteReservable,
        getReservationsForSlot,

        createBlockBatch,
        cancelBlock,

        listReservations,
        getReservationDetail,
        getMyReservations,
        createReservationBatch,
        cancelReservation,
        participantCheckin,
        participantCheckout,
        patchReservationAttendance,
        patchParticipantAttendance,

        getUserReservationsList,
        slotCheckin,
    };
}
