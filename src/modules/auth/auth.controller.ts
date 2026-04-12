import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginSchema } from "./auth.schema";
import { GlobalResponse } from "../../shared/response/globalresponse";
import { success } from "zod";

export type AuthController = {
    login: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
};

export function makeAuthController(service: AuthService): AuthController {
    const login = async (req: Request, res: Response): Promise<void> => {
        try {
            const parsed = LoginSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.zodError(res, parsed.error);
                return;
            }

            const token = await service.login(parsed.data);

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: 1000 * 60 * 60 * 8
            });

            GlobalResponse.ok(res, "Login exitoso");
        } catch (error) {
            GlobalResponse.unauthorized(res, error instanceof Error ? error.message : undefined);
        }
    };

    const logout = async (req: Request, res: Response): Promise<void> => {
        try {
            res.clearCookie("token", {
                httpOnly: true,
                secure: true,
                sameSite: "strict"
            });
            GlobalResponse.ok(res, "Logout exitoso");
        } catch (error) {
            GlobalResponse.unauthorized(res, error instanceof Error ? error.message : undefined);
        }
    }

    return { 
        login,
        logout
    };
}