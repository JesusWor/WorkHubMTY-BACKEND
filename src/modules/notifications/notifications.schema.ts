import { z } from "zod";

export const NotificationTypeEnum = z.enum([
    "ESTACIONAMIENTO_DISPONIBLE",
    "SALA_DISPONIBLE",
    "UN_AMIGO_RESERVO",
    "ESPACIO_BLOQUEADO",
    "ESPACIO_DESBLOQUEADO",
]);

export const NotificationSchema = z.object({
    id: z.number().int().positive(),
    user_id: z.string().max(8),
    type: NotificationTypeEnum,
    title: z.string().max(64),
    body: z.string().max(255),
    metadata: z.record(z.string() ,z.unknown()).nullable().optional(),
    is_read: z.boolean(),
    created_at: z.string().datetime().or(z.date()),
    expires_at: z.string().datetime().or(z.date()),
});

export const NotificationPreferenceSchema = z.object({
    user_id: z.string().max(8),
    type: NotificationTypeEnum,
    enabled: z.boolean(),
});

export const CreateNotificationInputSchema = z.object({
    user_id: z.string().max(8),
    type: NotificationTypeEnum,
    title: z.string().min(1).max(64),
    body: z.string().min(1).max(255),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const MarkReadInputSchema = z.object({
    ids: z
        .array(z.number().int().positive())
        .min(1, "Debes proporcionar al menos un id"),
});

export const DeleteNotificationsInputSchema = z.object({
    ids: z
        .array(z.number().int().positive())
        .min(1, "Debes proporcionar al menos un id"),
});

export const UpdatePreferencesInputSchema = z.object({
    preferences: z
        .array(
            z.object({
                type: NotificationTypeEnum,
                enabled: z.boolean(),
            })
        )
        .min(1, "Debes proporcionar al menos una preferencia"),
});

export const ListNotificationsQuerySchema = z.object({
    unread_only: z
        .string()
        .optional()
        .transform((v) => v === "true"),
    limit: z
        .string()
        .optional()
        .transform((v) => (v ? Math.min(Number(v), 100) : 20))
        .refine((v) => !isNaN(v) && v > 0, { message: "limit debe ser un número positivo" }),
    offset: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 0))
        .refine((v) => !isNaN(v) && v >= 0, { message: "offset debe ser un número no negativo" }),
});

export type NotificationType = z.infer<typeof NotificationTypeEnum>;
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;
export type MarkReadInput = z.infer<typeof MarkReadInputSchema>;
export type DeleteNotificationsInput = z.infer<typeof DeleteNotificationsInputSchema>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesInputSchema>;
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;