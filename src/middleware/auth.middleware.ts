import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../shared/utils/jwt.util";
import { GlobalResponse } from "../shared/response/globalresponse";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return GlobalResponse.unauthorized(res);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return GlobalResponse.unauthorized(res);
  }
};