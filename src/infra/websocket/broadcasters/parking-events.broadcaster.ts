import { parkingEvents } from "../../events/parking-events.emitter.js";
import { getIO, Rooms } from "../socket.server.js";
import type { ParkingReservation, ParkingLot } from "../../../modules/parking-slots/parking-slots.schema.js";
import type {
    ParkingUpdateMessage,
    ParkingReservationPublic,
    ParkingLotPublic,
    AdminUpdateMessage,
} from "../socket.types.js";

function toPublicReservation(r: ParkingReservation): ParkingReservationPublic {
    return {
        id: r.id,
        start_time: r.start_time,
        end_time: r.end_time,
        lifecycle_status: r.lifecycle_status,
        attendance_status: r.attendance_status,
        updated_at: r.updated_at,
    };
}

function toPublicLot(lot: ParkingLot): ParkingLotPublic {
    return {
        id: lot.id,
        name: lot.name,
        capacity: lot.capacity,
        priority: lot.priority,
    };
}

function emitParking(msg: ParkingUpdateMessage): void {
    try {
        getIO().to(Rooms.parking).emit("parkingUpdate", msg);
    } catch (err) {
        console.warn("[parking-broadcaster] Socket no disponible:", (err as Error).message);
    }
}

function emitToAdmin(event: AdminUpdateMessage): void {
    try {
        getIO().to(Rooms.admin).emit("adminUpdate", event);
    } catch (err) {
        console.warn("[parking-broadcaster] adminUpdate socket no disponible:", (err as Error).message);
    }
}

function broadcast(msg: ParkingUpdateMessage): void {
    emitParking(msg);
    emitToAdmin({ domain: "parking", event: msg });
}

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

    parkingEvents.on("lot.created", (lot) =>
        broadcast({ type: "lot.created", payload: toPublicLot(lot) })
    );
    parkingEvents.on("lot.updated", (lot) =>
        broadcast({ type: "lot.updated", payload: toPublicLot(lot) })
    );
    parkingEvents.on("lot.deleted", (id) =>
        broadcast({ type: "lot.deleted", payload: { id } })
    );
}
