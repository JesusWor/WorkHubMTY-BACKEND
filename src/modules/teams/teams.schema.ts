import { z } from "zod";
import { UserSchema } from "../user/user.schema.js";

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  memberCount: z.number().int().nonnegative().optional(),
});

export const TeamMemberSchema = UserSchema.omit({ status: true });

export const teamIdSchema = z.string();

export type Team = z.infer<typeof TeamSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
