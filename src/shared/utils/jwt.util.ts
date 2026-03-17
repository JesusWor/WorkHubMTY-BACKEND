import jwt from "jsonwebtoken";
import { JwtPayloadSchema, JwtPayload } from "../schemas/auth.schema";
import { AppError } from "../errors/AppError";

if (!process.env.JWT_SECRET) {
  throw new AppError("JWT_SECRET is not defined in environment variables", 500);
}

const SECRET = process.env.JWT_SECRET;

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