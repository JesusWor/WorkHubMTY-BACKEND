import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../shared/utils/jwt.util";
import { GlobalResponse } from "../shared/response/globalresponse";
import { JwtPayloadSchema } from "../shared/schemas/auth.schema"

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return GlobalResponse.unauthorized(res);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    const parsed = JwtPayloadSchema.parse(decoded);
    req.user = decoded;
    return next();
  } catch (error) {
    return GlobalResponse.unauthorized(res);
  }
};