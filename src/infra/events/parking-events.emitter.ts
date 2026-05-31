import { TypedEventEmitter } from "./typed-event-emitter.js";
import type {
    ParkingReservation,
    ParkingLot,
} from "../../modules/parking-slots/parking-slots.schema.js";

export type ParkingEventMap = {
    "reservation.created": [reservation: ParkingReservation];
    "reservation.canceled": [reservation: ParkingReservation];
    "reservation.attendance_updated": [reservation: ParkingReservation];
    "reservation.no_show": [reservation: ParkingReservation];
    
    "lot.created": [lot: ParkingLot];
    "lot.updated": [lot: ParkingLot];
    "lot.deleted": [lotId: number];
};

export type ParkingEventsEmitter = TypedEventEmitter<ParkingEventMap>;
export const parkingEvents = new TypedEventEmitter<ParkingEventMap>();
