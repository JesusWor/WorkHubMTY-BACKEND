import { Request, Response } from "express";
import { UserService } from "./user.service";
import { LoginSchema } from "./user.schema";
import { GlobalResponse } from "../../shared/response/globalresponse";

export type UserController = {
  login: (req: Request, res: Response) => Promise<void>;
};

export function makeUserController(service: UserService): UserController {
  const login = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log(req);
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