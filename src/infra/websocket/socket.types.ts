import { Server, Socket } from "socket.io";
import type { Notification } from "../../modules/notifications/notifications.schema.js";
import type { UserStatus } from "../../modules/user/user-status.service.js";
import type { User, Guest } from "../../modules/user/user.schema.js";
import type { Friendship, FriendRequest } from "../../modules/friendship/friendship.schema.js";
import type { Team, TeamMembers } from "../../modules/teams/teams.schema.js";
import type {
    ParkingReservation,
    ParkingLot,
} from "../../modules/parking-slots/parking-slots.schema.js";

// ─── Rooms ────────────────────────────────────────────────────────────────────
//
// Naming convention:
//   "dm:{eId}"            — canal privado de un usuario (point-to-point)
//   "friends:{eId}"       — room donde están todos los amigos del usuario eId
//                           (cada usuario se une a "friends:X" por cada amigo X que tiene)
//   "team:{teamId}"       — canal público del equipo (metadata sin lista de usuarios)
//   "teamMembers:{teamId}"— canal privado del equipo, solo miembros (payload completo)
//   "parking"             — canal público de parking
//   "admin"               — canal exclusivo para admins (asignado por el server)
//
// El server asigna rooms en conexión y en respuesta a eventos del cliente.
// El cliente NUNCA elige su propio "dm" ni "admin" — el server los asigna.

export type RoomName =
    | `dm:${string}`
    | `friends:${string}`
    | `team:${string}`
    | `teamMembers:${string}`
    | "parking"
    | "admin";

/** Payload público de reserva (sin user_id) para el canal "parking" */
export type ParkingReservationPublic = Pick<
    ParkingReservation,
    "id" | "start_time" | "end_time" | "lifecycle_status" | "attendance_status" | "allocation_state" | "updated_at"
>;

/** Payload público de lot */
export type ParkingLotPublic = Pick<ParkingLot, "id" | "name" | "capacity" | "priority">;

export type ParkingUpdateMessage =
    | { type: "reservation.created"; payload: ParkingReservationPublic }
    | { type: "reservation.canceled"; payload: ParkingReservationPublic }
    | { type: "reservation.attendance_updated"; payload: ParkingReservationPublic }
    | { type: "reservation.no_show"; payload: ParkingReservationPublic }
    | { type: "lot.created"; payload: ParkingLotPublic }
    | { type: "lot.updated"; payload: ParkingLotPublic }
    | { type: "lot.deleted"; payload: { id: number } };

export type UserUpdateMessage =
    | { type: "user.updated"; payload: User }
    | { type: "user.deleted"; payload: { eId: string } }
    | { type: "friendship.created"; payload: Friendship }
    | { type: "friendship.removed"; payload: { userLow: string; userHigh: string } }
    | { type: "friendRequest.sent"; payload: FriendRequest }
    | { type: "friendRequest.accepted"; payload: FriendRequest }
    | { type: "friendRequest.canceled"; payload: FriendRequest }
    | { type: "friendRequest.rejected"; payload: FriendRequest };

/** Payload para el canal público "team:{id}" — no expone lista de usuarios */
export type TeamPublicUpdate =
    | { type: "team.updated"; payload: Team }
    | { type: "team.deleted"; payload: { teamId: number } };

/** Payload para el canal privado "teamMembers:{id}" — payload completo */
export type TeamMembersUpdate =
    | { type: "team.updated"; payload: TeamMembers }
    | { type: "team.memberAdded"; payload: TeamMembers }
    | { type: "team.memberRemoved"; payload: TeamMembers };


// ─── Admin-only payloads ──────────────────────────────────────────────────────
// El canal "admin" recibe una copia de absolutamente todo, sin filtrar.
export type AdminUpdateMessage =
    | { domain: "parking"; event: ParkingUpdateMessage }
    | { domain: "user"; event: UserUpdateMessage | { type: "user.created"; payload: User } | { type: "guest.created"; payload: Guest } | { type: "guest.updated"; payload: Guest } | { type: "guest.deleted"; payload: { guestId: number } } }
    | { domain: "team"; event: TeamMembersUpdate | { type: "team.created"; payload: TeamMembers } | { type: "team.deleted"; payload: { teamId: number } } };

// ─── Socket event maps ────────────────────────────────────────────────────────

export interface ServerToClientEvents {
    notification: (data: Notification) => void;

    statusChanged: (data: { eId: string; status: UserStatus }) => void;
    userUpdate: (data: UserUpdateMessage) => void;

    teamPublicUpdate: (data: TeamPublicUpdate) => void;
    teamMembersUpdate: (data: TeamMembersUpdate) => void;

    parkingUpdate: (data: ParkingUpdateMessage) => void;

    adminUpdate: (data: AdminUpdateMessage) => void;
}

export interface ClientToServerEvents {
    ping: () => void;

    joinUserRoom: (userId: string) => void;

    joinParkingRoom: () => void;
    leaveParkingRoom: () => void;

    joinFriendsRoom: () => void;
    leaveFriendsRoom: () => void;

    joinTeamRoom: (teamId: number) => void;
    leaveTeamRoom: (teamId: number) => void;
}

// ─── Typed aliases ────────────────────────────────────────────────────────────

export type SocketData = {
    eId: string;
    role: string;
};

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
