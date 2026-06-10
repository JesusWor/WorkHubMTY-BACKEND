import { officeEvents, OfficeReservationPayload } from "../../events/office-events.emitter.js";
import { getIO, Rooms } from "../socket.server.js";
import type { Reservable, Reservation, Participant, ParticipantPublic } from "../../../modules/office-slots/office-slots.schema.js";

export type OfficeParticipantPublic = {
    id: number;
    reservations_id: number;
    user_id: string | null;
    ownership_priority: number | null;
    attendance_status: string | null;
    created_at: Date;
    updated_at: Date;
};

export type OfficeReservationPublic = {
    id: number;
    reservable_id: number;
    category: string;
    start_time: Date;
    end_time: Date;
    description: string;
    attendance_status: string;
    lifecycle_status: string;
    updated_at: Date;
    reservable: Reservable;
    participants: OfficeParticipantPublic[];
};

export type OfficeUpdateMessage =
    | { type: "reservation.created"; payload: OfficeReservationPublic }
    | { type: "reservation.canceled"; payload: OfficeReservationPublic }
    | { type: "reservation.checkedin"; payload: OfficeReservationPublic }
    | { type: "reservation.checkedout"; payload: OfficeReservationPublic }
    | { type: "reservation.noshow"; payload: OfficeReservationPublic }
    | { type: "reservation.attendance_updated"; payload: OfficeReservationPublic }
    | { type: "participant.updated"; payload: OfficeReservationPublic }
    | { type: "slot.created"; payload: Reservable }
    | { type: "slot.updated"; payload: Reservable }
    | { type: "slot.deleted"; payload: { id: number } };

function buildPublicPayload(
    payload: OfficeReservationPayload,
    friendSet: Set<string>
): OfficeReservationPublic {
    const maskedParticipants: OfficeParticipantPublic[] = payload.participants.map(p => {
        if (friendSet.has(p.user_id)) {
            return p as OfficeParticipantPublic;
        }
        return {
            id: p.id,
            reservations_id: p.reservations_id,
            user_id: null,
            ownership_priority: null,
            attendance_status: null,
            created_at: p.created_at,
            updated_at: p.updated_at,
        };
    });

    return {
        id: payload.reservation.id,
        reservable_id: payload.reservation.reservable_id,
        category: payload.reservation.category,
        start_time: payload.reservation.start_time,
        end_time: payload.reservation.end_time,
        description: payload.reservation.description,
        attendance_status: payload.reservation.attendance_status,
        lifecycle_status: payload.reservation.lifecycle_status,
        updated_at: payload.reservation.updated_at,
        reservable: payload.reservable,
        participants: maskedParticipants,
    };
}

function buildAdminPayload(payload: OfficeReservationPayload): OfficeReservationPublic {
    return buildPublicPayload(payload, new Set(payload.participants.map(p => p.user_id)));
}

function emitToOfficeRoom(msg: OfficeUpdateMessage): void {
    try {
        getIO().to("office").emit("officeUpdate", msg);
    } catch (err) {
        console.warn("[office-broadcaster] officeUpdate socket no disponible:", (err as Error).message);
    }
}

function emitToAdmin(msg: OfficeUpdateMessage): void {
    try {
        getIO().to(Rooms.admin).emit("adminUpdate", { domain: "office", event: msg });
    } catch (err) {
        console.warn("[office-broadcaster] adminUpdate socket no disponible:", (err as Error).message);
    }
}

function emitToParticipants(
    payload: OfficeReservationPayload,
    type: OfficeUpdateMessage["type"]
): void {
    const fullPayload = buildAdminPayload(payload);
    const msg: OfficeUpdateMessage = { type, payload: fullPayload } as OfficeUpdateMessage;

    for (const participant of payload.participants) {
        try {
            getIO().to(Rooms.dm(participant.user_id)).emit("officeUpdate", msg);
        } catch (err) {
            console.warn(
                `[office-broadcaster] No se pudo emitir DM a ${participant.user_id}:`,
                (err as Error).message
            );
        }
    }
}

function broadcastReservationEvent(
    type: OfficeUpdateMessage["type"],
    payload: OfficeReservationPayload
): void {
    const publicMsg: OfficeUpdateMessage = {
        type,
        payload: buildAdminPayload(payload),
    } as OfficeUpdateMessage;

    emitToOfficeRoom(publicMsg);
    emitToAdmin(publicMsg);
    emitToParticipants(payload, type);
}

export function initOfficeBroadcaster(): void {
    officeEvents.on("office.reservation.created", (payload) =>
        broadcastReservationEvent("reservation.created", payload)
    );

    officeEvents.on("office.reservation.canceled", (payload) =>
        broadcastReservationEvent("reservation.canceled", payload)
    );

    officeEvents.on("office.reservation.checkedin", (payload) =>
        broadcastReservationEvent("reservation.checkedin", payload)
    );

    officeEvents.on("office.reservation.checkedout", (payload) =>
        broadcastReservationEvent("reservation.checkedout", payload)
    );

    officeEvents.on("office.reservation.noshow", (payload) =>
        broadcastReservationEvent("reservation.noshow", payload)
    );

    officeEvents.on("office.reservation.attendance_updated", (payload) =>
        broadcastReservationEvent("reservation.attendance_updated", payload)
    );

    officeEvents.on("office.participant.updated", (payload) =>
        broadcastReservationEvent("participant.updated", payload)
    );

    officeEvents.on("office.slot.created", (slot) => {
        const msg: OfficeUpdateMessage = { type: "slot.created", payload: slot };
        emitToOfficeRoom(msg);
        emitToAdmin(msg);
    });

    officeEvents.on("office.slot.updated", (slot) => {
        const msg: OfficeUpdateMessage = { type: "slot.updated", payload: slot };
        emitToOfficeRoom(msg);
        emitToAdmin(msg);
    });

    officeEvents.on("office.slot.deleted", (slotId) => {
        const msg: OfficeUpdateMessage = { type: "slot.deleted", payload: { id: slotId } };
        emitToOfficeRoom(msg);
        emitToAdmin(msg);
    });
}
