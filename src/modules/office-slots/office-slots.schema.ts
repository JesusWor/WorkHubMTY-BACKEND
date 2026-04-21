import { z } from "zod";

export const OfficeSlotSchema = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  floor_id: z.number(),
  is_blocked: z.boolean(),
});

export const FloorSchema = z.object({
  id: z.number(),
  name: z.string(),
  floor_number: z.number(),
});

export const ReservationSchema = z.object({
  id: z.number(),
  reservable_id: z.number(),
  user_id: z.string(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
  checked_in: z.union([z.literal(0), z.literal(1)]), // o z.boolean().transform(...)
});

export const CreateOfficeSlotSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  floor_id: z.number().int(),
});

export const UpdateOfficeSlotSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  floor_id: z.number().int().optional(),
});

export const BlockSlotBodySchema = z.object({
  is_blocked: z.boolean(),
  reason: z.string().optional(),
});

export const AvailableOfficeSlotsSchema = z.object({
  floor_id: z.coerce.number().optional(),
  start_time: z.string(),
  end_time: z.string(),
  user_id: z.string().optional(),
}).refine(data => data.end_time > data.start_time, {
  message: "end_time must be after start_time",
});

export const FriendOccupancySchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
});

export const SlotAvailabilityResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  floor_id: z.number(),
  floor_name: z.string(),
  is_blocked: z.boolean(),
  is_available: z.boolean(),
  occupied_by_friends: z.array(FriendOccupancySchema),
});

export const SlotIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type OfficeSlot = z.infer<typeof OfficeSlotSchema>;
export type Floor = z.infer<typeof FloorSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type CreateOfficeSlotBody = z.infer<typeof CreateOfficeSlotSchema>;
export type UpdateOfficeSlotBody = z.infer<typeof UpdateOfficeSlotSchema>;
export type BlockSlotBody = z.infer<typeof BlockSlotBodySchema>;
export type AvailableOfficeSlotsQuery = z.infer<typeof AvailableOfficeSlotsSchema>;
export type FriendOccupancy = z.infer<typeof FriendOccupancySchema>;
export type SlotAvailabilityResult = z.infer<typeof SlotAvailabilityResultSchema>;