import { z } from 'zod';

export const EventSchema = z.object({
    id: z.number(),
    start_time: z.date(),
    end_time: z.date(),
    title: z.string(),
    description: z.string(),
    details_text: z.string().nullable(),
    lifecycle_status: z.enum(['ACTIVE', 'CANCELLED']),
    canceled_at: z.date().nullable(),
    created_by: z.string(), // user e_id
    created_at: z.date(),
    updated_at: z.date(),
});
export type Event = z.infer<typeof EventSchema>;

export const EventWithCreatorSchema = EventSchema.extend({
    creator_name: z.string(),
    creator_title: z.string().nullable(),
});
export type EventWithCreator = z.infer<typeof EventWithCreatorSchema>;

export const EventGuestSchema = z.object({
    id: z.number(),
    event_id: z.number(),
    guest_id: z.number(),
    create_time: z.date(),
    guest_name: z.string(),
    guest_email: z.string(),
});
export type EventGuest = z.infer<typeof EventGuestSchema>;

export const EventDetailSchema = EventWithCreatorSchema.extend({
    participants: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            email: z.string(),
        }),
    ),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

export const EventsCursorSchema = z.object({
    last_id: z.number(),
    last_start_time: z.string(), // ISO string
});
export type EventsCursor = z.infer<typeof EventsCursorSchema>;

export const EventsPageSchema = z.object({
    items: z.array(EventWithCreatorSchema),
    nextCursor: z.string().nullable(),
    hasNext: z.boolean(),
});
export type EventsPage = z.infer<typeof EventsPageSchema>;

export const ListEventsQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).default(20),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    query: z.string().max(100).optional(),
});
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;

export const CreateEventSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(255).default(''),
    details_text: z.string().nullable().optional(),
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    guest_ids: z.array(z.number().int().positive()).min(1),
}).refine(d => new Date(d.start_time) < new Date(d.end_time), {
    message: 'start_time must be before end_time',
    path: ['start_time'],
});
export type CreateEvent = z.infer<typeof CreateEventSchema>;

export const PatchEventSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(255).optional(),
    details_text: z.string().nullable().optional(),
    start_time: z.string().datetime({ offset: true }).optional(),
    end_time: z.string().datetime({ offset: true }).optional(),
    add_guest_ids: z.array(z.number().int().positive()).optional(),
    remove_guest_ids: z.array(z.number().int().positive()).optional(),
}).refine(d => {
    if (d.start_time && d.end_time) return new Date(d.start_time) < new Date(d.end_time);
    return true;
}, {
    message: 'start_time must be before end_time',
    path: ['start_time'],
});
export type PatchEvent = z.infer<typeof PatchEventSchema>;
