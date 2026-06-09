import { EventsRepo } from './guest-events.repo.js';
import { CreateEvent, EventDetail, EventsPage, EventWithCreator, ListEventsQuery, PatchEvent } from './guest-events.schema.js';
import { EmailService } from '../../infra/mail/email.service.js';
import { buildEventInvitationEmail } from './guest-events.email.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/AppError.js';
import { UserRepo } from '../user/user.repo.js';

export type EventsService = {
    listEvents: (query: ListEventsQuery) => Promise<EventsPage>;
    getEventById: (id: number) => Promise<EventDetail>;
    createEvent: (data: CreateEvent, createdByEId: string) => Promise<EventDetail>;
    resendToGuest: (eventId: number, guestId: number) => Promise<void>;
    patchEvent: (id: number, data: PatchEvent, actorEId: string) => Promise<EventDetail>;
    cancelEvent: (id: number) => Promise<void>;
};

export function makeEventsService(repo: EventsRepo, userRepo: UserRepo): EventsService {

    async function requireEvent(id: number): Promise<EventDetail> {
        const event = await repo.getEventById(id);
        if (!event) throw new NotFoundError('Evento no encontrado');
        return event;
    }

    async function sendInvitationToGuests(
        event: EventDetail,
        guestIds: number[],
    ): Promise<void> {
        if (!guestIds.length) return;

        const guests = event.participants.filter(p => guestIds.includes(p.id));
        if (!guests.length) return;

        await Promise.allSettled(
            guests.map(guest =>
                EmailService.sendEmail({
                    to: guest.email,
                    subject: `You're invited: ${event.title}`,
                    html: buildEventInvitationEmail({
                        guestName: guest.name,
                        eventTitle: event.title,
                        startTime: event.start_time instanceof Date ? event.start_time : new Date(event.start_time),
                        endTime: event.end_time instanceof Date ? event.end_time : new Date(event.end_time),
                        creatorName: event.creator_name,
                        creatorTitle: event.creator_title,
                        detailsText: event.details_text,
                    }),
                }),
            ),
        );
    }

    const listEvents = (query: ListEventsQuery): Promise<EventsPage> =>
        repo.listEvents(query);

    const getEventById = async (id: number): Promise<EventDetail> =>
        requireEvent(id);

    const createEvent = async (data: CreateEvent, createdByEId: string): Promise<EventDetail> => {
        const guests = await userRepo.getGuestsByIds(data.guest_ids);
        if (guests.length !== data.guest_ids.length) {
            const found = new Set(guests.map(g => g.id));
            const missing = data.guest_ids.filter(id => !found.has(id));
            throw new BadRequestError(`Guest IDs not found: ${missing.join(', ')}`);
        }

        const event = await repo.createEvent(
            data.title,
            data.description ?? '',
            data.details_text ?? null,
            new Date(data.start_time),
            new Date(data.end_time),
            createdByEId,
        );

        await repo.addParticipants(event.id, data.guest_ids);

        const detail = await requireEvent(event.id);

        sendInvitationToGuests(detail, data.guest_ids).catch(err =>
            console.error('[events] Failed to send invitation emails:', err),
        );

        return detail;
    };

    const resendToGuest = async (eventId: number, guestId: number): Promise<void> => {
        const event = await requireEvent(eventId);
        if (event.lifecycle_status === 'CANCELLED') {
            throw new ConflictError('No se pueden reenviar correos a un evento cancelado');
        }

        const guest = event.participants.find(p => p.id === guestId);
        if (!guest) {
            throw new NotFoundError('El invitado no pertenece a este evento');
        }

        await EmailService.sendEmail({
            to: guest.email,
            subject: `[Reminder] You're invited: ${event.title}`,
            html: buildEventInvitationEmail({
                guestName: guest.name,
                eventTitle: event.title,
                startTime: event.start_time instanceof Date ? event.start_time : new Date(event.start_time),
                endTime: event.end_time instanceof Date ? event.end_time : new Date(event.end_time),
                creatorName: event.creator_name,
                creatorTitle: event.creator_title,
                detailsText: event.details_text,
            }),
        });
    };

    const patchEvent = async (id: number, data: PatchEvent, _actorEId: string): Promise<EventDetail> => {
        const existing = await requireEvent(id);
        if (existing.lifecycle_status === 'CANCELLED') {
            throw new ConflictError('No se puede modificar un evento cancelado');
        }

        const newStart = data.start_time ? new Date(data.start_time) : existing.start_time;
        const newEnd = data.end_time ? new Date(data.end_time) : existing.end_time;
        if (newStart >= newEnd) {
            throw new BadRequestError('start_time must be before end_time');
        }

        if (data.add_guest_ids?.length) {
            const guests = await userRepo.getGuestsByIds(data.add_guest_ids);
            if (guests.length !== data.add_guest_ids.length) {
                const found = new Set(guests.map(g => g.id));
                const missing = data.add_guest_ids.filter(gid => !found.has(gid));
                throw new BadRequestError(`Guest IDs not found: ${missing.join(', ')}`);
            }
        }

        const { add_guest_ids, remove_guest_ids, ...scalarData } = data;

        await repo.patchEvent(id, scalarData);

        if (remove_guest_ids?.length) {
            await repo.removeParticipants(id, remove_guest_ids);
        }
        if (add_guest_ids?.length) {
            await repo.addParticipants(id, add_guest_ids);
        }

        const updated = await requireEvent(id);

        if (add_guest_ids?.length) {
            sendInvitationToGuests(updated, add_guest_ids).catch(err =>
                console.error('[events] Failed to send invitation emails on patch:', err),
            );
        }

        return updated;
    };

    const cancelEvent = async (id: number): Promise<void> => {
        const existing = await requireEvent(id);
        if (existing.lifecycle_status === 'CANCELLED') {
            throw new ConflictError('El evento ya está cancelado');
        }
        const cancelled = await repo.cancelEvent(id);
        if (!cancelled) throw new NotFoundError('Evento no encontrado');
    };

    return {
        listEvents,
        getEventById,
        createEvent,
        resendToGuest,
        patchEvent,
        cancelEvent,
    };
}
