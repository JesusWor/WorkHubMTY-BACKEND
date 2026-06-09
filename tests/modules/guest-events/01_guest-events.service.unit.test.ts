import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setRequiredTestEnv } from '../../utils/test-env.js';
import type { EventsRepo } from '../../../src/modules/guest-events/guest-events.repo.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../src/shared/errors/AppError.js';

setRequiredTestEnv();
const { makeEventsService } = await import('../../../src/modules/guest-events/guest-events.service.js');
const { EmailService } = await import('../../../src/infra/mail/email.service.js');

const start = '2026-06-08T15:00:00.000Z';
const end = '2026-06-08T16:00:00.000Z';

const event = {
    id: 1,
    start_time: new Date(start),
    end_time: new Date(end),
    title: 'Demo Day',
    description: 'Presentacion',
    details_text: null,
    lifecycle_status: 'ACTIVE',
    canceled_at: null,
    created_by: 'USR00001',
    created_at: new Date(),
    updated_at: new Date(),
    creator_name: 'Ana',
    creator_title: null,
    participants: [{ id: 1, name: 'Invitado', email: 'guest@example.com' }],
};

function makeRepo(overrides: Partial<EventsRepo> = {}): EventsRepo {
    return {
        listEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasNext: false }),
        getEventById: vi.fn().mockResolvedValue(event),
        createEvent: vi.fn().mockResolvedValue({ ...event, participants: undefined }),
        addParticipants: vi.fn().mockResolvedValue(undefined),
        removeParticipants: vi.fn().mockResolvedValue(undefined),
        patchEvent: vi.fn().mockResolvedValue({ ...event, participants: undefined }),
        cancelEvent: vi.fn().mockResolvedValue(true),
        getParticipantGuestIds: vi.fn().mockResolvedValue([1]),
        ...overrides,
    } as EventsRepo;
}

function makeUserRepo(overrides = {}) {
    return {
        getGuestsByIds: vi.fn().mockResolvedValue([{ id: 1, name: 'Invitado', email: 'guest@example.com', invited_by: 'USR00001' }]),
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.spyOn(EmailService, 'sendEmail').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('EventsService reads and create', () => {
    it('delega listEvents y requiere evento en getEventById', async () => {
        const repo = makeRepo();
        const service = makeEventsService(repo, makeUserRepo());

        await service.listEvents({ limit: 20 });
        expect(repo.listEvents).toHaveBeenCalledWith({ limit: 20 });
        await expect(service.getEventById(1)).resolves.toEqual(event);
    });

    it('createEvent valida invitados, crea participantes y devuelve detalle', async () => {
        const repo = makeRepo();
        const service = makeEventsService(repo, makeUserRepo());

        await expect(service.createEvent({
            title: 'Demo Day',
            description: '',
            start_time: start,
            end_time: end,
            guest_ids: [1],
        }, 'USR00001')).resolves.toEqual(event);

        expect(repo.createEvent).toHaveBeenCalledWith('Demo Day', '', null, new Date(start), new Date(end), 'USR00001');
        expect(repo.addParticipants).toHaveBeenCalledWith(1, [1]);
    });

    it('createEvent lanza BadRequestError si faltan invitados', async () => {
        const service = makeEventsService(makeRepo(), makeUserRepo({ getGuestsByIds: vi.fn().mockResolvedValue([]) }));

        await expect(service.createEvent({
            title: 'Demo Day',
            description: '',
            start_time: start,
            end_time: end,
            guest_ids: [99],
        }, 'USR00001')).rejects.toThrow(BadRequestError);
    });
});

describe('EventsService mutations', () => {
    it('resendToGuest envia correo si el invitado pertenece al evento', async () => {
        const service = makeEventsService(makeRepo(), makeUserRepo());

        await service.resendToGuest(1, 1);

        expect(EmailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'guest@example.com',
            subject: '[Reminder] You\'re invited: Demo Day',
        }));
    });

    it('resendToGuest bloquea eventos cancelados o invitados ajenos', async () => {
        await expect(makeEventsService(makeRepo({ getEventById: vi.fn().mockResolvedValue({ ...event, lifecycle_status: 'CANCELLED' }) }), makeUserRepo())
            .resendToGuest(1, 1)).rejects.toThrow(ConflictError);

        await expect(makeEventsService(makeRepo(), makeUserRepo())
            .resendToGuest(1, 99)).rejects.toThrow(NotFoundError);
    });

    it('patchEvent valida rango, invitados nuevos y aplica add/remove', async () => {
        const repo = makeRepo();
        const service = makeEventsService(repo, makeUserRepo({ getGuestsByIds: vi.fn().mockResolvedValue([{ id: 2, name: 'Nuevo', email: 'nuevo@example.com' }]) }));

        await service.patchEvent(1, {
            title: 'Nuevo',
            add_guest_ids: [2],
            remove_guest_ids: [1],
        }, 'USR00001');

        expect(repo.patchEvent).toHaveBeenCalledWith(1, { title: 'Nuevo' });
        expect(repo.removeParticipants).toHaveBeenCalledWith(1, [1]);
        expect(repo.addParticipants).toHaveBeenCalledWith(1, [2]);
    });

    it('cancelEvent valida existencia y estado', async () => {
        const repo = makeRepo();
        const service = makeEventsService(repo, makeUserRepo());

        await expect(service.cancelEvent(1)).resolves.toBeUndefined();
        expect(repo.cancelEvent).toHaveBeenCalledWith(1);

        await expect(makeEventsService(makeRepo({ getEventById: vi.fn().mockResolvedValue(null) }), makeUserRepo())
            .cancelEvent(99)).rejects.toThrow(NotFoundError);
        await expect(makeEventsService(makeRepo({ getEventById: vi.fn().mockResolvedValue({ ...event, lifecycle_status: 'CANCELLED' }) }), makeUserRepo())
            .cancelEvent(1)).rejects.toThrow(ConflictError);
    });
});
