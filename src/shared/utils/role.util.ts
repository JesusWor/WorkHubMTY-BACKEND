import { Roles } from "../types/role.type";

const roleMap: Record<string, Roles> = {
  // DB
  Admin: Roles.ADMIN,
  It: Roles.IT,
  Usuario: Roles.USER,
  Invitado: Roles.GUEST,

  // JWT
  ADMIN: Roles.ADMIN,
  IT: Roles.IT,
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