import { JwtPayload } from "../schemas/auth.schema.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}