import { Request, Response, NextFunction } from "express";
import { GlobalResponse } from "../shared/response/globalresponse.js";
import { Roles } from "../shared/types/role.type.js";

export type RolePolicy = {
    allow?: readonly Roles[];
    deny?: readonly Roles[];
};

export const authorize = (policy: RolePolicy) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return GlobalResponse.unauthorized(res);
        }

        const userRole = req.user.role;

        if (policy.deny?.includes(userRole)) {
            return GlobalResponse.forbidden(res);
        }
        if (policy.allow && !policy.allow.includes(userRole)) {
            return GlobalResponse.forbidden(res);
        }

        next();
    }
};