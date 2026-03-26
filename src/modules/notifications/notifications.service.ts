import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../infra/websocket/socket.server";
import { NotificationService, Notification, UserRole } from "./notifications.schema";

export function makeNotificationService() : NotificationService{

  const notifications : Map<string, Notification> = new Map();

  const userRoles : Map<string, UserRole> = new Map();

  const subscribeUser = (userId: string, role: UserRole) => {
    userRoles.set(userId, role);
  }

  const createNotification = (
    title: string,
    message: string,
    targetUsers?: string[],
    targetRoles?: UserRole[]
  ) => {

    const notification: Notification = {
      id: uuidv4(),
      title,
      message,
      createdAt: new Date(),
      targetUsers,
      targetRoles,
      readBy: []
    };

    notifications.set(notification.id, notification);

    const io = getIO();

    if (targetUsers) {
      targetUsers.forEach((u) => {
        io.to(u).emit("notification", notification);
      });
    }

    if (targetRoles) {
      userRoles.forEach((role, userId) => {
        if (targetRoles.includes(role)) {
          io.to(userId).emit("notification", notification);
        }
      });
    }

    return notification;
  }

  const getUserNotifications = (userId: string) => {

    const role = userRoles.get(userId);

    const result: Notification[] = [];

    notifications.forEach((n) => {

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

  const markAsRead = (notificationId: string, userId: string) => {

    const notif = notifications.get(notificationId);

    if (!notif) return;

    notif.readBy.push(userId);
  }

  const deleteNotification = (notificationId: string) => {
    notifications.delete(notificationId);
  }

  return {
    subscribeUser,
    createNotification,
    getUserNotifications,
    markAsRead,
    deleteNotification
  }
}
