import { z } from "zod";

export const UserSchema = z.object({
    eId: z.string(),
    name: z.string(),
    email: z.email(),
    roleName: z.string()
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



export const WorkGroupSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    memberCount: z.number().int().nonnegative().optional(),
});

export type WorkGroup = z.infer<typeof WorkGroupSchema>;

export const WorkGroupMembersSchema = WorkGroupSchema.extend({
    users: z.array(UserSchema),
});

export type WorkGroupMembers = z.infer<typeof WorkGroupMembersSchema>;

export const CreateGroupSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    memberEIds: z.array(z.string().min(1)).min(1),
});

export type CreateGroup = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
}).refine(data => data.name !== undefined || data.description !== undefined, {
    message: "At least one field must be provided"
});

export type UpdateGroup = z.infer<typeof UpdateGroupSchema>;

export const GroupMembersBodySchema = z.object({
    memberEIds: z.array(z.string().min(1)).min(1),
});

export type GroupMembersBody = z.infer<typeof GroupMembersBodySchema>;
