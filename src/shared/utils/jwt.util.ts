import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JwtPayloadSchema, JwtPayload } from "../schemas/auth.schema.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../../config/env.js";

const {
  jwtSecret: SECRET,
  accessTokenExpiresMs: ACCESS_TOKEN_EXPIRES_MS,
  refreshTokenExpiresMs: REFRESH_TOKEN_EXPIRES_MS
}= env.auth;


// Access Token - jwt

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_MS / 1000, // convert ms to seconds
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

// Refresh Token - random string

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

export const hashRefreshToken = (rawToken: string): string => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};
