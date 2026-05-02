import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../shared/utils/jwt.util.js";
import { GlobalResponse } from "../shared/response/globalresponse.js";
import { JwtPayloadSchema } from "../shared/schemas/auth.schema.js"

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