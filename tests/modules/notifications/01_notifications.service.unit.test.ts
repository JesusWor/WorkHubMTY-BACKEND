import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeNotificationsService } from '../../../src/modules/notifications/notifications.service';
import type { NotificationsRepo } from '../../../src/modules/notifications/notifications.repo';

function makeRepo(overrides: Partial<NotificationsRepo> = {}): NotificationsRepo {
    return {
        getByUser: vi.fn().mockResolvedValue([]),
        getUnreadCount: vi.fn().mockResolvedValue(0),
        markAsRead: vi.fn().mockResolvedValue(undefined),
        markAllAsRead: vi.fn().mockResolvedValue(undefined),
        deleteByUser: vi.fn().mockResolvedValue(undefined),
        deleteAllByUser: vi.fn().mockResolvedValue(undefined),
        getPreferences: vi.fn().mockResolvedValue([]),
        upsertPreferences: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
        createBulk: vi.fn().mockResolvedValue(undefined),
        getUsersSubscribedTo: vi.fn().mockResolvedValue([]),
        ...overrides,
    } as unknown as NotificationsRepo;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('NotificationsService.getUnreadCount', () => {
    it('retorna el count envuelto en objeto', async () => {
        const repo = makeRepo({ getUnreadCount: vi.fn().mockResolvedValue(5) });
        const service = makeNotificationsService(repo);
        const result = await service.getUnreadCount('USR00001');
        expect(result).toEqual({ count: 5 });
    });
});

describe('NotificationsService.markAsRead', () => {
    it('llama al repo con userId e ids', async () => {
        const repo = makeRepo();
        const service = makeNotificationsService(repo);
        await service.markAsRead('USR00001', { ids: [1, 2] });
        expect(repo.markAsRead).toHaveBeenCalledWith('USR00001', [1, 2]);
    });
});

describe('NotificationsService.deleteNotifications', () => {
    it('llama al repo con userId e ids', async () => {
        const repo = makeRepo();
        const service = makeNotificationsService(repo);
        await service.deleteNotifications('USR00001', { ids: [3] });
        expect(repo.deleteByUser).toHaveBeenCalledWith('USR00001', [3]);
    });
});

describe('NotificationsService.updatePreferences', () => {
    it('llama a upsertPreferences con las preferencias correctas', async () => {
        const repo = makeRepo();
        const service = makeNotificationsService(repo);
        const prefs = [{ type: 'SALA_DISPONIBLE' as const, enabled: false }];
        await service.updatePreferences('USR00001', { preferences: prefs });
        expect(repo.upsertPreferences).toHaveBeenCalledWith('USR00001', prefs);
    });
});

describe('NotificationsService.notifyParkingAvailable', () => {
    it('no llama a createBulk si no hay usuarios suscritos', async () => {
        const repo = makeRepo({ getUsersSubscribedTo: vi.fn().mockResolvedValue([]) });
        const service = makeNotificationsService(repo);
        await service.notifyParkingAvailable('Lot A', 3);
        expect(repo.createBulk).not.toHaveBeenCalled();
    });

    it('llama a createBulk con las notificaciones para los usuarios suscritos', async () => {
        const repo = makeRepo({
            getUsersSubscribedTo: vi.fn().mockResolvedValue(['USR00001', 'USR00002']),
        });
        const service = makeNotificationsService(repo);
        await service.notifyParkingAvailable('Lot A', 2);
        expect(repo.createBulk).toHaveBeenCalledOnce();
        const [bulk] = (repo.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(bulk).toHaveLength(2);
        expect(bulk[0].type).toBe('ESTACIONAMIENTO_DISPONIBLE');
    });
});

describe('NotificationsService.notifyFriendReservation', () => {
    it('no crea notificación si el usuario no está suscrito', async () => {
        const repo = makeRepo({
            getUsersSubscribedTo: vi.fn().mockResolvedValue(['USR00099']),
        });
        const service = makeNotificationsService(repo);
        await service.notifyFriendReservation('USR00001', 'Amigo', 'Sala 1', '2024-01-01 10:00');
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('crea notificación si el usuario está suscrito', async () => {
        const repo = makeRepo({
            getUsersSubscribedTo: vi.fn().mockResolvedValue(['USR00001']),
        });
        const service = makeNotificationsService(repo);
        await service.notifyFriendReservation('USR00001', 'Amigo', 'Sala 1', '2024-01-01 10:00');
        expect(repo.create).toHaveBeenCalledOnce();
        const [input] = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(input.type).toBe('UN_AMIGO_RESERVO');
        expect(input.user_id).toBe('USR00001');
    });
});

describe('NotificationsService.notifySpaceBlocked', () => {
    it('envía notificación con razón cuando se provee', async () => {
        const repo = makeRepo({
            getUsersSubscribedTo: vi.fn().mockResolvedValue(['USR00001']),
        });
        const service = makeNotificationsService(repo);
        await service.notifySpaceBlocked('Sala 3', 'room', 'mantenimiento');
        const [bulk] = (repo.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(bulk[0].body).toContain('mantenimiento');
    });

    it('envía mensaje genérico sin razón', async () => {
        const repo = makeRepo({
            getUsersSubscribedTo: vi.fn().mockResolvedValue(['USR00001']),
        });
        const service = makeNotificationsService(repo);
        await service.notifySpaceBlocked('Estacionamiento 1', 'parking');
        const [bulk] = (repo.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(bulk[0].body).toContain('temporalmente');
    });
});
