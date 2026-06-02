import { Roles } from "../types/role.type.js";

const roleMap: Record<string, Roles> = {
  // DB
  Admin: Roles.ADMIN,
  It: Roles.IT,
  Usuario: Roles.USER,
  Invitado: Roles.GUEST,
  Asistente_de_Acceso: Roles.ACCESS_ATTENDANT,

  // JWT
  ADMIN: Roles.ADMIN,
  IT: Roles.IT,
  USER: Roles.USER,
  GUEST: Roles.GUEST,
  ACCESS_ATTENDANT: Roles.ACCESS_ATTENDANT,
};

export const mapRole = (roleFromAny: string): Roles => {
  const mapped = roleMap[roleFromAny];
  if (!mapped) {
    throw new Error(`Invalid role: ${roleFromAny}`);
  }
  return mapped;
};