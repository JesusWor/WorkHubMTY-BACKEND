import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../infra/websocket/socket.server";
import { Notification, UserRole } from "../../shared/types/notifications.types";

class NotificationService {

  private notifications: Map<string, Notification> = new Map();

  private userRoles: Map<string, UserRole> = new Map();

  subscribeUser(userId: string, role: UserRole) {
    this.userRoles.set(userId, role);
  }

  createNotification(
    title: string,
    message: string,
    targetUsers?: string[],
    targetRoles?: UserRole[]
  ) {

    const notification: Notification = {
      id: uuidv4(),
      title,
      message,
      createdAt: new Date(),
      targetUsers,
      targetRoles,
      readBy: []
    };

    this.notifications.set(notification.id, notification);

    const io = getIO();

    if (targetUsers) {
      targetUsers.forEach((u) => {
        io.to(u).emit("notification", notification);
      });
    }

    if (targetRoles) {
      this.userRoles.forEach((role, userId) => {
        if (targetRoles.includes(role)) {
          io.to(userId).emit("notification", notification);
        }
      });
    }

    return notification;
  }

  getUserNotifications(userId: string) {

    const role = this.userRoles.get(userId);

    const result: Notification[] = [];

    this.notifications.forEach((n) => {

      if (
        n.targetUsers?.includes(userId) ||
        n.targetRoles?.includes(role!)
      ) {

        if (!n.readBy.includes(userId)) {
          result.push(n);
        }

      }

    });

    return result;
  }

  markAsRead(notificationId: string, userId: string) {

    const notif = this.notifications.get(notificationId);

    if (!notif) return;

    notif.readBy.push(userId);
  }

  deleteNotification(notificationId: string) {
    this.notifications.delete(notificationId);
  }

}

export const notificationService = new NotificationService();