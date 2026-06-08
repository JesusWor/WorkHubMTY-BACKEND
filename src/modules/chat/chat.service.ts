import { randomUUID } from 'crypto';
import { Content, Part } from '@google/generative-ai';
import { getGeminiModel } from '../../infra/gemini/gemini.client.js';
import { toolRegistry } from './chat.tool-registry.js';
import { buildFunctionDeclarations, buildGeminiHistory } from './chat.gemini.js';
import { SSEWriter } from './chat.sse.js';
import {
    ChatContext,
    ChatServices,
    HistoryMessage,
    ServerToolDefinition,
    SingleWidgetResult,
    ToolAttemptTrace,
} from './chat.types.js';

const MAX_TOOL_ITERATIONS = 12;

function buildSystemPrompt(userEId: string, userRole: string): string {
    const now = new Date().toISOString();
    return `Eres un asistente virtual de WorkHub, una app de gestión de espacios de oficina y estacionamientos.
Fecha y hora actual: ${now}
Usuario autenticado: eId="${userEId}", rol="${userRole}"

CAPACIDADES:
- Buscar y reservar espacios de oficina (cubículos/salas)
- Buscar disponibilidad y reservar cajones de estacionamiento
- Consultar y cancelar tus reservaciones (oficina y estacionamiento)
- Buscar compañeros por nombre
- Ver reservas propias y de otros usuarios

REGLAS GENERALES:
1. Responde en el idioma del usuario (por defecto español).
2. Usa markdown: **negritas** para datos clave, listas con -, tablas cuando sea útil.
3. Si tienes información suficiente, actúa de forma autónoma.

ESTRATEGIA DE BÚSQUEDA (CRÍTICO):
- Primero intenta con filtros específicos (nombre, horario, capacidad).
- Si obtienes 0 resultados, relaja los filtros: quita el nombre/query primero, luego la capacidad, luego el piso.
- Si sigues con 0 resultados, llama getAllReservables para ver todos los espacios y explica cuáles están ocupados.
- NUNCA informes al usuario que "no hay espacios" tras un solo intento fallido.

REGLAS DE RESERVA DE OFICINA:
- "timestamps" → array de { start_time: "ISO8601", end_time: "ISO8601" }
- "participants" → array de eIds. Para incluir al usuario actual usa "${userEId}".
- Si desconoces los participantes → llama openParticipantPicker.
- Si hay múltiples espacios disponibles → llama showSpaceCarousel con los resultados.
- Para resolver un nombre a eId → usa searchUsers primero.

REGLAS DE ESTACIONAMIENTO:
- Usar getParkingAvailability para ver disponibilidad antes de reservar.
- getParkingAvailability devuelve capacidad total y cuántas reservas hay en cada franja.
- createParkingReservation crea la reserva para el usuario actual (o para otro si eres admin).
- cancelParkingReservation requiere el ID de la reservación (obtenlo con getMyParkingReservations).

PROHIBICIONES:
- Nunca inventes IDs, nombres de espacios ni cajones.
- Nunca asumas que un horario está disponible sin consultarlo.
- Todas las fechas: strings ISO 8601 (ej: "2025-06-10T15:00:00.000Z").`;
}

interface TurnResult {
    text: string;
    functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

async function streamTurn(
    stream: AsyncIterable<any>,
    sse: SSEWriter,
): Promise<TurnResult> {
    let text = '';
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for await (const chunk of stream) {
        const parts: Part[] = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
            if ((part as any).thought) {
                sse.thinking((part as any).text ?? '');
                continue;
            }
            if (part.text) {
                text += part.text;
                sse.token(part.text);
            }
            if (part.functionCall) {
                functionCalls.push({
                    name: part.functionCall.name,
                    args: (part.functionCall.args ?? {}) as Record<string, unknown>,
                });
            }
        }
    }

    return { text, functionCalls };
}

interface ProcessResult {
    parts: Part[];
    /** widgetId → tool_name mapping for all CLIENT tools emitted */
    pendingWidgets: Map<string, string>;
}

