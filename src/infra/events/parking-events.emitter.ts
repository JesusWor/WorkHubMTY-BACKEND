import { TypedEventEmitter } from "./typed-event-emitter.js";
import type {
    ParkingReservation,
    ParkingLot,
} from "../../modules/parking-slots/parking-slots.schema.js";

export type ParkingEventMap = {
    "parking.reservation.created": [reservation: ParkingReservation];
    "parking.reservation.canceled": [reservation: ParkingReservation];
    "parking.reservation.attendance_updated": [reservation: ParkingReservation];
    "parking.reservation.noshow": [reservation: ParkingReservation];

    "parking.lot.created": [lot: ParkingLot];
    "parking.lot.updated": [lot: ParkingLot];
    "parking.lot.deleted": [lotId: number];
};

export type ParkingEventsEmitter = TypedEventEmitter<ParkingEventMap>;
export const parkingEvents = new TypedEventEmitter<ParkingEventMap>();
