import { z } from "zod";
import { mapRole } from "../utils/role.util"

const RoleSchema = z.string().transform((r) => mapRole(r));

export const JwtPayloadSchema = z.object({
  eId: z.string(),
  role: RoleSchema,
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;