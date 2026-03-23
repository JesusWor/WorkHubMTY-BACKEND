import { Request, Response, NextFunction } from "express";
import { GlobalResponse } from "../shared/response/globalresponse";
import { Roles } from "../shared/schemas/auth.schema";

export const roleMiddleware = (...requiredRoles: Roles[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (requiredRoles.length === 0) return next();

        if (!req.user) {
            return GlobalResponse.unauthorized(res);
        }
        
        if(!requiredRoles.includes(req.user.role)) {
            return GlobalResponse.forbidden(res);
        }

        next();
    }
};