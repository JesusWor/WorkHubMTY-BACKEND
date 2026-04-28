import { z } from "zod";

export const ParkingReservationCountSchema = z.object({
    id: z.int(),
    name: z.string(),
    capacity: z.int().min(0),
    reservedCount: z.int().min(0)
});

export const ParkingReservationSchema = z.object({
    id: z.int(),
    parking_lot_id: z.int(),
    user_id: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
    start_time: z.string(),
    end_time: z.string(),
    checked_in: z.number().transform(val => Boolean(val))
});

export const CreateParkingReservationSchema = ParkingReservationSchema.omit({
    id: true,
    user_id: true,
    parking_lot_id: true,
    checked_in: true,
}).refine(data => data.end_time > data.start_time, {
    message: "end_time debe ser posterior a start_time",
    path: ["end_time"],
});

export const ReassignParkingReservationSchema = z.object({
    parking_lot_id: z.number().int().positive("El parking_lot_id debe ser un entero positivo"),
});

export const ParkingIdParamSchema = z.object({
    id: z.coerce.number().int().positive("El id debe ser un entero positivo"),
});

export const ParkingAvailabilityQuerySchema = z.object({
    start_time: z.string().min(1, "start_time es requerido"),
    end_time: z.string().min(1, "end_time es requerido"),
}).refine(data => data.end_time > data.start_time, {
    message: "end_time debe ser posterior a start_time",
    path: ["end_time"],
});

export type ParkingReservationCount = z.infer<typeof ParkingReservationCountSchema>;
export type ParkingReservation = z.infer<typeof ParkingReservationSchema>;
export type CreateParkingReservation = z.infer<typeof CreateParkingReservationSchema>;
export type ReassignParkingReservation = z.infer<typeof ReassignParkingReservationSchema>;
export type ParkingIdParam = z.infer<typeof ParkingIdParamSchema>;
export type ParkingAvailabilityQuery = z.infer<typeof ParkingAvailabilityQuerySchema>;