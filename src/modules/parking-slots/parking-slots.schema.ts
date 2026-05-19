import { z } from "zod";

const CsvArraySchema = <T extends z.ZodTypeAny>(schema: T) =>
    z.string().transform((value) => {
        const values = value
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);

        return z.array(schema).parse(values);
    });

/**
 * Define existencia lógica (cancelación temprana).
 */
export const LifecycleStatusSchema = z.enum(["ACTIVE", "CANCELED"]);

/**
 * Define resultado operativo (asistencia).
 */
export const AttendanceStatusSchema = z.enum(["NOT_ARRIVED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"]);

/**
 * Define si la asignación puede seguir mutando (no queremos que mute a partir de cierto punto, pero sí queremos que mutee antes de ese punto).
 */
export const AllocationStateSchema = z.enum(["SOFT", "FROZEN"]);

export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;
export type AllocationState = z.infer<typeof AllocationStateSchema>;

// Parking Lots

export const ParkingLotSchema = z.object({
    id: z.number().int(),
    name: z.string().min(1, "El nombre es requerido").max(32, "El nombre no puede superar 32 caracteres"),
    capacity: z.number().int().min(0, "La capacidad debe ser un número entero no negativo"),
    priority: z.number().int().min(0, "La prioridad debe ser un número entero no negativo"),
});
export const CreateParkingLotSchema = ParkingLotSchema.omit({ id: true });
export const UpdateParkingLotSchema = CreateParkingLotSchema.partial();

export type ParkingLot = z.infer<typeof ParkingLotSchema>;
export type CreateParkingLot = z.infer<typeof CreateParkingLotSchema>;
export type UpdateParkingLot = z.infer<typeof UpdateParkingLotSchema>;

// Reservations

export const ParkingReservationSchema = z.object({
    id: z.number().int(),
    user_id: z.string().min(1, "El user_id es requerido").max(8, "El user_id no puede superar 8 caracteres"),
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
    lifecycle_status: LifecycleStatusSchema,
    attendance_status: AttendanceStatusSchema,
    allocation_state: AllocationStateSchema,
    canceled_at: z.coerce.date().optional(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date()
}).refine(data => data.end_time.getTime() > data.start_time.getTime(), {
    message: "end_time debe ser posterior a start_time",
    path: ["end_time"],
});

export type ParkingReservation = z.infer<typeof ParkingReservationSchema>;

// POST /parking/reservations
export const CreateParkingReservationSchema = z.object({
    user_id: z.string().optional(),
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
}).refine(data => data.end_time.getTime() > data.start_time.getTime(), {
    message: "end_time debe ser posterior a start_time",
    path: ["end_time"],
});

export type CreateParkingReservation = z.infer<typeof CreateParkingReservationSchema>;

// GET /parking/reservations/ (list)
export const QueryIncludeSchema = z.enum(["parking_lot"]);

export const ListReservationsQuerySchema = z
    .object({
        user_id: z.string().optional(),
        start_time: z.coerce.date().optional(),
        end_time: z.coerce.date().optional(),
        lifecycle_status: LifecycleStatusSchema.optional(),
        attendance_status: AttendanceStatusSchema.optional(),
        allocation_state: AllocationStateSchema.optional(),
        include: CsvArraySchema(QueryIncludeSchema).optional().default([]),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        cursor: z.coerce.number().int().optional(),
    })
    .refine(data => {
        if (data.start_time && data.end_time) {
            return data.end_time.getTime() > data.start_time.getTime();
        }
        return true;
    },
        {
            message: "end_time debe ser posterior a start_time",
            path: ["end_time"]
        }
    );

export type ListReservationsQuery = z.infer<typeof ListReservationsQuerySchema>;

// GET /parking/reservations/:id (get by id)

export const ReservationDetailResponseSchema = z.object({
    reservation: ParkingReservationSchema,
    projection: z
        .object({
            parking_lot: ParkingLotSchema.nullable(),
            slot_index: z.number().int().nullable(),
            fifo_position: z.number().int(),
        })
        .nullable(),
});

export type ReservationDetailResponse = z.infer<typeof ReservationDetailResponseSchema>;

// GET /parking/reservations/buckets
export const StepMinutesSchema = z.enum(["15", "30", "60"]);

export const ReservationBucketsQuerySchema = z.object({
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),

    step_minutes: StepMinutesSchema.default("15"),
}).refine(data => data.end_time.getTime() > data.start_time.getTime(), {
    message: "start_time must be before end_time",
    path: ["end_time"],
});

export const ReservationBucketSchema = z.object({
    timestamp: z.coerce.date(),
    reservation_count: z.number().int().min(0),
})

export const ReservationBucketsResponseSchema = z.object({
    buckets: z.array(ReservationBucketSchema),
})

export type ReservationBucketsQuery = z.infer<typeof ReservationBucketsQuerySchema>;
export type ReservationBucket = z.infer<typeof ReservationBucketSchema>;
export type ReservationBucketsResponse = z.infer<typeof ReservationBucketsResponseSchema>;

// PATCH /parking/reservations/:id/attendance
export const PatchAttendanceSchema = z.object({
    attendance_status: AttendanceStatusSchema,
});

export type PatchAttendance = z.infer<typeof PatchAttendanceSchema>;


export const ReservationIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});