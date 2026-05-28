import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { TypedServer, TypedSocket } from "./socket.types.js";
import { verifyToken } from "../../shared/utils/jwt.util.js";
import { UnauthorizedError, InternalError } from "../../shared/errors/AppError.js";
import { UserStatusService } from "../../modules/user/user-status.service.js";

let io: TypedServer;

export const initSocket = (server: HttpServer, userStatusService: UserStatusService) => {
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
            const token = socket.handshake.auth?.token as string | undefined;

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
        const eId = socket.data.eId as string;
        console.log(`User connected: ${eId} (socket: ${socket.id})`);

        // Join personal room and mark as online
        socket.join(eId);
        await userStatusService.onConnect(eId);

        socket.on("ping", async () => {
            await userStatusService.onPing(eId);
        });

        // Keep joinUserRoom for backwards compatibility (room-based notifications)
        socket.on("joinUserRoom", (userId: string) => {
            socket.join(userId);
            console.log(`Socket ${socket.id} joined room ${userId}`);
        });

        // Parking room — el cliente se suscribe explícitamente para recibir parkingUpdate
        socket.on("joinParkingRoom", () => {
            socket.join("parking");
            console.log(`Socket ${socket.id} joined room parking`);
        });

        socket.on("leaveParkingRoom", () => {
            socket.leave("parking");
            console.log(`Socket ${socket.id} left room parking`);
        });

        socket.on("disconnect", async () => {
            console.log(`User disconnected: ${eId} (socket: ${socket.id})`);
            await userStatusService.onDisconnect(eId);
        });
    });
};

export const getIO = (): TypedServer => {
    if (!io) {
        throw new InternalError("Socket server not initialized");
    }
    return io;
};