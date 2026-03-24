import { z } from "zod";

export const LoginSchema = z.object({
  e_id: z.string().min(1, "El e_id es requerido").max(8, "El e_id no puede superar 8 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export type User = {
  e_id: string;
  username: string;
  email: string;
  password: string;
  role_id: number;
  create_time: Date;
};