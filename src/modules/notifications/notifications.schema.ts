import { Request, Response } from "express";

export type UserRole =
  | "IT"
  | "FINANCE"
  | "ADMIN"
  | "USER";

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;

  targetUsers?: string[];
  targetRoles?: UserRole[];

  readBy: string[];
}

export interface NotificationService {
    subscribeUser : (userId: string, role: UserRole) => void; 
    createNotification: (title: string, message: string, targetUsers?: string[], targetRoles?: UserRole[]) => Notification;
    getUserNotifications: (userId:string) => Notification[];
    markAsRead: (notificationId: string, userId: string) => void;
    deleteNotification: (notificationId:string) => void;
}

export interface NotificationController {
    subscribe : (req: Request, res: Response) => void;
    send : (req: Request, res: Response) => void;
    getUserNotifications : (req: Request<{ userId: string }>, res: Response) => void;
    markAsRead : (req: Request<{ id: string }>, res: Response) => void;
    deleteNotification: (req: Request<{ id: string }>, res: Response) => void;
}