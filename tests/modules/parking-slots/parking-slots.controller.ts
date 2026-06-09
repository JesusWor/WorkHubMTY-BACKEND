import { Request, Response } from "express";
import { ParkingSlotsService } from "./parking-slots.service.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import {
    CreateParkingLotSchema,
    UpdateParkingLotSchema,
    CreateParkingReservationSchema,
    ListReservationsQuerySchema,
    ReservationBucketsQuerySchema,
    PatchAttendanceSchema,
    ReservationIdParamSchema,
} from "./parking-slots.schema.js";
import { JwtPayload } from "../../shared/schemas/auth.schema.js";
import { Roles } from "../../middleware/index.js";
import { mapRole } from "../../shared/utils/role.util.js";

export type ParkingSlotsController = {
    // Parking Lots
    createLot: (req: Request, res: Response) => Promise<void>;
    getAllLots: (req: Request, res: Response) => Promise<void>;
    getLotById: (req: Request, res: Response) => Promise<void>;
    updateLot: (req: Request, res: Response) => Promise<void>;
    deleteLot: (req: Request, res: Response) => Promise<void>;

    // Reservations
    createReservation: (req: Request, res: Response) => Promise<void>;
    listReservations: (req: Request, res: Response) => Promise<void>;
    getBuckets: (req: Request, res: Response) => Promise<void>;
    getMyReservations: (req: Request, res: Response) => Promise<void>;
    getReservationDetail: (req: Request, res: Response) => Promise<void>;
    patchAttendance: (req: Request, res: Response) => Promise<void>;
    checkInAttendant: (req: Request, res: Response) => Promise<void>;
    cancelReservation: (req: Request, res: Response) => Promise<void>;
};

export function makeParkingSlotsController(
    service: ParkingSlotsService
): ParkingSlotsController {

    // ── Parking Lots ──────────────────────────────────────────────────────────

    const createLot = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateParkingLotSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const lot = await service.createLot(parsed.data);
        GlobalResponse.created(res, lot);
    };

    const getAllLots = async (_req: Request, res: Response): Promise<void> => {
        const lots = await service.getAllLots();
        GlobalResponse.okWithData(res, lots);
    };

    const getLotById = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        const lot = await service.getLotById(parsed.data.id);
        GlobalResponse.okWithData(res, lot);
    };

    const updateLot = async (req: Request, res: Response): Promise<void> => {
        const paramParsed = ReservationIdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
            GlobalResponse.zodError(res, paramParsed.error);
            return;
        }

        const bodyParsed = UpdateParkingLotSchema.safeParse(req.body);
        if (!bodyParsed.success) {
            GlobalResponse.zodError(res, bodyParsed.error);
            return;
        }

        const lot = await service.updateLot(paramParsed.data.id, bodyParsed.data);
        GlobalResponse.okWithData(res, lot);
    };

    const deleteLot = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }
        await service.deleteLot(parsed.data.id);
        GlobalResponse.ok(res, `Cajón ${parsed.data.id} eliminado`);
    };

    // ── Reservations ──────────────────────────────────────────────────────────

    const createReservation = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateParkingReservationSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        const reservationDetail = await service.createReservation(user, parsed.data);
        GlobalResponse.created(res, reservationDetail);
    };

    const listReservations = async (req: Request, res: Response): Promise<void> => {
        const parsed = ListReservationsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const { items, nextCursor } = await service.listReservations(parsed.data);
        GlobalResponse.okWithCursor(res, items, nextCursor);
    };

    const getBuckets = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationBucketsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const bucketResponse = await service.getBuckets(parsed.data);
        GlobalResponse.okWithData(res, bucketResponse );
    };

    const getMyReservations = async (req: Request, res: Response): Promise<void> => {
        const eId = req.user?.eId;
        if (!eId) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const reservations = await service.getUserReservations(eId);
        GlobalResponse.okWithData(res, reservations);
    };

    const getReservationDetail = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const reqRole = req.user?.role;
        if (!reqRole) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const isAdminOrAttendant = mapRole(reqRole) === Roles.ADMIN || mapRole(reqRole) === Roles.ACCESS_ATTENDANT;
        const requesterId = isAdminOrAttendant ? undefined : req.user?.eId;

        const detail = await service.getReservationDetail(parsed.data.id, requesterId);
        GlobalResponse.okWithData(res, detail);
    };

    const patchAttendance = async (req: Request, res: Response): Promise<void> => {
        const paramParsed = ReservationIdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
            GlobalResponse.zodError(res, paramParsed.error);
            return;
        }

        const bodyParsed = PatchAttendanceSchema.safeParse(req.body);
        if (!bodyParsed.success) {
            GlobalResponse.zodError(res, bodyParsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        const updated = await service.patchAttendance(
            paramParsed.data.id,
            bodyParsed.data.attendance_status,
            user
        );
        GlobalResponse.okWithData(res, updated);
    };

    const checkInAttendant = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        const updated = await service.patchAttendance(
            parsed.data.id,
            "CHECKED_IN",
            user
        );
        GlobalResponse.okWithData(res, updated);
    }

    const cancelReservation = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReservationIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        const updated = await service.cancelReservation(parsed.data.id, user);
        GlobalResponse.okWithData(res, updated);
    };

    return {
        createLot,
        getAllLots,
        getLotById,
        updateLot,
        deleteLot,

        createReservation,
        listReservations,
        getBuckets,
        getMyReservations,
        getReservationDetail,
        patchAttendance,
        checkInAttendant,
        cancelReservation,
    };
}
