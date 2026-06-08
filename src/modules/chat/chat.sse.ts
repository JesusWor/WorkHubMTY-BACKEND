import { Response } from 'express';
import {
    SSEEventType,
    ThinkingEventData,
    TokenEventData,
    ToolStartEventData,
    ToolDoneEventData,
    ClientToolEventData,
    RetryingEventData,
    DoneEventData,
    ErrorEventData,
} from './chat.types.js';

export class SSEWriter {
    private closed = false;

    constructor(private res: Response) {}

    private send<T>(event: SSEEventType, data: T): void {
        if (this.closed) return;
        try {
            this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
            this.closed = true;
        }
    }

    thinking(text: string): void {
        this.send<ThinkingEventData>('thinking', { text });
    }

    token(text: string): void {
        this.send<TokenEventData>('token', { text });
    }

    toolStart(name: string, label: string): void {
        this.send<ToolStartEventData>('tool_start', { name, label });
    }

    toolDone(name: string, label: string, ok: boolean, error?: string): void {
        this.send<ToolDoneEventData>('tool_done', { name, label, ok, error });
    }

    /** Emit a CLIENT tool event with a stable widgetId */
    clientTool(widgetId: string, name: string, args: Record<string, unknown>): void {
        this.send<ClientToolEventData>('client_tool', { widgetId, name, args });
    }

    /** Inform the frontend that a transient Gemini error occurred and a retry is in progress */
    retrying(attempt: number, message: string): void {
        this.send<RetryingEventData>('retrying', { attempt, message });
    }

    done(message: string, pendingWidgets?: string[]): void {
        this.send<DoneEventData>('done', {
            message,
            ...(pendingWidgets?.length ? { pending_widgets: pendingWidgets } : {}),
        });
    }

    error(message: string): void {
        this.send<ErrorEventData>('error', { message });
    }

    close(): void {
        this.closed = true;
    }
}

export function initSSE(res: Response): SSEWriter {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    return new SSEWriter(res);
}
