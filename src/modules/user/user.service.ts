import bcrypt from "bcrypt";
import { UserRepo } from "./user.repo.js";
import { LoginDto, User } from "./user.schema.js";
import { JwtPayload, mapRole } from "../../shared/schemas/auth.schema.js";
import { generateToken } from "../../shared/utils/jwt.util.js";

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

    const payload: JwtPayload= {
      userId: user.e_id,
      email: user.password,
      role: mapRole(user.role_id.toString())
    };

    const token = generateToken(payload);

    const { password: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  };

  return { login };
}