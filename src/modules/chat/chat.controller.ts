import { Request, Response } from 'express';
import { z } from 'zod';
import { initSSE } from './chat.sse.js';
import { runChatStream } from './chat.service.js';
import { ChatServices } from './chat.types.js';
import { GlobalResponse } from '../../shared/response/globalresponse.js';

const HistoryMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
});

const SingleWidgetResultSchema = z.object({
    widget_id: z.string().uuid(),
    tool_name: z.string(),
    args: z.record(z.string(), z.unknown()),
    cancelled: z.boolean().optional(),
});

const ChatRequestSchema = z.object({
    messages: z.array(HistoryMessageSchema).default([]),
    message: z.string().default(''),
    /** Array of resolved widget results (replaces singular tool_result) */
    widget_results: z.array(SingleWidgetResultSchema).optional(),
});

export function makeChatController(services: ChatServices) {
    return {
        chat: async (req: Request, res: Response): Promise<void> => {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const parsed = ChatRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.badRequest(res, 'Cuerpo de solicitud inválido');
                return;
            }

            const { messages, message, widget_results } = parsed.data;

            if (!message.trim() && !widget_results?.length) {
                GlobalResponse.badRequest(res, 'Se requiere "message" o "widget_results"');
                return;
            }

            const ctx = { user: req.user };
            const sse = initSSE(res);

            try {
                await runChatStream(
                    messages,
                    message,
                    widget_results,
                    ctx,
                    services,
                    sse,
                );
            } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : 'Error inesperado del servidor';
                sse.error(errMsg);
            } finally {
                sse.close();
                res.end();
            }
        },
    };
}

export type ChatController = ReturnType<typeof makeChatController>;
