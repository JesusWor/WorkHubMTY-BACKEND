import { z } from 'zod';

export const ReservationAttendanceStatusSchema = z.enum([
    'NOT_ARRIVED',
    'CHECKED_IN',
    'CHECKED_OUT',
    'NO_SHOW',
    'CANCELED',
]);

export const ReservationLifecycleStatusSchema = z.enum(['ACTIVE', 'CANCELED', 'FINALIZED']);

export type ReservationAttendanceStatus = z.infer<typeof ReservationAttendanceStatusSchema>;
export type ReservationLifecycleStatus = z.infer<typeof ReservationLifecycleStatusSchema>;

export const RESERVATION_TRANSITIONS: Record<
    ReservationAttendanceStatus,
    ReservationAttendanceStatus[]
> = {
    NOT_ARRIVED: ['CHECKED_IN', 'NO_SHOW', 'CANCELED'],
    CHECKED_IN: ['CHECKED_OUT'],
    CHECKED_OUT: [],
    NO_SHOW: [],
    CANCELED: [],
};

export const NON_CANCELABLE_STATUSES: ReservationAttendanceStatus[] = [
    'CHECKED_IN',
    'CHECKED_OUT',
    'NO_SHOW',
];

export function inferReservationLifecycle(
    status: ReservationAttendanceStatus,
): ReservationLifecycleStatus {
    switch (status) {
        case 'NOT_ARRIVED':
        case 'CHECKED_IN':
            return 'ACTIVE';
        case 'CANCELED':
            return 'CANCELED';
        case 'CHECKED_OUT':
        case 'NO_SHOW':
            return 'FINALIZED';
    }
}

export const ParticipantAttendanceStatusSchema = z.enum([
    'INVITED',
    'NOT_ARRIVED',
    'CHECKED_IN',
    'CHECKED_OUT',
    'NO_SHOW',
    'NOT_ACCEPTED', // terminal: propagado cuando la reserva finaliza en INVITED
    'REJECTED', // terminal
    'CANCELED', // terminal
]);

export type ParticipantAttendanceStatus = z.infer<typeof ParticipantAttendanceStatusSchema>;

export const PARTICIPANT_USER_TRANSITIONS: Record<string, ParticipantAttendanceStatus[]> = {
    INVITED: ['NOT_ARRIVED', 'CHECKED_IN', 'REJECTED'],
    NOT_ARRIVED: ['CHECKED_IN', 'CANCELED'],
    CHECKED_IN: ['CHECKED_OUT'],
};

export const ReservableSchema = z.object({
    id: z.number().int(),
    name: z.string().min(1).max(32),
    capacity: z.number().int().min(1),
    floor: z.string(),
    status:z.enum(['available', 'occupied', 'soon', 'blocked']),
    is_blocked: z.boolean(),
});

const OccupiedRange = z.object({
    id:z.number(),
    startTime:z.string(),
    endTime:z.string()
})

export const DetailedReservableSchema = ReservableSchema.extend({
    timeline:z.array(OccupiedRange)
});

export const CreateReservableSchema = ReservableSchema.omit({ id: true, status: true }).extend({
    floor_id: z.number().int(),
});

export const UpdateReservableSchema = CreateReservableSchema.partial();

export type Reservable = z.infer<typeof ReservableSchema>;
export type CreateReservable = z.infer<typeof CreateReservableSchema>;
export type UpdateReservable = z.infer<typeof UpdateReservableSchema>;

// Reservation

export const ReservationCategorySchema = z.enum(['RESERVATION', 'MEETING']);
export type ReservationCategory = z.infer<typeof ReservationCategorySchema>;

export const ReservationSchema = z.object({
    id: z.number().int(),
    reservable_id: z.number().int(),
    category: ReservationCategorySchema,
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
    description: z.string().max(255),
    attendance_status: ReservationAttendanceStatusSchema,
    lifecycle_status: ReservationLifecycleStatusSchema,
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
});

export type Reservation = z.infer<typeof ReservationSchema>;

export type ReservationSummary = Pick<Reservation, 'id' | 'start_time' | 'end_time' | 'attendance_status'> & {
    reservable_id: number;
    reservable_name: string;
    floor_id: number;
    floor_name: string;
};

// Participant

