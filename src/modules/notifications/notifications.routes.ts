import { Router } from "express";
import { NotificationController } from "./notifications.schema";


export function makeNotificationRouter(notificationController:NotificationController) : Router{
    const router = Router();

    router.post("/subscribe", notificationController.subscribe);
    router.post("/send", notificationController.send);
    router.get("/user/:userId", notificationController.getUserNotifications);
    router.patch("/read/:id", notificationController.markAsRead);
    router.delete("/:id", notificationController.deleteNotification);

    return router;
}