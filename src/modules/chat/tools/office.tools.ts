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
        // 2. Drop text query filter (keep time + capacity)
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
        .describe('Inicio del rango de búsqueda en ISO 8601 (ej: "2025-06-10T15:00:00.000Z")'),
    endTime: z.string().optional()
        .describe('Fin del rango de búsqueda en ISO 8601'),
    floorId: z.number().int().optional()
        .describe('ID del piso para filtrar. Omitir si no se especificó piso.'),
    minCapacity: z.number().int().optional()
        .describe('Capacidad mínima requerida.'),
    maxCapacity: z.number().int().optional()
        .describe('Capacidad máxima.'),
    query: z.string().optional()
        .describe('Texto libre para buscar por nombre de espacio. Omitir si la búsqueda es genérica.'),
});

toolRegistry.register({
    name: 'getAvailableReservables',
    label: 'Buscando espacios disponibles',
    description:
        'Busca espacios de oficina disponibles en un rango horario. ' +
        'Aplica fallback automático: si los filtros son muy restrictivos y devuelven 0 resultados, ' +
        'relaja automáticamente los filtros hasta encontrar opciones. ' +
        'Siempre devuelve resultados salvo que no haya espacios en absoluto. ' +
        'Después de obtener resultados, llama showSpaceCarousel si hay múltiples opciones.',
    target: 'SERVER',
    schema: AvailableReservablesLLMSchema,
    handler: async (args, _ctx, services, trace) => {
        // Coerce string dates
        const baseQuery: AvailableReservablesQuery = {
            ...args,
            startTime: args.startTime ? new Date(args.startTime) : undefined,
            endTime: args.endTime ? new Date(args.endTime) : undefined,
        };

        const results = await searchWithFallback(baseQuery, services.officeSlots, trace);

        // Sort by name (code)
        results.sort((a: any, b: any) => a.code.localeCompare(b.code, 'es', { numeric: true }));

        return {
            count: results.length,
            spaces: results,
            search_strategy: trace.length > 1
                ? `Fallback aplicado: ${trace.length} intentos realizados`
                : 'Resultado directo',
        };
    },
});

toolRegistry.register({
    name: 'getAllReservables',
    label: 'Consultando todos los espacios',
    description:
        'Devuelve todos los espacios de oficina (id, nombre, capacidad, piso, status). ' +
        'Úsalo como último recurso para mostrar la lista completa cuando los filtros de disponibilidad no encuentran nada.',
    target: 'SERVER',
    schema: z.object({}),
    handler: async (_args, _ctx, services, _trace) => {
        const all = await services.officeSlots.getAllReservables();
        return all.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    },
});

const CreateReservationBatchLLMSchema = z.object({
    reservable_id: z.number().int().positive()
        .describe('ID numérico del espacio. DEBE obtenerse de getAvailableReservables o getAllReservables, nunca inventarlo.'),
    category: z.enum(['RESERVATION', 'MEETING']).default('RESERVATION')
        .describe('RESERVATION para uso individual o de trabajo, MEETING para reuniones de equipo.'),
    description: z.string().max(255).default('')
        .describe('Descripción breve de la reservación (opcional).'),
    timestamps: z.array(
        z.object({
            start_time: z.string()
                .describe('ISO 8601, ej: "2025-06-10T15:00:00.000Z"'),
            end_time: z.string()
                .describe('ISO 8601, ej: "2025-06-10T17:00:00.000Z". Debe ser posterior a start_time.'),
        }),
    ).min(1).describe('Array con al menos un objeto {start_time, end_time}.'),
    participants: z.array(z.string()).default([])
        .describe('eIds de los participantes. Incluye el eId del usuario actual si participa en la reserva.'),
});

toolRegistry.register({
    name: 'createReservationBatch',
    label: 'Realizando reservación',
    description:
        'Crea una o varias reservaciones de espacio de oficina. ' +
        'IMPORTANTE: reservable_id DEBE provenir de una búsqueda previa (getAvailableReservables o getAllReservables). ' +
        'participants incluye los eIds de todos los participantes, incluyendo al usuario actual si va a asistir. ' +
        'El dueño de la reserva (caller) es siempre el usuario autenticado.',
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
        'Incluye id de reservación (necesario para cancelar), espacio, horarios y participantes.',
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
        'Usa searchUsers primero para obtener el targetUserId.',
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
        'Cancela una reservación de espacio de oficina por su ID numérico. ' +
        'Usa getMyReservations primero para obtener el ID correcto. ' +
        'Solo se pueden cancelar reservaciones propias o de espacios que administras.',
    target: 'SERVER',
    schema: z.object({
        id: z.number().int().positive()
            .describe('ID numérico de la reservación a cancelar (obtenido de getMyReservations)'),
    }),
    handler: async (args, ctx, services, _trace) => {
        return services.officeSlots.cancelReservation(args.id, ctx.user);
    },
});
