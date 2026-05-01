import bcrypt from "bcrypt";
import { AuthRepo } from "./auth.repo";
import { LoginDto, User } from "./auth.schema";
import { JwtPayload } from "../../shared/schemas/auth.schema";
import { mapRole } from "../../shared/utils/role.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { NotFoundError, UnauthorizedError } from "../../shared/errors/AppError";

export type AuthService = {
    login: (dto: LoginDto) => Promise<{ token: string; user: User }>;
    me: (eId: string) => Promise<User>;
};

export function makeAuthService(repo: AuthRepo): AuthService {
    const login = async ({ eId, password }: LoginDto): Promise<{ token: string; user: User }> => {
        const user = await repo.getById(eId);
        if (!user) throw new UnauthorizedError("Credenciales inválidas");

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) throw new UnauthorizedError("Credenciales inválidas");

        const payload: JwtPayload = {
            eId: user.eId,
            role: mapRole(user.roleName.toString())
        };

        const token = generateToken(payload);

        return {
            token,
            user: {
                eId: user.eId,
                name: user.name,
                role: mapRole(user.roleName.toString()),
            },
        };

    };

    const me = async (eId: string): Promise<User> => {
        const user = await repo.getMe(eId);
        if (!user) throw new NotFoundError("Usuario no encontrado");
        return user;
    };


    return { login, me };
}
