import { randomUUID } from 'crypto';
import { Content, Part } from '@google/generative-ai';
import { getGeminiModel } from '../../infra/gemini/gemini.client.js';
import { toolRegistry } from './chat.tool-registry.js';
import { resourceRegistry } from './chat.resource-registry.js';
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

async function loadResourceContext(ctx: ChatContext, services: ChatServices): Promise<string> {
    const all = resourceRegistry.all();
    if (all.length === 0) return '';

    const parts: string[] = [];
    for (const resource of all) {
        try {
            const data = await resource.load(ctx, services);
            parts.push(`### ${resource.name}\n${JSON.stringify(data, null, 2)}`);
        } catch (err) {
            // Non-fatal: if a resource fails to load, skip it
            parts.push(`### ${resource.name}\n[Error al cargar: ${err instanceof Error ? err.message : String(err)}]`);
        }
    }
    return parts.join('\n\n');
}

function buildSystemPrompt(
    userEId: string,
    userRole: string,
    timezone: string,
    resourceContext: string,
): string {
    const now = new Date().toISOString();
    const localNow = new Date().toLocaleString('es-MX', { timeZone: timezone, hour12: false });

    return `Eres un asistente virtual de WorkHub, una app de gestión de espacios de oficina y estacionamientos.
Fecha y hora actual (UTC): ${now}
Fecha y hora local del usuario: ${localNow} (zona horaria: ${timezone})
Usuario autenticado: eId="${userEId}", rol="${userRole}"

══════════════════════════════
ZONA HORARIA — REGLA CRÍTICA
══════════════════════════════
- La zona horaria del usuario es "${timezone}" (UTC-6, es decir, hora local = UTC − 6 horas SIEMPRE).
- NO uses UTC-5. NO uses UTC-4. La conversión es SIEMPRE UTC-6.
- Todas las fechas almacenadas en la base de datos están en UTC.
- Cuando el usuario diga horas locales ("hoy a las 9am", "mañana a las 3pm"), conviértelas a UTC sumando 6 horas antes de pasarlas a cualquier herramienta.
  Ejemplo: "hoy a las 8am" en ${timezone} → T14:00:00.000Z (UTC).
  Ejemplo: "hoy a las 12pm" en ${timezone} → T18:00:00.000Z (UTC).
- Cuando presentes fechas al usuario, réstalas 6 horas (UTC→local) para mostrarlas en hora local.
- La fecha/hora local de referencia para "hoy", "mañana", "esta semana" es: ${localNow}.

══════════════════════════════════════════
ESPACIOS DE OFICINA — IDENTIDAD DE DATOS
══════════════════════════════════════════
Cada espacio tiene DOS identificadores distintos. NUNCA los confundas:
  • code  → string único legible: "MZ001", "ICSJ-3040", "IC3001". Es el nombre que ves en la UI.
  • id    → número entero autogenerado (surrogate PK): 1, 2, 3…

REGLAS:
- Para mostrar al usuario → usa SIEMPRE el campo "code" (nunca el id numérico).
- Para pasar a herramientas (createReservationBatch.reservable_id) → usa SIEMPRE el campo "id" numérico.
- Cuando busques un espacio por nombre que el usuario mencione (ej. "MZ001") → búscalo por "code", no por "id".
- NUNCA inventes un id. El id SOLO viene de una búsqueda previa (getAvailableReservables, getAllReservables).

══════════════════════════════════════════════
PISOS — IDENTIFICACIÓN
══════════════════════════════════════════════
- Un piso tiene: id numérico (floorId para filtros), nombre de texto (ej: "Piso 2", "IC Piso 3").
- El recurso "floors" contiene los nombres de piso disponibles.
- Para filtrar por piso en getAvailableReservables, necesitas pasar floorId.
- Para obtener el floorId: mira los espacios ya cargados (cada uno tiene su campo "floor" con el nombre).
  Si el usuario dice "Piso 2" o "segundo piso" y ves espacios con floor="Piso 2", ya sabes a cuál se refiere.
- Si no conoces el floorId, omite el filtro y busca sin él; luego filtra los resultados por nombre de piso.

══════════════════════════════════════════════════
USUARIOS Y PARTICIPANTES — MOSTRAR NOMBRES
══════════════════════════════════════════════════
- El recurso "users_directory" contiene el mapeo eId → nombre completo.
- SIEMPRE que presentes participantes de una reserva, muestra el nombre real, NO el eId crudo.
  MAL:  "Participantes: 000001, 000002, 000003"
  BIEN: "Participantes: Ana García, Carlos López, María Rodríguez"
- Si un eId no aparece en el directorio, muéstralo como eId (puede ser externo/enmascarado).
- Para resolver nombre → eId: primero busca en users_directory; solo llama searchUsers si no está.

══════════════════════════════════════════════════
MOSTRAR ESPACIOS DISPONIBLES — FLUJO OBLIGATORIO
══════════════════════════════════════════════════
Cuando getAvailableReservables devuelva resultados, sigue EXACTAMENTE este flujo:

  SI count == 0:
    → Informa que no hay disponibilidad y ofrece alternativas (cambiar horario, ver todos los espacios).

  SI count == 1:
    → Muestra el espacio directamente (code, floor, capacity) y pregunta si desea reservarlo.

  SI 2 ≤ count ≤ 20:
    → Llama INMEDIATAMENTE showSpaceCarousel con TODOS los espacios.
    → NO escribas una lista de texto. NO escribas "Aquí te muestro algunos". Sólo llama showSpaceCarousel.

  SI count > 20:
    → Toma los primeros 20 espacios ordenados por code.
    → Llama showSpaceCarousel con esos 20.
    → En el campo "context" indica: "Mostrando 20 de los disponibles — puedes pedir filtrar por piso o capacidad".

CRÍTICO: showSpaceCarousel es un tool CLIENT. Cuando lo llamas, el backend lo enviará al frontend
como un widget interactivo. NO generes texto de lista como sustituto. Confía en el widget.

══════════════════════════════════════
ESTRATEGIA DE BÚSQUEDA
══════════════════════════════════════
- Primero intenta con filtros específicos (nombre/code, horario, capacidad).
- Si obtienes 0 resultados, relaja los filtros: quita "query" primero, luego capacidad, luego piso.
- NUNCA busques un espacio por "query" con nombre descriptivo genérico como "sala de conferencias".
  El campo "query" busca por CODE o NAME del espacio. Si el usuario dice "quiero una sala", no uses query.
  Usa minCapacity/maxCapacity para filtrar por tamaño en su lugar.
- Si obtienes 0 tras todos los intentos, llama getAllReservables para diagnóstico.

══════════════════════════════════════
REGLAS DE RESERVA DE OFICINA
══════════════════════════════════════
- "timestamps" → array de { start_time: "ISO8601 UTC", end_time: "ISO8601 UTC" }
- "participants" → array de eIds. Para incluir al usuario actual usa "${userEId}".
- Si desconoces los participantes → llama openParticipantPicker.
- reservable_id SIEMPRE viene de una búsqueda previa. NUNCA lo inventes.

══════════════════════════════════════
REGLAS DE ESTACIONAMIENTO
══════════════════════════════════════
- Usar getParkingAvailability para ver disponibilidad antes de reservar.
- createParkingReservation crea la reserva para el usuario actual.
- cancelParkingReservation requiere el ID de la reservación (obtenlo con getMyParkingReservations).
- El estacionamiento muestra letras (A, B…) — esos son nombres de lotes (parking_lots), no IDs.

══════════════════════════════════════
CAPACIDADES
══════════════════════════════════════
- Buscar y reservar espacios de oficina (cubículos/salas)
- Buscar disponibilidad y reservar cajones de estacionamiento
- Consultar y cancelar tus reservaciones (oficina y estacionamiento)
- Buscar compañeros por nombre
- Ver reservas propias y de otros usuarios

REGLAS GENERALES:
1. Responde en el idioma del usuario (por defecto español).
2. Usa markdown: **negritas** para datos clave, listas con -, tablas cuando sea útil.
3. Si tienes información suficiente, actúa de forma autónoma.

PROHIBICIONES:
- Nunca inventes IDs, códigos de espacios ni cajones.
- Nunca asumas que un horario está disponible sin consultarlo.
- Nunca uses UTC-5 o cualquier offset distinto de UTC-6 para ${timezone}.
- Nunca listes espacios como texto plano cuando showSpaceCarousel es la opción adecuada.
- Todas las fechas a las herramientas: strings ISO 8601 UTC (ej: "2025-06-10T15:00:00.000Z").

══════════════════════════════════════
CONTEXTO CARGADO (RECURSOS)
══════════════════════════════════════
${resourceContext || '(sin recursos cargados)'}`;
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

        // ── CLIENT tool ─────────────────────────────────────────────────────
        if (tool.target === 'CLIENT') {
            const parsed = tool.schema.safeParse(args);
            const safeArgs = parsed.success ? (parsed.data as Record<string, unknown>) : args;
            const widgetId = randomUUID();
            sse.clientTool(widgetId, name, safeArgs);
            sse.toolDone(name, tool.label, true);
            pendingWidgets.set(widgetId, name);
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

        // ── SERVER tool ─────────────────────────────────────────────────────
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

const GEMINI_RETRY_ATTEMPTS = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 3_000;

function isGemini503(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return err.message.includes('503') || err.message.toLowerCase().includes('service unavailable');
}

async function sendMessageWithRetry(
    chat: ReturnType<ReturnType<typeof getGeminiModel>['startChat']>,
    input: string | Part[],
    sse: SSEWriter,
): Promise<AsyncIterable<any>> {
    for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt++) {
        try {
            const result = await chat.sendMessageStream(input as any);
            return result.stream;
        } catch (err) {
            if (isGemini503(err) && attempt < GEMINI_RETRY_ATTEMPTS) {
                const delay = GEMINI_RETRY_BASE_DELAY_MS * attempt;
                sse.retrying(
                    attempt,
                    attempt === 1
                        ? 'La respuesta puede demorar un poco, por favor espera...'
                        : `Reintentando (intento ${attempt + 1})...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            throw err;
        }
    }
    throw new Error('sendMessageWithRetry: exceeded max attempts');
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

    // Load MCP resources (floors, users_directory, available_locations)
    const resourceContext = await loadResourceContext(ctx, services);
    const systemInstruction = buildSystemPrompt(ctx.user.eId, ctx.user.role, ctx.timezone, resourceContext);

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

        const stream = await sendMessageWithRetry(chat, nextInput, sse);
        const { text, functionCalls } = await streamTurn(stream, sse);

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
            const wrapStream = await sendMessageWithRetry(chat, parts, sse);
            const { text: wrapText } = await streamTurn(wrapStream, sse);
            sse.done(wrapText, [...allPendingWidgets.keys()]);
            return;
        }

        nextInput = parts;
    }

    sse.error(`Se alcanzó el límite de ${MAX_TOOL_ITERATIONS} iteraciones de herramientas.`);
}
