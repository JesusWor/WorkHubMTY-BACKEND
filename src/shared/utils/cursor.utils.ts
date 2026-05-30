import { z } from 'zod';
import { BadRequestError } from '../errors/AppError.js';

export class Cursor {
    static encode<T>(payload: T): string {
        return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    }

    static decode<TSchema extends z.ZodType>(
        cursor: string,
        schema: TSchema,
    ): z.infer<TSchema> {
        try {
            const json = Buffer.from(cursor, 'base64').toString('utf8');
            return schema.parse(JSON.parse(json));
        } catch {
            throw new BadRequestError('Invalid cursor');
        }
    }
}