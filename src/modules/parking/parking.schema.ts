import { z } from "zod";

export const ParkingReservationCountSchema = z.object({
    id: z.int(),
    name: z.string(),
    capacity: z.int().min(0),
    reservedCount: z.int().min(0)
});

export type ParkingReservationCount = z.infer<typeof ParkingReservationCountSchema>;

export const ParkingReservationSchema = z.object({
    id: z.int(),
    parking_lot_id: z.int(),
    user_id: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
    start_time: z.string(),
    end_time: z.string(),
    checked_in: z.number().transform(val => Boolean(val))
});

export type ParkingReservation = z.infer<typeof ParkingReservationSchema>;

export const CreateParkingReservationSchema = ParkingReservationSchema.omit({
    id: true,
    user_id: true,
    parking_lot_id: true,
    checked_in: true,
});

export type CreateParkingReservation = z.infer<typeof CreateParkingReservationSchema>;