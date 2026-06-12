import { describe, it, expect } from 'vitest';
import {
    NotificationSchema,
    CreateNotificationInputSchema,
    MarkReadInputSchema,
    DeleteNotificationsInputSchema,
    UpdatePreferencesInputSchema,
    ListNotificationsQuerySchema,
    NotificationTypeEnum,
} from '../../../src/modules/notifications/notifications.schema';

describe('NotificationTypeEnum', () => {
    it('acepta todos los tipos válidos', () => {
        const types = [
            'ESTACIONAMIENTO_DISPONIBLE',
            'SALA_DISPONIBLE',
            'UN_AMIGO_RESERVO',
            'ESPACIO_BLOQUEADO',
            'ESPACIO_DESBLOQUEADO',
        ];
        types.forEach((t) => expect(NotificationTypeEnum.safeParse(t).success).toBe(true));
    });

    it('rechaza tipos inválidos', () => {
        expect(NotificationTypeEnum.safeParse('OTRO').success).toBe(false);
    });
});

describe('NotificationSchema', () => {
    it('acepta una notificación válida', () => {
        const result = NotificationSchema.safeParse({
            id: 1,
            user_id: 'USR00001',
            type: 'SALA_DISPONIBLE',
            title: 'Título',
            body: 'Cuerpo',
            is_read: false,
            created_at: new Date(),
            expires_at: new Date(),
        });
        expect(result.success).toBe(true);
    });

    it('rechaza id negativo', () => {
        const result = NotificationSchema.safeParse({
            id: -1,
            user_id: 'USR00001',
            type: 'SALA_DISPONIBLE',
            title: 'Título',
            body: 'Cuerpo',
            is_read: false,
            created_at: new Date(),
            expires_at: new Date(),
        });
        expect(result.success).toBe(false);
    });
});

describe('CreateNotificationInputSchema', () => {
    it('acepta input válido', () => {
        const result = CreateNotificationInputSchema.safeParse({
            user_id: 'USR00001',
            type: 'UN_AMIGO_RESERVO',
            title: 'Amigo reservó',
            body: 'Tu amigo reservó una sala',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza title vacío', () => {
        const result = CreateNotificationInputSchema.safeParse({
            user_id: 'USR00001',
            type: 'UN_AMIGO_RESERVO',
            title: '',
            body: 'Cuerpo',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza user_id mayor a 8 chars', () => {
        const result = CreateNotificationInputSchema.safeParse({
            user_id: 'USR000001234',
            type: 'UN_AMIGO_RESERVO',
            title: 'Título',
            body: 'Cuerpo',
        });
        expect(result.success).toBe(false);
    });
});

describe('MarkReadInputSchema', () => {
    it('acepta ids no vacíos', () => {
        expect(MarkReadInputSchema.safeParse({ ids: [1, 2, 3] }).success).toBe(true);
    });

    it('rechaza lista vacía', () => {
        expect(MarkReadInputSchema.safeParse({ ids: [] }).success).toBe(false);
    });

    it('rechaza ids no enteros positivos', () => {
        expect(MarkReadInputSchema.safeParse({ ids: [-1] }).success).toBe(false);
    });
});

describe('DeleteNotificationsInputSchema', () => {
    it('acepta ids válidos', () => {
        expect(DeleteNotificationsInputSchema.safeParse({ ids: [1] }).success).toBe(true);
    });

    it('rechaza lista vacía', () => {
        expect(DeleteNotificationsInputSchema.safeParse({ ids: [] }).success).toBe(false);
    });
});

describe('UpdatePreferencesInputSchema', () => {
    it('acepta preferences válidas', () => {
        const result = UpdatePreferencesInputSchema.safeParse({
            preferences: [{ type: 'SALA_DISPONIBLE', enabled: true }],
        });
        expect(result.success).toBe(true);
    });

    it('rechaza preferences vacías', () => {
        const result = UpdatePreferencesInputSchema.safeParse({ preferences: [] });
        expect(result.success).toBe(false);
    });
});

describe('ListNotificationsQuerySchema', () => {
    it('usa valores por defecto si no se pasan parámetros', () => {
        const result = ListNotificationsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data?.unread_only).toBe(false);
        expect(result.data?.limit).toBe(20);
        expect(result.data?.offset).toBe(0);
    });

    it('transforma unread_only="true" en true', () => {
        const result = ListNotificationsQuerySchema.safeParse({ unread_only: 'true' });
        expect(result.success).toBe(true);
        expect(result.data?.unread_only).toBe(true);
    });

    it('limita el máximo de limit a 100', () => {
        const result = ListNotificationsQuerySchema.safeParse({ limit: '200' });
        expect(result.success).toBe(true);
        expect(result.data?.limit).toBe(100);
    });
});
