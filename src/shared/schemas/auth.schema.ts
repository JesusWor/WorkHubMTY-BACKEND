import { z } from "zod";

export enum Roles {
  ADMIN = "ADMIN",
  USER = "USER",
  GUEST = "GUEST",
};

const roleMap: Record<string, Roles> = {
  // DB
  Admin: Roles.ADMIN,
  Usuario: Roles.USER,
  Invitado: Roles.GUEST,

  // JWT
  ADMIN: Roles.ADMIN,
  USER: Roles.USER,
  GUEST: Roles.GUEST,
};

export const mapRole = (roleFromAny: string): Roles => {
  const mapped = roleMap[roleFromAny];
  if (!mapped) {
    throw new Error(`Invalid role: ${roleFromAny}`);
  }
  return mapped;
};

const RoleSchema = z.string().transform((r) => mapRole(r));

export const JwtPayloadSchema = z.object({
  id: z.string(),
  role: RoleSchema,
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;