export const ParticipantSchema = z.object({
    id: z.number().int(),
    reservations_id: z.number().int(),
    user_id: z.string(),
    ownership_priority: z.number().int(),
    attendance_status: ParticipantAttendanceStatusSchema,
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
});

export const ParticipantPublicSchema = ParticipantSchema.extend({
    user_id: z.string().nullable(),
    attendance_status: ParticipantAttendanceStatusSchema.nullable(),
    ownership_priority: z.number().int().nullable(),
});

export type Participant = z.infer<typeof ParticipantSchema>;
export type ParticipantPublic = z.infer<typeof ParticipantPublicSchema>;


export const ReservationWithParticipantsSchema = ReservationSchema.extend({
    reservable: ReservableSchema,
    participants: z.array(ParticipantPublicSchema),
});

export type ReservationWithParticipants = z.infer<typeof ReservationWithParticipantsSchema>;


export const TimestampPairSchema = z
    .object({
        start_time: z.coerce.date(),
        end_time: z.coerce.date(),
    })
    .refine((d) => d.end_time > d.start_time, {
        message: 'end_time debe ser posterior a start_time',
        path: ['end_time'],
    });

export const CreateReservationBatchSchema = z
    .object({
        reservable_id: z.number().int().positive(),
        category: ReservationCategorySchema.default('RESERVATION'),
        description: z.string().max(255).default(''),
        timestamps: z.array(TimestampPairSchema).min(1, 'Se requiere al menos 1 timestamp'),
        participants: z.array(z.string()).default([]),
    })
    .refine(
        (d) => {
            const unique = new Set(
                d.timestamps.map(
                    (t) => `${t.start_time.toISOString()}-${t.end_time.toISOString()}`,
                ),
            );
            return unique.size === d.timestamps.length;
        },
        { message: 'Los timestamps no pueden repetirse', path: ['timestamps'] },
    );

export type CreateReservationBatch = z.infer<typeof CreateReservationBatchSchema>;

export const PatchReservationAttendanceSchema = z.object({
    attendance_status: ReservationAttendanceStatusSchema,
});

export const PatchParticipantAttendanceSchema = z.object({
    attendance_status: ParticipantAttendanceStatusSchema,
});

export const ListReservationsQuerySchema = z
    .object({
        reservable_id: z.coerce.number().int().optional(),
        user_id: z.string().optional(),
        start_time: z.coerce.date().optional(),
        end_time: z.coerce.date().optional(),
        attendance_status: ReservationAttendanceStatusSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        cursor: z.string().nullable().optional().default(null),
    })
    .refine(
        (d) => {
            if (d.start_time && d.end_time) return d.end_time > d.start_time;
            return true;
        },
        { message: 'end_time debe ser posterior a start_time', path: ['end_time'] },
    );

export type ListReservationsQuery = z.infer<typeof ListReservationsQuerySchema>;

export const ListReservationsCursorSchema = z.object({
    lastId: z.number().int().positive(),
});

export const ListReservationsPageSchema = z.object({
    items: z.array(ReservationWithParticipantsSchema),
    nextCursor: z.string().nullable(),
});

export type ListReservationsPage = z.infer<typeof ListReservationsPageSchema>;

export const ReservationIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const ReservationDetailQuerySchema = z.object({
    detail: z.coerce.boolean().optional().default(false),
});

export const ReservationIdBodySchema = z.object({
    dates: z.array(z.coerce.date()).optional(),
});

export const AvailableReservablesQuerySchema = z.object({
    floorId: z.coerce.number().int().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    minCapacity: z.coerce.number().int().min(1).optional(),
    maxCapacity: z.coerce.number().int().min(1).optional(),
    query: z.string().optional(),
    daysToApply: z.array(z.coerce.date()).optional(),
    userId: z.string().optional(),
}).refine(
    (d) => {
        if (d.startTime && d.endTime) return d.endTime > d.startTime;
        return true;
    }, { message: 'endTime debe ser posterior a startTime', path: ['endTime'] },
);

export type AvailableReservablesQuery = z.infer<typeof AvailableReservablesQuerySchema>;

export const ParticipantIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
    participantId: z.coerce.number().int().positive(),
});

export const UserIdParamSchema = z.object({
    userId: z.string().min(1),
});
