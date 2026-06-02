export enum Roles {
  ADMIN = "ADMIN",
  IT = "IT",
  USER = "USER",
  GUEST = "GUEST",
  ACCESS_ATTENDANT = "ACCESS_ATTENDANT",
};

export const INTERNAL_ROLES = [
  Roles.ADMIN,
  Roles.IT,
  Roles.USER,
] as const;

export const SUPERVISOR_ROLES = [
  Roles.ADMIN,
  Roles.IT,
] as const;

export const STAFF_ROLES = [
  Roles.ADMIN,
  Roles.ACCESS_ATTENDANT,
] as const;