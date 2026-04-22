import { Request, Response } from "express";
import { ParkingService } from "./parking.service";
import { GlobalResponse } from "../../shared/response/globalresponse";
import { } from "./parking.schema";

export type ParkingController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getAvailabilityBetween: (req: Request, res: Response) => Promise<void>;

    autoReserveBetween: (req: Request, res: Response) => Promise<void>;
    reassignParkingReservation: (req: Request, res: Response) => Promise<void>;

    remove: (req: Request, res: Response) => Promise<void>;
};

export function makeParkingController(service: ParkingService): ParkingController {


    return {

    };
}
