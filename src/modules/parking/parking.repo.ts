import z from "zod";
import { Db } from "../../infra/db/db";
import { ParkingReservation, ParkingReservationCount } from "./parking.schema";

export type ParkingRepo = {
    getAll: () => Promise<ParkingReservation[]>;
    getAvailabilityBetween: (userId: string, startTime: string, endTime: string) => Promise<ParkingReservationCount[]>;

    reserveBetween: (parkingLotId: number, userId: string, startTime: string, endTime: string) => Promise<ParkingReservation | null>;
    reassignParkingReservation: (id: number, newParkingLotId: number) => Promise<ParkingReservation | null>;

    remove: (id: number) => Promise<boolean>;
};

export function makeParkingRepo(db: Db): ParkingRepo {


    return {

    };
}
