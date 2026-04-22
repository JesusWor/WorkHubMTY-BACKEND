import { ParkingRepo } from "./parking.repo";
import { ParkingReservation, ParkingReservationCount } from "./parking.schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors/AppError";
import { JwtPayload } from "../../shared/schemas/auth.schema";

export type ParkingService = {
    getAll: () => Promise<ParkingReservation[]>;
    getAvailabilityBetween: (userId: string, startTime: string, endTime: string) => Promise<ParkingReservationCount[]>;

    autoReserveBetween: (userId: string, startTime: string, endTime: string) => Promise<ParkingReservation | null>;
    reassignParkingReservation: (id: number, newParkingLotId: number) => Promise<ParkingReservation | null>;

    remove: (id: number, user: JwtPayload) => Promise<boolean>;
};

export function makeParkingService(repo: ParkingRepo): ParkingService {

    return {

    };
}
