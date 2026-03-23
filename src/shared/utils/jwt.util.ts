import jwt from "jsonwebtoken";
import { JwtPayloadSchema, JwtPayload } from "../schemas/auth.schema";
import { AppError } from "../errors/AppError";
import { config } from "../../config/env";

if (!config.jwt_secret) {
  throw new AppError("JWT_SECRET is not defined in environment variables", 500);
}

const SECRET = config.jwt_secret;

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, SECRET, {
    expiresIn: "1d"
  });
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, SECRET);
    const parsed = JwtPayloadSchema.parse(decoded);
    return parsed;
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
};