import bcrypt from "bcrypt";
import { AuthRepo } from "./auth.repo";
import { UserAuth, LoginDto } from "./auth.schema";
import { JwtPayload, mapRole } from "../../shared/schemas/auth.schema";
import { generateToken } from "../../shared/utils/jwt.util";

export type AuthService = {
    login: (dto: LoginDto) => Promise<string>;
};

export function makeAuthService(repo: AuthRepo): AuthService {
    const login = async ({ eId, password }: LoginDto) => {
        const user = await repo.getById(eId);
        if (!user) throw new Error("Credenciales inválidas");

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) throw new Error("Credenciales inválidas");

        const payload: JwtPayload = {
            eId: user.eId,
            role: mapRole(user.roleName.toString())
        };

        return generateToken(payload);
    };

    return { login };
}