import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRepo } from "./user.repo.js";
import { LoginDto, User } from "./user.schema.js";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

export type UserService = {
  login: (dto: LoginDto) => Promise<{ token: string; user: Omit<User, "password"> }>;
};

export function makeUserService(userRepo: UserRepo): UserService {
  const login = async ({ e_id, password }: LoginDto) => {
    const user = await userRepo.findByEId(e_id);
    if (!user) throw new Error("Credenciales inválidas");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Credenciales inválidas");

    const token = jwt.sign(
      { e_id: user.e_id, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  };

  return { login };
}