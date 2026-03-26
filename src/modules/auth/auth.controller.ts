import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginSchema } from "./auth.schema";
import { GlobalResponse } from "../../shared/response/globalresponse";

export type AuthController = {
    login: (req: Request, res: Response) => Promise<void>;
};

export function makeAuthController(service: AuthService): AuthController {
    const login = async (req: Request, res: Response): Promise<void> => {
        try {
            const parsed = LoginSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.zodError(res, parsed.error);
                return;
            }

            const result = await service.login(parsed.data);
            GlobalResponse.okWithData(res, result, "Login exitoso");
        } catch (error) {
            GlobalResponse.unauthorized(res, error instanceof Error ? error.message : undefined);
        }
    };

    return { login };
}