import { TypedEventEmitter } from "./typed-event-emitter.js";
import type {
    Reservable,
    Reservation,
    Participant,
} from "../../modules/office-slots/office-slots.schema.js";

export type OfficeReservationPayload = {
    reservation: Reservation;
    participants: Participant[];
    reservable: Reservable;
};

export type OfficeEventMap = {
    "reservation.created": [payload: OfficeReservationPayload];
    "reservation.canceled": [payload: OfficeReservationPayload];
    "reservation.checkedin": [payload: OfficeReservationPayload];
    "reservation.attendance_updated": [payload: OfficeReservationPayload];
    "reservation.noshow": [payload: OfficeReservationPayload];
    "reservation.checkedout": [payload: OfficeReservationPayload];

    "participant.updated": [payload: OfficeReservationPayload];

    "slot.created": [slot: Reservable];
    "slot.updated": [slot: Reservable];
    "slot.deleted": [slotId: number];
};

export type OfficeEventsEmitter = TypedEventEmitter<OfficeEventMap>;

export const officeEvents = new TypedEventEmitter<OfficeEventMap>();
