import jwt from "jsonwebtoken";
import { JwtPayloadSchema, JwtPayload } from "../schemas/auth.schema.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../../config/env.js";

const SECRET = env.auth.jwtSecret;

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