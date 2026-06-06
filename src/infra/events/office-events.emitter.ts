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
    "office.reservation.created": [payload: OfficeReservationPayload];
    "office.reservation.canceled": [payload: OfficeReservationPayload];
    "office.reservation.checkedin": [payload: OfficeReservationPayload];
    "office.reservation.attendance_updated": [payload: OfficeReservationPayload];
    "office.reservation.noshow": [payload: OfficeReservationPayload];
    "office.reservation.checkedout": [payload: OfficeReservationPayload];

    "office.participant.updated": [payload: OfficeReservationPayload];

    "office.slot.created": [slot: Reservable];
    "office.slot.updated": [slot: Reservable];
    "office.slot.deleted": [slotId: number];
};

export type OfficeEventsEmitter = TypedEventEmitter<OfficeEventMap>;

export const officeEvents = new TypedEventEmitter<OfficeEventMap>();
