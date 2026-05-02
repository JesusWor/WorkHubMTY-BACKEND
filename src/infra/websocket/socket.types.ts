import { Server, Socket } from "socket.io";
import { Notification } from "../../modules/notifications/notifications.schema.js";

export interface ServerToClientEvents {
  notification: (data: Notification) => void;
}

export interface ClientToServerEvents {
  joinUserRoom: (userId: string) => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;