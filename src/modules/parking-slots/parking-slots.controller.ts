import { Request, Response } from "express";
import { ParkingSlotsService } from "./parking-slots.service";
import { GlobalResponse } from "../../shared/response/globalresponse";
import { CreateParkingReservationSchema, ReassignParkingReservationSchema, ParkingIdParamSchema, ParkingAvailabilityQuerySchema } from "./parking-slots.schema";
import { JwtPayload } from "../../shared/schemas/auth.schema";

export type ParkingSlotsController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getAvailabilityBetween: (req: Request, res: Response) => Promise<void>;

    autoReserveBetween: (req: Request, res: Response) => Promise<void>;
    reassignParkingReservation: (req: Request, res: Response) => Promise<void>;

    remove: (req: Request, res: Response) => Promise<void>;
};

export function makeParkingSlotsController(service: ParkingSlotsService): ParkingSlotsController {

    const getAll = async (_req: Request, res: Response): Promise<void> => {
        const reservations = await service.getAll();
        GlobalResponse.okWithData(res, reservations);
    };

    const getAvailabilityBetween = async (req: Request, res: Response): Promise<void> => {
        const parsed = ParkingAvailabilityQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        const { start_time, end_time } = parsed.data;

        const availability = await service.getAvailabilityBetween(start_time, end_time);
        GlobalResponse.okWithData(res, availability);
    };

    const autoReserveBetween = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateParkingReservationSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        const { start_time, end_time } = parsed.data;

        const reservation = await service.autoReserveBetween(user.eId, start_time, end_time);
        GlobalResponse.created(res, reservation);
    };

    const reassignParkingReservation = async (req: Request, res: Response): Promise<void> => {
        const paramParsed = ParkingIdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
            GlobalResponse.zodError(res, paramParsed.error);
            return;
        }

        const bodyParsed = ReassignParkingReservationSchema.safeParse(req.body);
        if (!bodyParsed.success) {
            GlobalResponse.zodError(res, bodyParsed.error);
            return;
        }

        const { id } = paramParsed.data;
        const { parking_lot_id } = bodyParsed.data;

        const updated = await service.reassignParkingReservation(id, parking_lot_id);
        GlobalResponse.okWithData(res, updated);
    };

    const remove = async (req: Request, res: Response): Promise<void> => {
        const parsed = ParkingIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const user = req.user as JwtPayload;
        await service.remove(parsed.data.id, user);
        GlobalResponse.ok(res, `Reservación ${parsed.data.id} eliminada`);
    };

    return {
        getAll,
        getAvailabilityBetween,
        autoReserveBetween,
        reassignParkingReservation,
        remove,
    };
}