async function processFunctionCalls(
    calls: Array<{ name: string; args: Record<string, unknown> }>,
    ctx: ChatContext,
    services: ChatServices,
    sse: SSEWriter,
): Promise<ProcessResult> {
    const parts: Part[] = [];
    const pendingWidgets = new Map<string, string>();

    for (const { name, args } of calls) {
        const tool = toolRegistry.get(name);

        if (!tool) {
            parts.push({
                functionResponse: {
                    name,
                    response: { error: `Tool desconocida: ${name}. Tools disponibles: ${toolRegistry.all().map(t => t.name).join(', ')}` },
                },
            });
            continue;
        }

        sse.toolStart(name, tool.label);

        // ── CLIENT tool ────────────────────────────────────────────────────────
        if (tool.target === 'CLIENT') {
            const parsed = tool.schema.safeParse(args);
            const safeArgs = parsed.success ? (parsed.data as Record<string, unknown>) : args;
            const widgetId = randomUUID();
            sse.clientTool(widgetId, name, safeArgs);
            sse.toolDone(name, tool.label, true);
            pendingWidgets.set(widgetId, name);
            // Tell the model this widget was dispatched — it continues normally
            parts.push({
                functionResponse: {
                    name,
                    response: {
                        dispatched: true,
                        widget_id: widgetId,
                        message: `Widget "${name}" enviado al frontend (widgetId: ${widgetId}). El usuario interactuará con él y su respuesta llegará en el próximo mensaje.`,
                    },
                },
            });
            continue;
        }

        // ── SERVER tool ────────────────────────────────────────────────────────
        const parsed = tool.schema.safeParse(args);
        if (!parsed.success) {
            const fieldErrors = JSON.stringify(parsed.error.flatten().fieldErrors);
            sse.toolDone(name, tool.label, false, `Argumentos inválidos`);
            parts.push({
                functionResponse: {
                    name,
                    response: { error: `Argumentos inválidos para "${name}": ${fieldErrors}` },
                },
            });
            continue;
        }

        const trace: ToolAttemptTrace[] = [];
        try {
            const result = await (tool as ServerToolDefinition).handler(
                parsed.data,
                ctx,
                services,
                trace,
            );
            sse.toolDone(name, tool.label, true);
            parts.push({
                functionResponse: {
                    name,
                    response: { result, _trace: trace.length > 1 ? trace : undefined },
                },
            });
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            sse.toolDone(name, tool.label, false, errMsg);
            parts.push({
                functionResponse: {
                    name,
                    response: { error: errMsg, _trace: trace },
                },
            });
        }
    }

    return { parts, pendingWidgets };
}

function buildWidgetResultsMessage(results: SingleWidgetResult[]): string {
    const parts = results.map((r) => {
        if (r.cancelled) {
            return `- Widget "${r.tool_name}" (id: ${r.widget_id}): el usuario canceló la acción.`;
        }
        return `- Widget "${r.tool_name}" (id: ${r.widget_id}): ${JSON.stringify(r.args)}`;
    });
    return `[El usuario completó las siguientes interacciones con los widgets del frontend]\n${parts.join('\n')}\n\nContinúa con la tarea usando estos datos.`;
}

export async function runChatStream(
    messages: HistoryMessage[],
    newMessage: string,
    widgetResults: SingleWidgetResult[] | undefined,
    ctx: ChatContext,
    services: ChatServices,
    sse: SSEWriter,
): Promise<void> {
    const model = getGeminiModel();
    const geminiTools = buildFunctionDeclarations(toolRegistry.all());
    const systemInstruction = buildSystemPrompt(ctx.user.eId, ctx.user.role);

    const history: Content[] = buildGeminiHistory(messages);

    let userInput: string;
    if (widgetResults?.length) {
        userInput = buildWidgetResultsMessage(widgetResults);
    } else {
        userInput = newMessage;
    }

    const chat = model.startChat({
        history,
        tools: [geminiTools],
        systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
    });

    let iterations = 0;
    let nextInput: string | Part[] = userInput;
    const allPendingWidgets = new Map<string, string>();

    while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        const resultStream = await chat.sendMessageStream(nextInput as any);
        const { text, functionCalls } = await streamTurn(resultStream.stream, sse);

        if (functionCalls.length === 0) {
            sse.done(text);
            return;
        }

        const { parts, pendingWidgets } = await processFunctionCalls(
            functionCalls,
            ctx,
            services,
            sse,
        );

        for (const [wid, name] of pendingWidgets) {
            allPendingWidgets.set(wid, name);
        }

        if (allPendingWidgets.size > 0) {
            const wrapStream = await chat.sendMessageStream(parts as any);
            const { text: wrapText } = await streamTurn(wrapStream.stream, sse);
            sse.done(wrapText, [...allPendingWidgets.keys()]);
            return;
        }

        nextInput = parts;
    }

    sse.error(`Se alcanzó el límite de ${MAX_TOOL_ITERATIONS} iteraciones de herramientas.`);
}
