import { parkingEvents } from "./parking-events.emitter.js";
import { getIO } from "../websocket/socket.server.js";
import { ParkingReservation, ParkingLot } from "../../modules/parking-slots/parking-slots.schema.js";

// ─── Socket payload shape ─────────────────────────────────────────────────────
// Publicamos al room global "parking" con datos anónimos (sin user_id).
// Si en el futuro necesitas emisión por usuario, agrega otro listener aquí.

type ParkingSocketMessage =
    | { type: "reservation.created"; payload: ReservationPublicPayload }
    | { type: "reservation.canceled"; payload: ReservationPublicPayload }
    | { type: "reservation.attendance_updated"; payload: ReservationPublicPayload }
    | { type: "reservation.no_show"; payload: ReservationPublicPayload }
    | { type: "lot.created"; payload: ParkingLot }
    | { type: "lot.updated"; payload: ParkingLot }
    | { type: "lot.deleted"; payload: { id: number } };

// Sólo campos no-sensibles para el canal global
type ReservationPublicPayload = {
    id: number;
    start_time: Date;
    end_time: Date;
    lifecycle_status: ParkingReservation["lifecycle_status"];
    attendance_status: ParkingReservation["attendance_status"];
    allocation_state: ParkingReservation["allocation_state"];
    updated_at: Date;
};

function toPublicReservation(r: ParkingReservation): ReservationPublicPayload {
    return {
        id: r.id,
        start_time: r.start_time,
        end_time: r.end_time,
        lifecycle_status: r.lifecycle_status,
        attendance_status: r.attendance_status,
        allocation_state: r.allocation_state,
        updated_at: r.updated_at,
    };
}

function broadcast(msg: ParkingSocketMessage) {
    try {
        getIO().to("parking").emit("parkingUpdate", msg);
    } catch (err) {
        // Socket aún no inicializado (ej: durante tests o startup)
        console.warn("[parking-broadcaster] Socket no disponible:", (err as Error).message);
    }
}

// ─── Register listeners ────────────────────────────────────────────────────────

export function initParkingBroadcaster(): void {
    parkingEvents.on("reservation.created", (r) =>
        broadcast({ type: "reservation.created", payload: toPublicReservation(r) })
    );

    parkingEvents.on("reservation.canceled", (r) =>
        broadcast({ type: "reservation.canceled", payload: toPublicReservation(r) })
    );

    parkingEvents.on("reservation.attendance_updated", (r) =>
        broadcast({ type: "reservation.attendance_updated", payload: toPublicReservation(r) })
    );

    parkingEvents.on("reservation.no_show", (r) =>
        broadcast({ type: "reservation.no_show", payload: toPublicReservation(r) })
    );

    parkingEvents.on("lot.created", (lot) => broadcast({ type: "lot.created", payload: lot }));
    parkingEvents.on("lot.updated", (lot) => broadcast({ type: "lot.updated", payload: lot }));
    parkingEvents.on("lot.deleted", (id) => broadcast({ type: "lot.deleted", payload: { id } }));
}
