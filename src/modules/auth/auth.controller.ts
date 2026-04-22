import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginSchema } from "./auth.schema";
import { GlobalResponse } from "../../shared/response/globalresponse";
import { AppError } from "../../shared/errors/AppError";
import { env } from "../../config/env"

const { nodeEnv } = env.server;

const isProd = nodeEnv === 'production';

export type AuthController = {
    login: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
};

export function makeAuthController(service: AuthService): AuthController {
    const login = async (req: Request, res: Response): Promise<void> => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const token = await service.login(parsed.data);

        res.cookie("token", token, {
            httpOnly: true,
            secure: isProd,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 8
        });

        GlobalResponse.ok(res, "Login exitoso");
    };

    const logout = async (_req: Request, res: Response): Promise<void> => {
        res.clearCookie("token", {
            httpOnly: true,
            secure: isProd,
            sameSite: "strict"
        });
        GlobalResponse.ok(res, "Logout exitoso");
    };

    return {
        login,
        logout
    };
}
