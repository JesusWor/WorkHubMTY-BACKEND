import { JwtPayload } from "../schemas/auth.schema";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}