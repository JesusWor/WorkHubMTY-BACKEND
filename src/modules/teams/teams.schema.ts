import { z } from "zod";
import { UserSchema } from "../user/user.schema.js";

export const TeamIdSchema = z.string().min(1);

export const TeamMemberSchema = UserSchema.omit({ status: true });

export const TeamSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    memberCount: z.number().int().nonnegative().optional(),
});

export const TeamMembersSchema = TeamSchema.extend({
    users: z.array(UserSchema),
});

const UniqueMemberIdsSchema = z.array(z.string().min(1)).min(1).refine(
    (memberEIds) => new Set(memberEIds).size === memberEIds.length,
    { message: "Member ids must be unique" }
);

export const CreateTeamSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    memberEIds: z.array(z.string().min(1)).min(1),
});

export const UpdateTeamSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    addMemberEIds: UniqueMemberIdsSchema.optional(),
    removeMemberEIds: UniqueMemberIdsSchema.optional(),
}).superRefine((data, ctx) => {
    const hasName = data.name !== undefined;
    const hasDescription = data.description !== undefined;
    const hasAddMembers = data.addMemberEIds !== undefined;
    const hasRemoveMembers = data.removeMemberEIds !== undefined;

    if (!hasName && !hasDescription && !hasAddMembers && !hasRemoveMembers) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one field must be provided",
            path: [],
        });
        return;
    }

    if (data.addMemberEIds && data.removeMemberEIds) {
        const overlap = data.addMemberEIds.filter((memberEId) => data.removeMemberEIds?.includes(memberEId));
        if (overlap.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Member ids cannot be added and removed in the same request",
                path: ["addMemberEIds"],
            });
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Member ids cannot be added and removed in the same request",
                path: ["removeMemberEIds"],
            });
        }
    }
});

export type TeamId = z.infer<typeof TeamIdSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamMembers = z.infer<typeof TeamMembersSchema>;
export type CreateTeam = z.infer<typeof CreateTeamSchema>;
export type UpdateTeam = z.infer<typeof UpdateTeamSchema>;
