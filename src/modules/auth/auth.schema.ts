import { z } from "zod";
import { Roles } from "../../middleware";

export const UserAuthSchema = z.object({
  eId: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
  passwordHash: z.string(),
  roleName: z.string()
});

export type UserAuth = z.infer<typeof UserAuthSchema>;

export const LoginSchema = z.object({
  eId: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
  password: z.string().min(3, "La contraseña debe tener al menos 3 caracteres"),
});

export type LoginDto = z.infer<typeof LoginSchema>;