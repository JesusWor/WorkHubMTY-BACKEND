import bcrypt from "bcrypt";
import { AuthRepo } from "./auth.repo.js";
import { LoginDto } from "./auth.schema.js";
import { JwtPayload } from "../../shared/schemas/auth.schema.js";
import { mapRole } from "../../shared/utils/role.util.js";
import { generateToken } from "../../shared/utils/jwt.util.js";
import { UnauthorizedError } from "../../shared/errors/AppError.js";

export type AuthService = {
    login: (dto: LoginDto) => Promise<string>;
};

export function makeAuthService(repo: AuthRepo): AuthService {
    const login = async ({ eId, password }: LoginDto): Promise<string> => {
        const user = await repo.getById(eId);
        if (!user) throw new UnauthorizedError("Credenciales inválidas");

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) throw new UnauthorizedError("Credenciales inválidas");

        const payload: JwtPayload = {
            eId: user.eId,
            role: mapRole(user.roleName.toString())
        };

        return generateToken(payload);
    };

    return { login };
}
