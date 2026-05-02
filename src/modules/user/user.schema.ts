import { z } from "zod";

export const UserSchema = z.object({
    eId: z.string(),
    name: z.string(),
    email: z.email(),
    roleName: z.string()
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.extend({
    password: z.string()
});
export type CreateUser = z.infer<typeof CreateUserSchema>;

// export const UpdateUserSchema = UserSchema.partial().pick({ name: true, email: true, roleName: true });
// export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const ProfileSchema = UserSchema.extend({
    friendCount: z.number(),
    achievementCount:  z.number(),
})
export type Profile = z.infer<typeof ProfileSchema>;
