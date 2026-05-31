import { z } from "zod";

const CsvArraySchema = <T extends z.ZodTypeAny>(schema: T) =>
    z.string().transform((value) => {
        const values = value
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);

        return z.array(schema).parse(values);
    });

export const AttendanceStatusSchema = z.enum([
    "NOT_ARRIVED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "NO_SHOW",
    "CANCELED",
]);

export const LifecycleStatusSchema = z.enum(["ACTIVE", "CANCELED", "FINALIZED"]);

export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export function inferLifecycleStatus(attendance: AttendanceStatus): LifecycleStatus {
    switch (attendance) {
        case "NOT_ARRIVED":
        case "CHECKED_IN":
            return "ACTIVE";
        case "CANCELED":
            return "CANCELED";
        case "CHECKED_OUT":
        case "NO_SHOW":
            return "FINALIZED";
    }
}

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

export const ListReservationsCursorSchema = z.object({
    lastId: z.number().int().positive(),
});

export const ParkingReservationSchema = z.object({
    id: z.number().int(),
    user_id: z.string().min(1, "El user_id es requerido").max(8, "El user_id no puede superar 8 caracteres"),
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
    lifecycle_status: LifecycleStatusSchema,   // inferido por el repo
    attendance_status: AttendanceStatusSchema,
    canceled_at: z.coerce.date().nullable(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
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
        include: CsvArraySchema(QueryIncludeSchema).optional().default([]),
        limit: z.coerce.number().int().optional(),
        cursor: z.string().nullable().optional().default(null),
    })
    .refine(data => {
        if (data.start_time && data.end_time) {
            return data.end_time.getTime() > data.start_time.getTime();
        }
        return true;
    }, {
        message: "end_time debe ser posterior a start_time",
        path: ["end_time"],
    });

export type ListReservationsQuery = z.infer<typeof ListReservationsQuerySchema>;

export const ListReservationsPageSchema = z.object({
    items: z.array(ParkingReservationSchema),
    nextCursor: z.string().nullable(),
});

export type ListReservationsPage = z.infer<typeof ListReservationsPageSchema>;
export type ListReservationsCursor = z.infer<typeof ListReservationsCursorSchema>;

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
export const StepMinutesSchema = z.enum(["5", "10", "15", "20", "30", "60"]);

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
});

export const ReservationBucketsResponseSchema = z.object({
    buckets: z.array(ReservationBucketSchema),
});

export type ReservationBucketsQuery = z.infer<typeof ReservationBucketsQuerySchema>;
export type ReservationBucket = z.infer<typeof ReservationBucketSchema>;
export type ReservationBucketsResponse = z.infer<typeof ReservationBucketsResponseSchema>;

export const PatchAttendanceSchema = z.object({
    attendance_status: AttendanceStatusSchema,
});

export type PatchAttendance = z.infer<typeof PatchAttendanceSchema>;

export const ReservationIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
