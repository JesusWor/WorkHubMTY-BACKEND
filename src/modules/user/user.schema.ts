import { z } from "zod";

export const UserStatusSchema = z.enum(["online", "idle", "offline"]);

export const UserRelationExcludeSchema = z.enum([
  "friends",
  "sent_requests",
  "received_requests",
]);

function normalizeCsvList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeCsvList(item));
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const UserSchema = z.object({
  eId: z.string(),
  name: z.string(),
  email: z.email(),
  roleName: z.string(),
  title: z.string().nullable(),
  status: UserStatusSchema.default("offline"),
});

export const CreateUserSchema = UserSchema.extend({
  password: z.string(),
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;

export const ProfileSchema = UserSchema.extend({
  stats: {
    streak: z.number(),
    friendCount: z.number(),
    levelsPassed: z.number(),
    hoursInOffice: z.number(),
  },
});

export type Profile = z.infer<typeof ProfileSchema>;

export const ListUsersCursorSchema = z.object({
  score: z.number(),
  name: z.string(),
  eId: z.string(),
});

export const ListUsersPageSchema = z.object({
  items: z.array(UserSchema),
  nextCursor: z.string().nullable(),
});

export const ListUsersQuerySchema = z.object({
  query: z.string().optional(),
  exclude: z.preprocess(
    normalizeCsvList,
    z.array(UserRelationExcludeSchema).default([]),
  ),
  excludeId: z.preprocess(
    normalizeCsvList,
    z.array(z.string().min(1)).default([]),
  ),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().nullable().optional().default(null),
});

export const GuestSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
  invited_by: z.string(),
});

export type Guest = z.infer<typeof GuestSchema>;

export const CreateGuestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export type CreateGuest = z.infer<typeof CreateGuestSchema>;

export const UpdateGuestSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "At least one field must be provided",
  });

export type UserRelationExclude = z.infer<typeof UserRelationExcludeSchema>;
export type ListUsersCursor = z.infer<typeof ListUsersCursorSchema>;
export type ListUsersPage = z.infer<typeof ListUsersPageSchema>;
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
export type UpdateGuest = z.infer<typeof UpdateGuestSchema>;
