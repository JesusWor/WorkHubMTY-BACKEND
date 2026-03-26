import { Request, Response } from "express";
import { NotificationService } from "./notifications.schema";

export function makeNotificationController(notificationService : NotificationService) {
  const subscribe = (req: Request, res: Response) => {
    const { userId, role } = req.body;
    notificationService.subscribeUser(userId, role);
    res.json({ message: "User subscribed to notifications" });
  }

  const send = (req: Request, res: Response) => {
    const { title, message, users, roles } = req.body;
    const notif = notificationService.createNotification(
      title,
      message,
      users,
      roles
    );
    res.json(notif);
  }

  const getUserNotifications = (req: Request<{ userId: string }>, res: Response) => {
    const { userId } = req.params;
    const data = notificationService.getUserNotifications(userId);
    res.json(data);
  }

  const markAsRead = (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const { userId } = req.body;
    notificationService.markAsRead(id, userId);
    res.json({ message: "Notification read" });
  }

  const deleteNotification = (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    notificationService.deleteNotification(id);
    res.json({ message: "Deleted" });
  }

  return {
    subscribe,
    send,
    getUserNotifications,
    markAsRead,
    deleteNotification
  }
}