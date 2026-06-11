import { describe, it, expect } from 'vitest';
import {
    CreateEventSchema,
    EventDetailSchema,
    EventGuestSchema,
    EventSchema,
    EventsCursorSchema,
    EventsPageSchema,
    EventWithCreatorSchema,
    ListEventsQuerySchema,
    PatchEventSchema,
} from '../../../src/modules/guest-events/guest-events.schema.js';

const now = new Date('2026-06-08T15:00:00.000Z');
const event = {
    id: 1,
    start_time: now,
    end_time: new Date('2026-06-08T16:00:00.000Z'),
    title: 'Demo Day',
    description: 'Presentacion',
    details_text: null,
    lifecycle_status: 'ACTIVE',
    canceled_at: null,
    created_by: 'USR00001',
    created_at: now,
    updated_at: now,
};

describe('Guest events base schemas', () => {
    it('acepta evento, evento con creator y detalle', () => {
        expect(EventSchema.safeParse(event).success).toBe(true);
        expect(EventWithCreatorSchema.safeParse({ ...event, creator_name: 'Ana', creator_title: null }).success).toBe(true);
        expect(EventDetailSchema.safeParse({
            ...event,
            creator_name: 'Ana',
            creator_title: 'Manager',
            participants: [{ id: 1, name: 'Invitado', email: 'guest@example.com' }],
        }).success).toBe(true);
    });

    it('acepta guest participante de evento', () => {
        expect(EventGuestSchema.safeParse({
            id: 1,
            event_id: 1,
            guest_id: 2,
            create_time: now,
            guest_name: 'Invitado',
            guest_email: 'guest@example.com',
        }).success).toBe(true);
    });
});

describe('Guest events query and mutation schemas', () => {
    it('aplica defaults de list query y acepta cursor page', () => {
        const query = ListEventsQuerySchema.safeParse({});

        expect(query.success).toBe(true);
        expect(query.data?.limit).toBe(20);
        expect(EventsCursorSchema.safeParse({ last_id: 1, last_start_time: now.toISOString() }).success).toBe(true);
        expect(EventsPageSchema.safeParse({
            items: [{ ...event, creator_name: 'Ana', creator_title: null }],
            nextCursor: null,
            hasNext: false,
        }).success).toBe(true);
    });

    it('CreateEventSchema exige invitados y rango valido', () => {
        const valid = {
            title: 'Demo Day',
            start_time: '2026-06-08T15:00:00.000Z',
            end_time: '2026-06-08T16:00:00.000Z',
            guest_ids: [1],
        };

        expect(CreateEventSchema.safeParse(valid).success).toBe(true);
        expect(CreateEventSchema.safeParse({ ...valid, guest_ids: [] }).success).toBe(false);
        expect(CreateEventSchema.safeParse({ ...valid, end_time: valid.start_time }).success).toBe(false);
    });

    it('PatchEventSchema permite parciales y valida rango cuando ambos tiempos vienen', () => {
        expect(PatchEventSchema.safeParse({ title: 'Nuevo titulo' }).success).toBe(true);
        expect(PatchEventSchema.safeParse({
            start_time: '2026-06-08T16:00:00.000Z',
            end_time: '2026-06-08T15:00:00.000Z',
        }).success).toBe(false);
    });
});
