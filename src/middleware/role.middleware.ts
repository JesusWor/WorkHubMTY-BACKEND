import { Request, Response, NextFunction } from "express";
import { GlobalResponse } from "../shared/response/globalresponse";

export const roleMiddleware = (...requiredRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (requiredRoles.length === 0) next();

        if (!req.user) {
            return GlobalResponse.unauthorized(res);
        }
        
        if(!requiredRoles.includes(req.user.role)) {
            return GlobalResponse.forbidden(res);
        }

        next();
    }
};