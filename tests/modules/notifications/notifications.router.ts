import { Router } from "express";
import { NotificationsController } from "./notifications.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeNotificationsRouter(controller: NotificationsController): Router {
    const router = Router();

    router.get("/notifications/me", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getByUser));
    router.get("/notifications/me/unread-count", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getUnreadCount));
    router.patch("/notifications/me/read", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.markAsRead));
    router.patch("/notifications/me/read-all", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.markAllAsRead));
    router.delete( "/notifications/me", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.deleteNotifications));
    router.delete("/notifications/me/all", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.deleteAllNotifications));
    router.get("/notifications/me/preferences", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getPreferences));
    router.put("/notifications/me/preferences", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.updatePreferences));

    return router;
}