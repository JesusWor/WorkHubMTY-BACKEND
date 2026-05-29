import { z } from "zod";
import { UserSchema } from "../user/user.schema.js";

export const TeamMemberSchema = UserSchema.omit({ status: true });

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative().optional(),
});

export const teamIdSchema = z.string();

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  memberEIds: z.array(z.string().min(1)).min(1),
});

export const TeamMembersSchema = TeamSchema.extend({
    users: z.array(UserSchema),
});


export const WorkGroupSchema = TeamSchema;

export type WorkGroup = z.infer<typeof WorkGroupSchema>;

export const WorkGroupMembersSchema = WorkGroupSchema.extend({
    users: z.array(UserSchema),
});

export type WorkGroupMembers = z.infer<typeof WorkGroupMembersSchema>;

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


export type CreateGroup = z.infer<typeof CreateGroupSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamMembers = z.infer<typeof TeamMembersSchema>;
