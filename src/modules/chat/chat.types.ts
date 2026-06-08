import { z, ZodTypeAny } from 'zod';
import { JwtPayload } from '../../shared/schemas/auth.schema.js';
import { OfficeSlotsService } from '../office-slots/office-slots.service.js';
import { ParkingSlotsService } from '../parking-slots/parking-slots.service.js';
import { UserService } from '../user/user.service.js';

export interface ChatContext {
    user: JwtPayload;
}

export interface ChatServices {
    officeSlots: OfficeSlotsService;
    parkingSlots: ParkingSlotsService;
    user: UserService;
}

export type SSEEventType =
    | 'thinking'
    | 'token'
    | 'tool_start'
    | 'tool_done'
    | 'client_tool'   // one event per client tool — frontend collects all before responding
    | 'done'
    | 'error';

export interface ThinkingEventData { text: string }
export interface TokenEventData { text: string }
export interface ToolStartEventData { name: string; label: string }
export interface ToolDoneEventData { name: string; label: string; ok: boolean; error?: string }
/** Each CLIENT tool emits its own event with a stable widgetId for tracking */
export interface ClientToolEventData {
    widgetId: string;   // stable UUID — lets frontend match result to request
    name: string;
    args: Record<string, unknown>;
}
export interface DoneEventData {
    message: string;
    /** When CLIENT tools are pending, lists their widgetIds so frontend knows what to collect */
    pending_widgets?: string[];
}
export interface ErrorEventData { message: string }

export interface ToolAttemptTrace {
    attempt: number;
    args: Record<string, unknown>;
    resultCount?: number;
    error?: string;
}

export interface ServerToolDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
    name: string;
    label: string;
    description: string;
    target: 'SERVER';
    schema: TSchema;
    handler: (
        args: z.infer<TSchema>,
        ctx: ChatContext,
        services: ChatServices,
        trace: ToolAttemptTrace[],
    ) => Promise<unknown>;
}

export interface ClientToolDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
    name: string;
    label: string;
    description: string;
    target: 'CLIENT';
    schema: TSchema;
}

export type ToolDefinition = ServerToolDefinition | ClientToolDefinition;

export interface ResourceDefinition {
    name: string;
    description: string;
    load(ctx: ChatContext, services: ChatServices): Promise<unknown>;
}

export interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

// Frontend sends all resolved widgets in a single POST
export interface SingleWidgetResult {
    widget_id: string;      // matches ClientToolEventData.widgetId
    tool_name: string;
    args: Record<string, unknown>;
    cancelled?: boolean;    // true if user dismissed without acting
}

export interface ChatRequest {
    messages: HistoryMessage[];
    message: string;
    /** One entry per resolved CLIENT widget — all must be present before backend resumes */
    widget_results?: SingleWidgetResult[];
}
