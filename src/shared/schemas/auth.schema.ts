import { z } from "zod";

export const JwtPayloadSchema = z.object({
    userId: z.string(),
    email: z.email(), // z.string().email()
    role: z.string(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;