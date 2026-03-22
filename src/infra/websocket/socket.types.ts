import { Server, Socket } from "socket.io";
import { Notification } from "../../shared/types/notifications.types";

export interface ServerToClientEvents {
  notification: (data: Notification) => void;
}

export interface ClientToServerEvents {
  joinUserRoom: (userId: string) => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;