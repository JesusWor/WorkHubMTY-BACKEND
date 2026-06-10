import { z } from 'zod';
import { toolRegistry } from '../chat.tool-registry.js';
import {
    CreateReservationBatchSchema,
    AvailableReservablesQuery,
} from '../../office-slots/office-slots.schema.js';
import { ToolAttemptTrace } from '../chat.types.js';

async function searchWithFallback(
    baseQuery: AvailableReservablesQuery,
    service: { getAvailableReservables: (q: AvailableReservablesQuery) => Promise<any[]> },
    trace: ToolAttemptTrace[],
): Promise<any[]> {
    const attempts: AvailableReservablesQuery[] = [
        // 1. Exact query as requested
        baseQuery,
        // 2. Drop text query filter (keep time + capacity + floor)
        baseQuery.query ? { ...baseQuery, query: undefined } : null,
        // 3. Drop capacity filters (keep time + floor)
        (baseQuery.minCapacity || baseQuery.maxCapacity)
            ? { ...baseQuery, query: undefined, minCapacity: undefined, maxCapacity: undefined }
            : null,
        // 4. Drop floor filter (keep time only)
        baseQuery.floor
            ? { ...baseQuery, query: undefined, minCapacity: undefined, maxCapacity: undefined, floorId: undefined }
            : null,
        // 5. No filters at all — just availability check
        { startTime: baseQuery.startTime, endTime: baseQuery.endTime },
    ].filter((q): q is AvailableReservablesQuery => q !== null);

    // Deduplicate by JSON key
    const seen = new Set<string>();
    const dedupedAttempts = attempts.filter((a) => {
        const key = JSON.stringify(a);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    for (let i = 0; i < dedupedAttempts.length; i++) {
        const q = dedupedAttempts[i];
        try {
            const results = await service.getAvailableReservables(q);
            trace.push({ attempt: i + 1, args: q as any, resultCount: results.length });
            if (results.length > 0) return results;
        } catch (err) {
            trace.push({ attempt: i + 1, args: q as any, error: err instanceof Error ? err.message : String(err) });
        }
    }

    return [];
}

const AvailableReservablesLLMSchema = z.object({
    startTime: z.string().optional()
        .describe('Inicio del rango de búsqueda en ISO 8601 UTC (ej: "2025-06-10T14:00:00.000Z"). Convierte desde hora local antes de enviar.'),
    endTime: z.string().optional()
        .describe('Fin del rango de búsqueda en ISO 8601 UTC (ej: "2025-06-10T18:00:00.000Z"). Convierte desde hora local antes de enviar.'),
    floorId: z.number().int().optional()
        .describe('ID numérico del piso para filtrar. Omitir si no se especificó piso o no conoces el floorId.'),
    minCapacity: z.number().int().optional()
        .describe('Capacidad mínima requerida. Úsalo cuando el usuario pida un espacio para N personas.'),
    maxCapacity: z.number().int().optional()
        .describe('Capacidad máxima. Úsalo para cubículos individuales (maxCapacity=1) o pequeños grupos.'),
    query: z.string().optional()
        .describe(
            'Texto libre para buscar por CODE o NAME exacto del espacio (ej: "MZ001", "ICSJ-3040"). ' +
            'OMITIR si el usuario busca por tipo genérico ("sala", "cubículo") — en ese caso usa minCapacity/maxCapacity.',
        ),
});

toolRegistry.register({
    name: 'getAvailableReservables',
    label: 'Buscando espacios disponibles',
    description:
        'Busca espacios de oficina disponibles en un rango horario. ' +
        'IMPORTANTE: los tiempos deben estar en UTC (convierte la hora local del usuario sumando 6h). ' +
        'El campo "query" busca por CODE o NAME del espacio — no usarlo para búsquedas genéricas por tipo. ' +
        'Aplica fallback automático relajando filtros hasta encontrar opciones. ' +
        'Tras obtener resultados: si count>1 DEBES llamar showSpaceCarousel con todos los espacios (máx 20). ' +
        'La respuesta incluye campos: id (surrogate PK para reservar), code (identificador legible), floor (nombre del piso), capacity, status.',
    target: 'SERVER',
    schema: AvailableReservablesLLMSchema,
    handler: async (args, _ctx, services, trace) => {
        const baseQuery: AvailableReservablesQuery = {
            ...args,
            startTime: args.startTime ? new Date(args.startTime) : undefined,
            endTime: args.endTime ? new Date(args.endTime) : undefined,
        };

        const results = await searchWithFallback(baseQuery, services.officeSlots, trace);

        // Sort by code
        results.sort((a: any, b: any) => a.code.localeCompare(b.code, 'es', { numeric: true }));

        // Cap at 20 for carousel display; surface the full count so the prompt can mention it
        const capped = results.slice(0, 20);
        const truncated = results.length > 20;

        return {
            count: results.length,
            displayed: capped.length,
            truncated,
            truncated_note: truncated
                ? `Solo se muestran los primeros 20 de ${results.length}. Sugiere al usuario filtrar por piso o capacidad para reducir resultados.`
                : undefined,
            spaces: capped,
            search_strategy: trace.length > 1
                ? `Fallback aplicado: ${trace.length} intentos realizados`
                : 'Resultado directo',
            next_action_hint:
                capped.length === 1
                    ? 'Un solo espacio encontrado — puedes presentarlo directamente y preguntar si desea reservarlo.'
                    : capped.length > 1
                    ? 'Múltiples espacios — llama showSpaceCarousel con el array "spaces" completo. NO listes los espacios como texto.'
                    : 'Sin resultados — informa al usuario e inicia un nuevo intento con menos filtros o getAllReservables.',
        };
    },
});

toolRegistry.register({
    name: 'getAllReservables',
    label: 'Consultando todos los espacios',
    description:
        'Devuelve todos los espacios de oficina (id, code, name, capacity, floor, status, is_blocked). ' +
        'Úsalo como último recurso para diagnóstico cuando los filtros de disponibilidad no encuentran nada. ' +
        'Cada espacio tiene un "id" numérico (surrogate PK, para reservar) y un "code" legible (para mostrar).',
    target: 'SERVER',
    schema: z.object({}),
    handler: async (_args, _ctx, services, _trace) => {
        const all = await services.officeSlots.getAllReservables();
        return all.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    },
});

const CreateReservationBatchLLMSchema = z.object({
    reservable_id: z.number().int().positive()
        .describe(
            'ID NUMÉRICO (surrogate PK) del espacio. ' +
            'DEBE obtenerse del campo "id" devuelto por getAvailableReservables o getAllReservables. ' +
            'NUNCA uses el code ("MZ001") como id. NUNCA inventes este valor.',
        ),
    category: z.enum(['RESERVATION', 'MEETING']).default('RESERVATION')
        .describe('RESERVATION para uso individual o de trabajo. MEETING para reuniones de equipo.'),
    description: z.string().max(255).default('')
        .describe('Descripción breve de la reservación (opcional).'),
    timestamps: z.array(
        z.object({
            start_time: z.string()
                .describe('ISO 8601 UTC. Ejemplo: "2025-06-10T14:00:00.000Z" (8am hora local = UTC+6h).'),
            end_time: z.string()
                .describe('ISO 8601 UTC. Debe ser posterior a start_time.'),
        }),
    ).min(1).describe('Array con al menos un objeto {start_time, end_time} en UTC.'),
    participants: z.array(z.string()).default([])
        .describe('eIds de los participantes. Incluye el eId del usuario actual si participa.'),
});

toolRegistry.register({
    name: 'createReservationBatch',
    label: 'Realizando reservación',
    description:
        'Crea una o varias reservaciones de espacio de oficina. ' +
        'CRÍTICO: reservable_id es el campo "id" numérico (surrogate PK) del espacio — NO el code. ' +
        'Los timestamps deben estar en UTC ISO 8601 (suma 6h a la hora local). ' +
        'participants incluye los eIds de todos los asistentes, incluyendo al usuario actual si va a asistir.',
    target: 'SERVER',
    schema: CreateReservationBatchLLMSchema,
    handler: async (args, ctx, services, _trace) => {
        const coerced = {
            ...args,
            timestamps: args.timestamps.map((t: { start_time: string; end_time: string }) => ({
                start_time: new Date(t.start_time),
                end_time: new Date(t.end_time),
            })),
        };
        const validated = CreateReservationBatchSchema.parse(coerced);
        return services.officeSlots.createReservationBatch(validated, ctx.user);
    },
});

toolRegistry.register({
    name: 'getMyReservations',
    label: 'Consultando tu calendario de oficina',
    description:
        'Devuelve las reservaciones activas y futuras del usuario autenticado para espacios de oficina. ' +
        'Cada reserva incluye: id de reservación (para cancelar), reservable con code y floor, horarios en UTC, y participants con user_id. ' +
        'Al presentar al usuario: convierte los horarios UTC a hora local (UTC-6) y muestra nombres reales en lugar de eIds usando users_directory.',
    target: 'SERVER',
    schema: z.object({}),
    handler: async (_args, ctx, services, _trace) => {
        return services.officeSlots.getMyReservations(ctx.user, 'all');
    },
});

toolRegistry.register({
    name: 'getUserReservationsView',
    label: 'Consultando reservas del usuario',
    description:
        'Devuelve las reservaciones de oficina de un usuario específico. ' +
        'Si no son amigos, los participantes aparecen enmascarados. ' +
        'Usa searchUsers primero para obtener el targetUserId (eId).',
    target: 'SERVER',
    schema: z.object({
        targetUserId: z.string().min(1).describe('eId del usuario cuyas reservas quieres consultar'),
    }),
    handler: async (args, ctx, services, _trace) => {
        return services.officeSlots.getUserReservationsView(args.targetUserId, ctx.user);
    },
});

toolRegistry.register({
    name: 'cancelOfficeReservation',
    label: 'Cancelando reservación de oficina',
    description:
        'Cancela una reservación de espacio de oficina por su ID numérico de reservación. ' +
        'El "id de reservación" es distinto al "id del espacio" — usa getMyReservations para obtener el ID correcto. ' +
        'Solo se pueden cancelar reservaciones propias o de espacios que administras.',
    target: 'SERVER',
    schema: z.object({
        id: z.number().int().positive()
            .describe('ID numérico de la RESERVACIÓN a cancelar (campo "id" de getMyReservations, no el id del espacio)'),
    }),
    handler: async (args, ctx, services, _trace) => {
        return services.officeSlots.cancelReservation(args.id, ctx.user);
    },
});
