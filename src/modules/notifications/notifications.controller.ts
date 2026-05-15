import { Request, Response } from "express";
import { NotificationsService } from "./notifications.service.js";
import {
    ListNotificationsQuerySchema,
    MarkReadInputSchema,
    DeleteNotificationsInputSchema,
    UpdatePreferencesInputSchema,
} from "./notifications.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";

export type NotificationsController = {
    getByUser: (req: Request, res: Response) => Promise<void>;
    getUnreadCount: (req: Request, res: Response) => Promise<void>;
    markAsRead: (req: Request, res: Response) => Promise<void>;
    markAllAsRead: (req: Request, res: Response) => Promise<void>;
    deleteNotifications: (req: Request, res: Response) => Promise<void>;
    deleteAllNotifications: (req: Request, res: Response) => Promise<void>;
    getPreferences: (req: Request, res: Response) => Promise<void>;
    updatePreferences: (req: Request, res: Response) => Promise<void>;
};

export function makeNotificationsController(service: NotificationsService): NotificationsController {
    const getUserId = (req: Request): string | null =>
        (req as any).user?.e_id ?? null;

    const getByUser = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        const parsed = ListNotificationsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }

        const notifications = await service.getByUser(userId, parsed.data);
        GlobalResponse.okWithData(res, notifications);
    };

    const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        const result = await service.getUnreadCount(userId);
        GlobalResponse.okWithData(res, result);
    };

    const markAsRead = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        const parsed = MarkReadInputSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }

        await service.markAsRead(userId, parsed.data);
        GlobalResponse.ok(res, "Notifications marked as read");
    };

    const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        await service.markAllAsRead(userId);
        GlobalResponse.ok(res, "All notifications marked as read");
    };

    const deleteNotifications = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        const parsed = DeleteNotificationsInputSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }

        await service.deleteNotifications(userId, parsed.data);
        GlobalResponse.ok(res, "Notifications deleted");
    };

    const deleteAllNotifications = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        await service.deleteAllNotifications(userId);
        GlobalResponse.ok(res, "All notifications deleted");
    };

    const getPreferences = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        const prefs = await service.getPreferences(userId);
        GlobalResponse.okWithData(res, prefs);
    };

    const updatePreferences = async (req: Request, res: Response): Promise<void> => {
        const userId = getUserId(req);
        if (!userId) { GlobalResponse.badRequest(res, "User not authenticated"); return; }

        const parsed = UpdatePreferencesInputSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }

        await service.updatePreferences(userId, parsed.data);
        GlobalResponse.ok(res, "Preferences updated");
    };

    return {
        getByUser,
        getUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotifications,
        deleteAllNotifications,
        getPreferences,
        updatePreferences,
    };
}