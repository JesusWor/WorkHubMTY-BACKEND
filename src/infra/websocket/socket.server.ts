import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { TypedServer, TypedSocket } from "./socket.types";

let io: TypedServer;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket: TypedSocket) => {
    console.log("User connected:", socket.id);

    socket.on("joinUserRoom", (userId: string) => {
      socket.join(userId);
      console.log(`User joined room ${userId}`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

export const getIO = (): TypedServer => {
  if (!io) {
    throw new Error("Socket server not initialized");
  }

  return io;
};