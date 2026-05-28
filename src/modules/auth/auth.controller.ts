import { CookieOptions, Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { LoginSchema } from "./auth.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import { verifyToken } from "../../shared/utils/jwt.util.js";
import { UnauthorizedError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js"

const { nodeEnv } = env.server;
const REFRESH_TOKEN_EXPIRATION_MS = env.auth.refreshTokenExpiresMs;

const isProd = nodeEnv === 'production';

const REFRESH_COOKIE_NAME = "refresh-token";

export type AuthController = {
    login: (req: Request, res: Response) => Promise<void>;
    refresh: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
};

const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: REFRESH_TOKEN_EXPIRATION_MS
};

function getSessionMeta(req: Request) {
    return {
        userAgent: req.headers["user-agent"] ?? null,
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
            ?? req.socket.remoteAddress
            ?? null,
    };
};

export function makeAuthController(service: AuthService): AuthController {
    const login = async (req: Request, res: Response): Promise<void> => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const { tokens, user } = await service.login(parsed.data, getSessionMeta(req));

        res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, cookieOptions);

        GlobalResponse.okWithData(res, { accessToken: tokens.accessToken, user }, "Login exitoso");
    };

    const refresh = async (req: Request, res: Response): Promise<void> => {
        const rawRefreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

        if (!rawRefreshToken) throw new UnauthorizedError("No hay sesión activa");

        const { tokens, user } = await service.refresh(rawRefreshToken, getSessionMeta(req));

        // Rotate
        res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, cookieOptions);

        GlobalResponse.okWithData(res, { accessToken: tokens.accessToken, user }, "Token renovado");
    };


    const logout = async (req: Request, res: Response): Promise<void> => {
        const rawRefreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

        if (rawRefreshToken) {
            // Best-effort revoke — don't throw if token is already gone
            await service.logout(rawRefreshToken).catch(() => undefined);
        }

        res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
        GlobalResponse.ok(res, "Logout exitoso");
    };

    return {
        login,
        refresh,
        logout
    };
}
