import { z } from 'zod';

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

export const ZodErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.literal('Validation failed'),
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
    })
  ),
});