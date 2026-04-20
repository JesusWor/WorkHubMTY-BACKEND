import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../shared/utils/jwt.util";
import { GlobalResponse } from "../shared/response/globalresponse";
import { JwtPayloadSchema } from "../shared/schemas/auth.schema"

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return GlobalResponse.unauthorized(res);
  }

  try {
    const decoded = verifyToken(token);
    const parsed = JwtPayloadSchema.parse(decoded);
    req.user = parsed;
    return next();
  } catch (error) {
    return GlobalResponse.unauthorized(res);
  }
};