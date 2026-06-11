import { Db } from "../../infra/db/db.js";
import { Notification, NotificationPreference, NotificationType, CreateNotificationInput, ListNotificationsQuery } from "./notifications.schema.js";

export type NotificationsRepo = {
    create: (input: CreateNotificationInput) => Promise<{ id: number }>;
    createBulk: (inputs: CreateNotificationInput[]) => Promise<void>;
    getByUser: (userId: string, query: ListNotificationsQuery) => Promise<Notification[]>;
    getUnreadCount: (userId: string) => Promise<number>;
    markAsRead: (userId: string, ids: number[]) => Promise<void>;
    markAllAsRead: (userId: string) => Promise<void>;
    deleteByUser: (userId: string, ids: number[]) => Promise<void>;
    deleteAllByUser: (userId: string) => Promise<void>;
    purgeExpired: () => Promise<void>;
    getPreferences: (userId: string) => Promise<NotificationPreference[]>;
    upsertPreferences: (userId: string, prefs: { type: NotificationType; enabled: boolean }[]) => Promise<void>;
    getUsersSubscribedTo: (type: NotificationType) => Promise<string[]>;
}

export function makeNotificationsRepo(db: Db): NotificationsRepo {
    const create = async (input: CreateNotificationInput): Promise<{ id: number }> => {
        const { rows } = await db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata)
             VALUES (?, ?, ?, ?, ?)`,
            [
                input.user_id,
                input.type,
                input.title,
                input.body,
                input.metadata ? JSON.stringify(input.metadata) : null,
            ]
        );
        return { id: (rows as any).insertId };
    };

    const createBulk = async (inputs: CreateNotificationInput[]): Promise<void> => {
        if (inputs.length === 0) return;
        const placeholders = inputs.map(() => "(?, ?, ?, ?, ?)").join(", ");
        const values = inputs.flatMap((n) => [
            n.user_id,
            n.type,
            n.title,
            n.body,
            n.metadata ? JSON.stringify(n.metadata) : null,
        ]);
        await db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES ${placeholders}`,
            values
        );
    };

    const getByUser = async (
        userId: string,
        query: ListNotificationsQuery
    ): Promise<Notification[]> => {
        const conditions = ["user_id = ?", "expires_at > NOW()"];
        const params: unknown[] = [userId];
 
        if (query.unread_only) {
            conditions.push("is_read = 0");
        }
 
        const { rows } = await db.query(
            `SELECT id, user_id, type, title, body, metadata, is_read, created_at, expires_at
             FROM notifications
             WHERE ${conditions.join(" AND ")}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, query.limit, query.offset]
        );
 
        return (rows as any[]).map((row) => ({
            ...row,
            is_read: Boolean(row.is_read),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
        }));
    };

    const getUnreadCount = async (userId: string): Promise<number> => {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count
             FROM notifications
             WHERE user_id = ? AND is_read = 0 AND expires_at > NOW()`,
            [userId]
        );
        return Number((rows as any[])[0].count);
    };
 
    const markAsRead = async (userId: string, ids: number[]): Promise<void> => {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => "?").join(", ");
        await db.query(
            `UPDATE notifications SET is_read = 1
             WHERE user_id = ? AND id IN (${placeholders})`,
            [userId, ...ids]
        );
    };
 
    const markAllAsRead = async (userId: string): Promise<void> => {
        await db.query(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
            [userId]
        );
    };

    const deleteByUser = async (userId: string, ids: number[]): Promise<void> => {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => "?").join(", ");
        await db.query(
            `DELETE FROM notifications
             WHERE user_id = ? AND id IN (${placeholders})`,
            [userId, ...ids]
        );
    };
 
    const deleteAllByUser = async (userId: string): Promise<void> => {
        await db.query(
            `DELETE FROM notifications WHERE user_id = ?`,
            [userId]
        );
    };

    const purgeExpired = async (): Promise<void> => {
        await db.query(`DELETE FROM notifications WHERE expires_at < NOW()`);
    };

    const getPreferences = async (userId: string): Promise<NotificationPreference[]> => {
        const { rows } = await db.query(
            `SELECT user_id, type, enabled FROM notification_preferences WHERE user_id = ?`,
            [userId]
        );
        return (rows as any[]).map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
    };
 
    const upsertPreferences = async (
        userId: string,
        prefs: { type: NotificationType; enabled: boolean }[]
    ): Promise<void> => {
        if (prefs.length === 0) return;
        const placeholders = prefs.map(() => "(?, ?, ?)").join(", ");
        const values = prefs.flatMap((p) => [userId, p.type, p.enabled ? 1 : 0]);
        await db.query(
            `INSERT INTO notification_preferences (user_id, type, enabled)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
            values
        );
    };

    const getUsersSubscribedTo = async (type: NotificationType): Promise<string[]> => {
        const { rows } = await db.query(
            `SELECT u.e_id
             FROM users u
             LEFT JOIN notification_preferences np
                ON np.user_id = u.e_id AND np.type = ?
             WHERE np.enabled IS NULL OR np.enabled = 1`,
            [type]
        );
        return (rows as any[]).map((r) => r.e_id);
    };
 
    return {
        create,
        createBulk,
        getByUser,
        getUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteByUser,
        deleteAllByUser,
        purgeExpired,
        getPreferences,
        upsertPreferences,
        getUsersSubscribedTo,
    };
}