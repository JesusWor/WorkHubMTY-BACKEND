import { getIO } from "../../infra/websocket/socket.server";

export interface NotificationPayload {
  userId: string;
  message: string;
}

export class NotificationService {

  static sendToUser(data: NotificationPayload) {
    const io = getIO();

    io.to(data.userId).emit("notification", {
      message: data.message,
      date: new Date()
    });
  }

  static broadcast(message: string) {
    const io = getIO();

    io.emit("notification", {
      message,
      date: new Date()
    });
  }
}