import { Server, Socket } from "socket.io";
import { Notification } from "../../modules/notifications/notifications.schema.js";
import { UserStatus } from "../../modules/user/user-status.service.js";

// ─── Parking update payload (sin user_id — canal global "parking") ─────────────
export type ParkingUpdateMessage =
    | { type: "reservation.created"; payload: ParkingReservationPublic }
    | { type: "reservation.canceled"; payload: ParkingReservationPublic }
    | { type: "reservation.attendance_updated"; payload: ParkingReservationPublic }
    | { type: "reservation.no_show"; payload: ParkingReservationPublic }
    | { type: "lot.created"; payload: ParkingLotPublic }
    | { type: "lot.updated"; payload: ParkingLotPublic }
    | { type: "lot.deleted"; payload: { id: number } };

export type ParkingReservationPublic = {
    id: number;
    start_time: Date;
    end_time: Date;
    lifecycle_status: string;
    attendance_status: string;
    allocation_state: string;
    updated_at: Date;
};

export type ParkingLotPublic = {
    id: number;
    name: string;
    capacity: number;
    priority: number;
};

// ─── Socket event maps ────────────────────────────────────────────────────────

export interface ServerToClientEvents {
    notification: (data: Notification) => void;
    statusChanged: (data: { eId: string; status: UserStatus }) => void;
    parkingUpdate: (data: ParkingUpdateMessage) => void;
}

export interface ClientToServerEvents {
    ping: () => void;
    joinUserRoom: (userId: string) => void;
    joinParkingRoom: () => void;
    leaveParkingRoom: () => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;