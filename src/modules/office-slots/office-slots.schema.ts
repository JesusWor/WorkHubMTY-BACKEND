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
  checked_in: z.union([z.literal(0), z.literal(1)]),
});

export const ParticipantStatusEnum = z.enum(["PENDING", "ACCEPTED", "REJECTED"]);

export const WorkGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative().optional(),
});

export const UserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
});

export const GuestSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

export const ReservationParticipantSchema = z.object({
  id: z.number(),
  reservationId: z.number(),
  userId: z.string().nullable(),
  guestId: z.number().nullable(),
  ownershipPriority: z.number(),
  checkedIn: z.boolean(),
  status: ParticipantStatusEnum,
  user: UserSummarySchema.nullable(),
  guest: GuestSchema.nullable(),
});

export const ReservationDetailSchema = z.object({
  id: z.number(),
  reservableId: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  description: z.string(),
  canOverlap: z.boolean(),
  workGroups: z.array(WorkGroupSchema),
  participants: z.array(ReservationParticipantSchema),
});

// ─── Events ────────────────────────────────────────────────────────────────────

export const ReservableInfoSchema = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  floor_id: z.number(),
  floor_name: z.string(),
  floor_number: z.number(),
});

export const EventSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  reservable: ReservableInfoSchema.nullable(),
});

export const CreateEventSchema = z.object({
  title: z.string().min(1).default("Evento"),
  description: z.string().default(""),
  reservable_id: z.number().int().positive().optional(),
  start_time: z.string(),
  end_time: z.string(),
}).refine((data) => data.end_time > data.start_time, {
  message: "end_time must be after start_time",
});

export const GetEventsQuerySchema = z.object({
  reservable_id: z.coerce.number().int().positive().optional(),
  floor_id: z.coerce.number().int().positive().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
}).refine(
  (data) => {
    if (data.start_time && data.end_time) return data.end_time > data.start_time;
    return true;
  },
  { message: "end_time must be after start_time" }
);

// ─── Office Slots ───────────────────────────────────────────────────────────────

export const CreateOfficeSlotSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  floor_id: z.number().int().positive(),
});

export const UpdateOfficeSlotSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  floor_id: z.number().int().positive().optional(),
});

export const BlockSlotBodySchema = z.object({
  is_blocked: z.boolean(),
});

export const CreateReservationScheduleSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
});

export const CreateReservationBatchSchema = z.object({
  reservableId: z.number().int().positive(),
  description: z.string().default(""),
  schedules: z.array(CreateReservationScheduleSchema).min(1),
  workGroupIds: z.array(z.number().int().positive()).optional(),
  userIds: z.array(z.string()).optional(),
  guestIds: z.array(z.number().int().positive()).optional(),
  canOverlap: z.boolean(),
});

export const UpdateParticipantStatusSchema = z.object({
  status: ParticipantStatusEnum,
  reinvite: z.boolean().optional(),
});

export const AvailableOfficeSlotsSchema = z.object({
  floor_id: z.coerce.number().optional(),
  start_time: z.string(),
  end_time: z.string(),
  user_id: z.string().optional(),
}).refine((data) => data.end_time > data.start_time, {
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
  code: z.string().optional(),
  capacity: z.number(),
  floor_id: z.number(),
  floor_name: z.string(),
  is_blocked: z.boolean(),
  is_available: z.boolean(),
  status: z.enum(["available", "occupied", "soon"]).optional(),
  statusLabel: z.string().optional(),
  timeline: z.array(
    z.object({
      id: z.string(),
      start: z.string(),
      end: z.string(),
      status: z.enum(["free", "occupied", "search"]),
    }),
  ).optional(),
  occupied_by_friends: z.array(FriendOccupancySchema),
});

export const SlotIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const ParticipantIdParamSchema = z.object({
  pid: z.coerce.number().int().positive(),
});

export const ReservationSummarySchema = z.object({
  id: z.number(),
  reservable_id: z.number(),
  reservable_name: z.string(),
  floor_id: z.number(),
  floor_name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  checked_in: z.boolean(),
  status: ParticipantStatusEnum,
});

export const UserReservationSummarySchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  reservations: z.array(ReservationSummarySchema),
});

export const FriendsReservationsSummarySchema = z.array(UserReservationSummarySchema);

export type OfficeSlot = z.infer<typeof OfficeSlotSchema>;
export type Floor = z.infer<typeof FloorSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type ParticipantStatus = z.infer<typeof ParticipantStatusEnum>;
export type WorkGroup = z.infer<typeof WorkGroupSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type GuestSummary = z.infer<typeof GuestSchema>;
export type ReservationParticipant = z.infer<typeof ReservationParticipantSchema>;
export type ReservationDetail = z.infer<typeof ReservationDetailSchema>;
export type CreateOfficeSlotBody = z.infer<typeof CreateOfficeSlotSchema>;
export type UpdateOfficeSlotBody = z.infer<typeof UpdateOfficeSlotSchema>;
export type BlockSlotBody = z.infer<typeof BlockSlotBodySchema>;
export type AvailableOfficeSlotsQuery = z.infer<typeof AvailableOfficeSlotsSchema>;
export type FriendOccupancy = z.infer<typeof FriendOccupancySchema>;
export type SlotAvailabilityResult = z.infer<typeof SlotAvailabilityResultSchema>;
export type CreateReservationBatchBody = z.infer<typeof CreateReservationBatchSchema>;

export type ReservationSummary = z.infer<typeof ReservationSummarySchema>;
export type UserReservationSummary = z.infer<typeof UserReservationSummarySchema>;
export type FriendReservationsSummary = z.infer<typeof FriendsReservationsSummarySchema>;

export type Event = z.infer<typeof EventSchema>;
export type CreateEventBody = z.infer<typeof CreateEventSchema>;
export type GetEventsQuery = z.infer<typeof GetEventsQuerySchema>;
export type ReservableInfo = z.infer<typeof ReservableInfoSchema>;
