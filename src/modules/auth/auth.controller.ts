import { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { LoginSchema } from "./auth.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import { verifyToken } from "../../shared/utils/jwt.util.js";
import { UnauthorizedError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js"

const { nodeEnv } = env.server;

const isProd = nodeEnv === 'production';

const HOUR_MS = 1000 * 60 * 60;

export type AuthController = {
    login: (req: Request, res: Response) => Promise<void>;
    me: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
};

const cookieOptions = {
    httpOnly: true,
    secure: true,
    maxAge: HOUR_MS * 0.25,
}

export function makeAuthController(service: AuthService): AuthController {
    const login = async (req: Request, res: Response): Promise<void> => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const { token, user } = await service.login(parsed.data);

        res.cookie("token", cookieOptions);

        GlobalResponse.okWithData(res, user, "Login exitoso");
    };

    const me = async (req: Request, res: Response): Promise<void> => {
        const token = req.cookies?.token;
        if (!token) throw new UnauthorizedError("No autenticado");

        const payload = verifyToken(token);
        const user = await service.me(payload.eId);

        GlobalResponse.okWithData(res, user, "Usuario autenticado");
    };


    const logout = async (_req: Request, res: Response): Promise<void> => {
        // res.clearCookie("token", {
        //     httpOnly: true,
        //     secure: isProd,
        //     sameSite: "strict"
        // });
        res.clearCookie("token", cookieOptions);
        GlobalResponse.ok(res, "Logout exitoso");
    };

    return {
        login,
        me,
        logout
    };
}
