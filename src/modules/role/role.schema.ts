import { z } from "zod";

export const RoleSchema = z.object({
    id: z.number(),
    name: z.string()
});
export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleSchema = RoleSchema.omit({ id: true });
export type CreateRole = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = RoleSchema.partial().pick({ name: true });
export type UpdateRole = z.infer<typeof UpdateRoleSchema>;