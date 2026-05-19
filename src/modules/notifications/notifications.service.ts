import { NotificationsRepo } from "./notifications.repo.js";
import {
    Notification,
    NotificationPreference,
    CreateNotificationInput,
    ListNotificationsQuery,
    MarkReadInput,
    DeleteNotificationsInput,
    UpdatePreferencesInput,
} from "./notifications.schema.js";

export type NotificationsService = {
    getByUser: (userId: string, query: ListNotificationsQuery) => Promise<Notification[]>;
    getUnreadCount: (userId: string) => Promise<{ count: number }>;
    markAsRead: (userId: string, input: MarkReadInput) => Promise<void>;
    markAllAsRead: (userId: string) => Promise<void>;
    deleteNotifications: (userId: string, input: DeleteNotificationsInput) => Promise<void>;
    deleteAllNotifications: (userId: string) => Promise<void>;
    getPreferences: (userId: string) => Promise<NotificationPreference[]>;
    updatePreferences: (userId: string, input: UpdatePreferencesInput) => Promise<void>;
    notifyParkingAvailable: (lotName: string, availableSpots: number) => Promise<void>;
    notifyRoomAvailable: (spaceName: string, floor: string, availableSpots: number) => Promise<void>;
    notifyFriendReservation: (
        recipientUserId: string,
        friendName: string,
        spaceName: string,
        startTime: string
    ) => Promise<void>;
    notifySpaceBlocked: (spaceName: string, spaceType: "parking" | "room", reason?: string) => Promise<void>;
    notifySpaceUnblocked: (spaceName: string, spaceType: "parking" | "room") => Promise<void>;
};

export function makeNotificationsService(repo: NotificationsRepo): NotificationsService {
    const broadcast = async (
        input: Omit<CreateNotificationInput, "user_id">,
        subscribedUserIds: string[]
    ): Promise<void> => {
        if (subscribedUserIds.length === 0) return;
        const bulk: CreateNotificationInput[] = subscribedUserIds.map((uid) => ({
            ...input,
            user_id: uid,
        }));
        await repo.createBulk(bulk);
    };

    const getByUser = async (
        userId: string,
        query: ListNotificationsQuery
    ): Promise<Notification[]> => {
        return await repo.getByUser(userId, query);
    };

    const getUnreadCount = async (userId: string): Promise<{ count: number }> => {
        const count = await repo.getUnreadCount(userId);
        return { count };
    };

    const markAsRead = async (userId: string, input: MarkReadInput): Promise<void> => {
        await repo.markAsRead(userId, input.ids);
    };

    const markAllAsRead = async (userId: string): Promise<void> => {
        await repo.markAllAsRead(userId);
    };

    const deleteNotifications = async (
        userId: string,
        input: DeleteNotificationsInput
    ): Promise<void> => {
        await repo.deleteByUser(userId, input.ids);
    };

    const deleteAllNotifications = async (userId: string): Promise<void> => {
        await repo.deleteAllByUser(userId);
    };

    const getPreferences = async (userId: string): Promise<NotificationPreference[]> => {
        return await repo.getPreferences(userId);
    };

    const updatePreferences = async (
        userId: string,
        input: UpdatePreferencesInput
    ): Promise<void> => {
        await repo.upsertPreferences(userId, input.preferences);
    };

    const notifyParkingAvailable = async (
        lotName: string,
        availableSpots: number
    ): Promise<void> => {
        const userIds = await repo.getUsersSubscribedTo("ESTACIONAMIENTO_DISPONIBLE");
        await broadcast(
            {
                type: "ESTACIONAMIENTO_DISPONIBLE",
                title: "Estacionamiento disponible",
                body: `${availableSpots} lugar${availableSpots !== 1 ? "es" : ""} disponible${availableSpots !== 1 ? "s" : ""} en ${lotName}.`,
                metadata: { lot_name: lotName, available_spots: availableSpots },
            },
            userIds
        );
    };

    const notifyRoomAvailable = async (
        spaceName: string,
        floor: string,
        availableSpots: number
    ): Promise<void> => {
        const userIds = await repo.getUsersSubscribedTo("SALA_DISPONIBLE");
        await broadcast(
            {
                type: "SALA_DISPONIBLE",
                title: "Espacio en oficna disponible",
                body: `${availableSpots} lugar${availableSpots !== 1 ? "es" : ""} disponible${availableSpots !== 1 ? "s" : ""} en ${spaceName} (${floor}).`,
                metadata: { space_name: spaceName, floor, available_spots: availableSpots },
            },
            userIds
        );
    };

    const notifyFriendReservation = async (
        recipientUserId: string,
        friendName: string,
        spaceName: string,
        startTime: string
    ): Promise<void> => {
        const subscribed = await repo.getUsersSubscribedTo("UN_AMIGO_RESERVO");
        if (!subscribed.includes(recipientUserId)) return;
        await repo.create({
            user_id: recipientUserId,
            type: "UN_AMIGO_RESERVO",
            title: "👥 Tu amigo hizo una reservación",
            body: `${friendName} reservó ${spaceName} para el ${startTime}.`,
            metadata: { friend_name: friendName, space_name: spaceName, start_time: startTime },
        });
    };

    const notifySpaceBlocked = async (
        spaceName: string,
        spaceType: "parking" | "room",
        reason?: string
    ): Promise<void> => {
        const userIds = await repo.getUsersSubscribedTo("ESPACIO_BLOQUEADO");
        const label = spaceType === "parking" ? "🅿️ Estacionamiento" : "🏢 Espacio";
        await broadcast(
            {
                type: "ESPACIO_BLOQUEADO",
                title: `${label} bloqueado`,
                body: reason
                    ? `${spaceName} ha sido bloqueado: ${reason}.`
                    : `${spaceName} ha sido bloqueado temporalmente.`,
                metadata: { space_name: spaceName, space_type: spaceType, reason: reason ?? null },
            },
            userIds
        );
    };

    const notifySpaceUnblocked = async (
        spaceName: string,
        spaceType: "parking" | "room"
    ): Promise<void> => {
        const userIds = await repo.getUsersSubscribedTo("ESPACIO_DESBLOQUEADO");
        const label = spaceType === "parking" ? "Estacionamiento" : "Espacio";
        await broadcast(
            {
                type: "ESPACIO_DESBLOQUEADO",
                title: `${label} desbloqueado`,
                body: `${spaceName} ya está disponible nuevamente.`,
                metadata: { space_name: spaceName, space_type: spaceType },
            },
            userIds
        );
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
        notifyParkingAvailable,
        notifyRoomAvailable,
        notifyFriendReservation,
        notifySpaceBlocked,
        notifySpaceUnblocked,
    };
}