import { userEvents } from "../../events/user-events.emitter.js";
import { getIO, Rooms } from "../socket.server.js";
import type {
    UserUpdateMessage,
    AdminUpdateMessage,
} from "../socket.types.js";

function emitToAdmin(event: AdminUpdateMessage): void {
    try {
        getIO().to(Rooms.admin).emit("adminUpdate", event);
    } catch (err) {
        console.warn("[user-broadcaster] adminUpdate socket no disponible:", (err as Error).message);
    }
}

function emitUserUpdate(room: string, msg: UserUpdateMessage): void {
    try {
        getIO().to(room).emit("userUpdate", msg);
    } catch (err) {
        console.warn("[user-broadcaster] userUpdate socket no disponible:", (err as Error).message);
    }
}

export function initUserBroadcaster(): void {

    userEvents.on("user.updated", (user) => {
        const msg: UserUpdateMessage = { type: "user.updated", payload: user };
        emitUserUpdate(Rooms.friends(user.eId), msg);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("user.deleted", (eId) => {
        const msg: UserUpdateMessage = { type: "user.deleted", payload: { eId } };
        emitUserUpdate(Rooms.friends(eId), msg);
        emitUserUpdate(Rooms.dm(eId), msg);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("user.created", (user) => {
        emitToAdmin({ domain: "user", event: { type: "user.created", payload: user } });
    });

    userEvents.on("guest.created", (guest) => {
        emitToAdmin({ domain: "user", event: { type: "guest.created", payload: guest } });
    });
    userEvents.on("guest.updated", (guest) => {
        emitToAdmin({ domain: "user", event: { type: "guest.updated", payload: guest } });
    });
    userEvents.on("guest.deleted", (guestId) => {
        emitToAdmin({ domain: "user", event: { type: "guest.deleted", payload: { guestId } } });
    });

    userEvents.on("friendship.created", (friendship) => {
        const { userLow, userHigh } = friendship;
        const msg: UserUpdateMessage = { type: "friendship.created", payload: friendship };
        emitUserUpdate(Rooms.dm(userLow), msg);
        emitUserUpdate(Rooms.dm(userHigh), msg);
        addSocketsToFriendsRoom(userLow, userHigh);
        addSocketsToFriendsRoom(userHigh, userLow);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("friendship.removed", (userLow, userHigh) => {
        const msg: UserUpdateMessage = { type: "friendship.removed", payload: { userLow, userHigh } };
        emitUserUpdate(Rooms.dm(userLow), msg);
        emitUserUpdate(Rooms.dm(userHigh), msg);
        removeSocketsFromFriendsRoom(userLow, userHigh);
        removeSocketsFromFriendsRoom(userHigh, userLow);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("friendRequest.sent", (req) => {
        const msg: UserUpdateMessage = { type: "friendRequest.sent", payload: req };
        emitUserUpdate(Rooms.dm(req.fromUser), msg);
        emitUserUpdate(Rooms.dm(req.toUser), msg);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("friendRequest.accepted", (req) => {
        const msg: UserUpdateMessage = { type: "friendRequest.accepted", payload: req };
        emitUserUpdate(Rooms.dm(req.fromUser), msg);
        emitUserUpdate(Rooms.dm(req.toUser), msg);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("friendRequest.canceled", (req) => {
        const msg: UserUpdateMessage = { type: "friendRequest.canceled", payload: req };
        emitUserUpdate(Rooms.dm(req.fromUser), msg);
        emitUserUpdate(Rooms.dm(req.toUser), msg);
        emitToAdmin({ domain: "user", event: msg });
    });

    userEvents.on("friendRequest.rejected", (req) => {
        const msg: UserUpdateMessage = { type: "friendRequest.rejected", payload: req };
        emitUserUpdate(Rooms.dm(req.fromUser), msg);
        emitUserUpdate(Rooms.dm(req.toUser), msg);
        emitToAdmin({ domain: "user", event: msg });
    });
}

function addSocketsToFriendsRoom(ownerEId: string, newFriendEId: string): void {
    try {
        const io = getIO();
        // Todos los sockets cuya dm room sea "dm:{ownerEId}"
        io.in(Rooms.dm(ownerEId)).socketsJoin(Rooms.friends(newFriendEId));
    } catch (err) {
        console.warn("[user-broadcaster] addSocketsToFriendsRoom failed:", (err as Error).message);
    }
}

function removeSocketsFromFriendsRoom(ownerEId: string, exFriendEId: string): void {
    try {
        const io = getIO();
        io.in(Rooms.dm(ownerEId)).socketsLeave(Rooms.friends(exFriendEId));
    } catch (err) {
        console.warn("[user-broadcaster] removeSocketsFromFriendsRoom failed:", (err as Error).message);
    }
}
