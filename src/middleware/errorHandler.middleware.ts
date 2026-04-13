import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError';
import { GlobalResponse } from '../shared/response/globalresponse';
import { env } from "../config/env"

const { nodeEnv } = env.server;

const isProd = nodeEnv === "production";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {

  if (err instanceof ZodError) {
    GlobalResponse.zodError(res, err);
    return;
  }

  // Known app errors
  if (err instanceof AppError) {
    if (isProd){
        GlobalResponse.fail(res, err.code ?? "", err.statusCode);
    } else {
        GlobalResponse.fail(res, err.message, err.statusCode);
    }
    return;
  }

  // Unknown errors
  if (err instanceof Error) {
    console.error(err.stack);
    if (isProd) {
        GlobalResponse.serverError(res);
    } else {
        GlobalResponse.serverError(res, err.message);
    }
    return;
  }

  GlobalResponse.serverError(res);
};

export const asyncHandler = (fn: any) => 
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);