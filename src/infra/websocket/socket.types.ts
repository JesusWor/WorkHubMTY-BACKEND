import { Server, Socket } from "socket.io";

export interface ServerToClientEvents {
  notification: (data: {
    message: string;
    date: Date;
  }) => void;
}

export interface ClientToServerEvents {
  joinUserRoom: (userId: string) => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;