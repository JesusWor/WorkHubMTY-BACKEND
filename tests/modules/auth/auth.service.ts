import bcrypt from "bcrypt";
import { AuthRepo } from "./auth.repo.js";
import { LoginDto, User, InsertSessionDto } from "./auth.schema.js";
import { JwtPayload } from "../../shared/schemas/auth.schema.js";
import { mapRole } from "../../shared/utils/role.util.js";
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from "../../shared/utils/jwt.util.js";
import { NotFoundError, UnauthorizedError, InternalError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";

const REFRESH_TOKEN_EXPIRATION = env.auth.refreshTokenExpiresMs;

export type TokenPair = {
    accessToken: string;
    refreshToken: string; // raw opaque string
};

export type SessionMeta = {
    userAgent: string | null;
    ip: string | null;
};


export type AuthService = {
    login: (dto: LoginDto, meta: SessionMeta) => Promise<{ tokens: TokenPair; user: User }>;
    refresh: (rawRefreshToken: string, meta: SessionMeta) => Promise<{ tokens: TokenPair; user: User }>;
    logout: (rawRefreshToken: string) => Promise<void>;
    me: (eId: string) => Promise<User>;
};

export function makeAuthService(repo: AuthRepo): AuthService {

    // Generates until no collisions
    async function generateUniqueRefreshToken(): Promise<{ raw: string; hash: string }> {
        let raw: string;
        let hash: string;
        let attempts = 0;

        do {
            if (attempts > 5) {
                throw new InternalError("Failed to generate a unique refresh token after 5 attempts");
            }
            raw = generateRefreshToken();
            hash = hashRefreshToken(raw);
            attempts++;
        } while (await repo.hashExists(hash));

        return { raw, hash };
    }

    async function createSession(
        userId: string,
        meta: SessionMeta,
        rotatedFrom: number | null = null
    ): Promise<{ tokens: TokenPair; sessionId: number }> {
        const { raw, hash } = await generateUniqueRefreshToken();

        const expiresAt = new Date(Date.now() + env.auth.refreshTokenExpiresMs);

        const dto: InsertSessionDto = {
            userId,
            tokenHash: hash,
            expiresAt,
            rotatedFrom,
            userAgent: meta.userAgent,
            ip: meta.ip,
        };

        const sessionId = await repo.insertSession(dto);

        const userRow = await repo.getMe(userId);
        if (!userRow) throw new NotFoundError("Usuario no encontrado");

        const payload: JwtPayload = {
            eId: userRow.eId,
            role: mapRole(userRow.role),
        };

        const accessToken = generateAccessToken(payload);

        return {
            tokens: { accessToken, refreshToken: raw },
            sessionId,
        };
    }

    const login = async ({ eId, password }: LoginDto, meta: SessionMeta): Promise<{ tokens: TokenPair; user: User }> => {
        const userAuth = await repo.getById(eId);
        if (!userAuth) throw new UnauthorizedError("Credenciales inválidas");

        const isMatch = await bcrypt.compare(password, userAuth.passwordHash);
        if (!isMatch) throw new UnauthorizedError("Credenciales inválidas");

        const { tokens } = await createSession(eId, meta, null);

        const user: User = {
            eId: userAuth.eId,
            name: userAuth.name,
            role: mapRole(userAuth.roleName.toString()),
        };

        return { tokens, user };
    };

    const refresh = async (rawRefreshToken: string, meta: SessionMeta): Promise<{ tokens: TokenPair; user: User }> => {
        const hash = hashRefreshToken(rawRefreshToken);
        const session = await repo.findSessionByHash(hash);

        if (!session) {
            throw new UnauthorizedError("Refresh token inválido");
        }

        // Token reused - stolen
        if (session.revokedAt !== null) {
            await repo.revokeAllUserSessions(session.userId);
            throw new UnauthorizedError("Token comprometido: todas las sesiones han sido revocadas");
        }

        if (new Date() > session.expiresAt) {
            await repo.revokeSession(session.id);
            throw new UnauthorizedError("Refresh token expirado");
        }

        await repo.revokeSession(session.id);

        // Rotate
        const { tokens } = await createSession(session.userId, meta, session.id);

        const user = await repo.getMe(session.userId);
        if (!user) throw new NotFoundError("Usuario no encontrado");

        return { tokens, user };
    };

    const logout = async (rawRefreshToken: string): Promise<void> => {
        const hash = hashRefreshToken(rawRefreshToken);
        const session = await repo.findSessionByHash(hash);

        // If session doesn't exist or is already revoked, treat as success (idempotent)
        if (!session || session.revokedAt !== null) return;

        await repo.revokeSession(session.id);
    };

    const me = async (eId: string): Promise<User> => {
        const user = await repo.getMe(eId);
        if (!user) throw new NotFoundError("Usuario no encontrado");
        return user;
    };


    return { login, refresh, logout, me };
}
