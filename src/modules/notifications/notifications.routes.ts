import { Router } from "express";
import { NotificationController } from "./notifications.schema";
import { asyncHandler } from "../../middleware";

export function makeNotificationRouter(notificationController: NotificationController): Router {
    const router = Router();

    router.post("/subscribe", asyncHandler(notificationController.subscribe));
    router.post("/send", asyncHandler(notificationController.send));
    router.get("/user/:userId", asyncHandler(notificationController.getUserNotifications));
    router.patch("/read/:id", asyncHandler(notificationController.markAsRead));
    router.delete("/:id", asyncHandler(notificationController.deleteNotification));

    return router;
}
