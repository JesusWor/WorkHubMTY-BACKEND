import { z } from "zod";
export const UserStatusSchema = z.enum(["online", "idle", "offline"]);

export const UserSchema = z.object({
    eId: z.string(),
    name: z.string(),
    email: z.email(),
    roleName: z.string(),
    status: UserStatusSchema.default("offline"),
});

export const CreateUserSchema = UserSchema.extend({
    password: z.string()
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;

// export const UpdateUserSchema = UserSchema.partial().pick({ name: true, email: true, roleName: true });
// export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const ProfileSchema = UserSchema.extend({
    friendCount: z.number(),
    achievementCount: z.number(),
})
export type Profile = z.infer<typeof ProfileSchema>;

export const GuestSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    invited_by: z.string()
});

export type Guest = z.infer<typeof GuestSchema>;

export const CreateGuestSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
});

export type CreateGuest = z.infer<typeof CreateGuestSchema>;

export const UpdateGuestSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
}).refine(data => data.name !== undefined || data.email !== undefined, {
    message: "At least one field must be provided"
});

export type UpdateGuest = z.infer<typeof UpdateGuestSchema>;
