import { z } from "zod";
import { Roles } from "../../middleware/index.js";

export const UserAuthSchema = z.object({
  eId: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
  name: z.string(),
  passwordHash: z.string(),
  roleName: z.string()
});

export type UserAuth = z.infer<typeof UserAuthSchema>;

export const LoginSchema = z.object({
  eId: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
  password: z.string().min(3, "La contraseña debe tener al menos 3 caracteres"),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export type User = {
  eId: string;
  name: string;
  role: string;
};

export type RefreshSession = {
  id: number;
  userId: string;
  tokenHash: string; // SHA-256 hex, 64 chars
  expiresAt: Date;
  createdAt: Date;
  rotatedFrom: number | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
};

export type InsertSessionDto = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedFrom: number | null;
  userAgent: string | null;
  ip: string | null;
};
