import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { TypedServer, TypedSocket } from "./socket.types.js";
import { verifyToken } from "../../shared/utils/jwt.util.js";
import { UnauthorizedError, InternalError } from "../../shared/errors/AppError.js";
import type { UserStatusService } from "../../modules/user/user-status.service.js";
import type { UserService } from "../../modules/user/user.service.js";
import type { TeamsService } from "../../modules/teams/teams.service.js";
import { Roles } from "../../shared/types/role.type.js";
import { env } from "../../config/env.js";

const isProduction = env.server.nodeEnv === "production";

let io: TypedServer;

export type SocketServerDeps = {
    userStatusService: UserStatusService;
    userService: UserService;
    teamsService: TeamsService;
};

export const getIO = (): TypedServer => {
    if (!io) { throw new InternalError("Socket server not initialized"); }
    return io;
};

export const Rooms = {
    dm: (eId: string) => `dm:${eId}` as const,
    friends: (eId: string) => `friends:${eId}` as const,
    team: (teamId: number) => `team:${teamId}` as const,
    teamMembers: (teamId: number) => `teamMembers:${teamId}` as const,
    parking: "parking" as const,
    admin: "admin" as const,
} as const;

export const initSocket = (server: HttpServer, deps: SocketServerDeps) => {
    const { userStatusService, userService, teamsService } = deps;

    const allowedOrigins = [
        "http://localhost:3000",
        "https://costra.dev",
        "https://www.costra.dev",
    ];

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            credentials: true,
        },
    });

    // Authenticate socket via access token JWT passed in handshake.auth.
    // The client sends: io(url, { auth: { token: accessToken } })
    // This avoids cookies entirely and works cleanly with websockets.
    io.use((socket, next) => {
        try {
            const token = isProduction ? socket.handshake.auth?.token as string | undefined
                : socket.handshake.auth?.token as string | undefined
                ?? socket.handshake.headers["x-test-token"] as string | undefined;

            if (!token) {
                return next(new UnauthorizedError("Authentication error: no token"));
            }

            const payload = verifyToken(token);
            socket.data.eId = payload.eId;
            socket.data.role = payload.role;
            return next();
        } catch {
            return next(new UnauthorizedError("Authentication error: invalid token"));
        }
    });

    io.on("connection", async (socket: TypedSocket) => {
        const eId = socket.data.eId;
        const role = socket.data.role;

        console.log(`[socket] connected: ${eId} (${socket.id})`);

        // Personal dm room — asignado por el server, nunca por el cliente
        socket.join(Rooms.dm(eId));

        // Legacy personal room (backwards compat con notifications)
        socket.join(eId);

        // Admin room — el server decide, no el cliente
        if (role === Roles.ADMIN) {
            socket.join(Rooms.admin);
            console.log(`[socket] ${eId} joined admin room`);
        }

        await userStatusService.onConnect(eId);

        // ── Client-driven handlers ─────────────────────────────────────────────

        socket.on("ping", async () => {
            await userStatusService.onPing(eId);
        });

        // Legacy backwards compat
        socket.on("joinUserRoom", (userId: string) => {
            socket.join(userId);
            console.log(`[socket] ${socket.id} joined legacy room ${userId}`);
        });

        // Parking
        socket.on("joinParkingRoom", () => {
            socket.join(Rooms.parking);
            console.log(`[socket] ${eId} joined parking`);
        });

        socket.on("leaveParkingRoom", () => {
            socket.leave(Rooms.parking);
            console.log(`[socket] ${eId} left parking`);
        });

        // Friends room — el server resuelve friendIds y mete al socket en cada
        // "friends:{friendEId}" para que reciba actualizaciones de sus amigos.
        // También mete al socket en "friends:{eId}" propio para que otros amigos
        // que ya estén conectados reciban sus cambios.
        socket.on("joinFriendsRoom", async () => {
            try {
                const friends = await userService.getUserFriends(eId);

                // Suscribirse a las actualizaciones de cada amigo
                for (const friend of friends) {
                    socket.join(Rooms.friends(friend.eId));
                }

                // Meter al usuario en su propia friends room para que sus amigos lo vean
                socket.join(Rooms.friends(eId));

                console.log(`[socket] ${eId} joined ${friends.length} friends rooms`);
            } catch (err) {
                console.error(`[socket] joinFriendsRoom failed for ${eId}:`, err);
            }
        });

        socket.on("leaveFriendsRoom", async () => {
            try {
                const friends = await userService.getUserFriends(eId);

                for (const friend of friends) {
                    socket.leave(Rooms.friends(friend.eId));
                }

                socket.leave(Rooms.friends(eId));

                console.log(`[socket] ${eId} left friends rooms`);
            } catch (err) {
                console.error(`[socket] leaveFriendsRoom failed for ${eId}:`, err);
            }
        });

        // Team rooms — el server valida membresía antes de conceder el canal privado
        socket.on("joinTeamRoom", async (teamId: number) => {
            try {
                const myTeams = await teamsService.getMyTeams(eId);
                const isMember = myTeams.some((t) => t.id === teamId);

                // Canal público: cualquier usuario autenticado puede unirse
                socket.join(Rooms.team(teamId));

                // Canal privado (con lista de usuarios): solo miembros
                if (isMember) {
                    socket.join(Rooms.teamMembers(teamId));
                }

                console.log(
                    `[socket] ${eId} joined team:${teamId}` +
                    (isMember ? " + teamMembers" : " (public only)")
                );
            } catch (err) {
                console.error(`[socket] joinTeamRoom(${teamId}) failed for ${eId}:`, err);
            }
        });

        socket.on("leaveTeamRoom", (teamId: number) => {
            socket.leave(Rooms.team(teamId));
            socket.leave(Rooms.teamMembers(teamId));
            console.log(`[socket] ${eId} left team:${teamId}`);
        });

        // ── Disconnect ─────────────────────────────────────────────────────────

        socket.on("disconnect", async () => {
            console.log(`[socket] disconnected: ${eId} (${socket.id})`);
            await userStatusService.onDisconnect(eId);
        });
    });
};

