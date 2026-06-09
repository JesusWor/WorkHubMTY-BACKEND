import { z } from 'zod';
import { toolRegistry } from '../chat.tool-registry.js';

toolRegistry.register({
    name: 'getParkingAvailability',
    label: 'Consultando disponibilidad de estacionamiento',
    description:
        'Consulta la disponibilidad del estacionamiento en un rango de tiempo. ' +
        'Devuelve la capacidad total del estacionamiento y el número de reservas activas en cada franja horaria. ' +
        'Úsalo antes de crear una reserva para verificar si hay cajones disponibles.',
    target: 'SERVER',
    schema: z.object({
        start_time: z.string()
            .describe('Inicio del periodo a consultar en ISO 8601 (ej: "2025-06-10T08:00:00.000Z")'),
        end_time: z.string()
            .describe('Fin del periodo a consultar en ISO 8601 (ej: "2025-06-10T18:00:00.000Z")'),
        step_minutes: z.enum(['15', '30', '60']).default('30')
            .describe('Granularidad de las franjas: 15, 30 o 60 minutos.'),
    }),
    handler: async (args, _ctx, services, trace) => {
        const query = {
            start_time: new Date(args.start_time),
            end_time: new Date(args.end_time),
            step_minutes: args.step_minutes as '15' | '30' | '60',
        };

        trace.push({ attempt: 1, args: args as any });
        const result = await services.parkingSlots.getBuckets(query);

        const available = result.buckets.filter(
            (b) => b.reservation_count < result.capacity,
        ).length;
        const fullyBooked = result.buckets.filter(
            (b) => b.reservation_count >= result.capacity,
        ).length;

        return {
            capacity: result.capacity,
            total_slots: result.capacity,
            available_windows: available,
            fully_booked_windows: fullyBooked,
            buckets: result.buckets.map((b) => ({
                time: b.timestamp,
                reservations: b.reservation_count,
                available: Math.max(0, result.capacity - b.reservation_count),
            })),
        };
    },
});

toolRegistry.register({
    name: 'getMyParkingReservations',
    label: 'Consultando tus reservaciones de estacionamiento',
    description:
        'Devuelve las reservaciones de estacionamiento activas y futuras del usuario autenticado. ' +
        'Incluye el ID de reservación (necesario para cancelar), horarios y cajón asignado si aplica.',
    target: 'SERVER',
    schema: z.object({}),
    handler: async (_args, ctx, services, trace) => {
        trace.push({ attempt: 1, args: {} });
        const reservations = await services.parkingSlots.getUserReservations(ctx.user.eId);
        // Filter to only active/future ones
        const now = new Date();
        return reservations.filter((r) => {
            const endTime = new Date(r.reservation.end_time);
            const status = r.reservation.attendance_status;
            return endTime > now && status !== 'CANCELED' && status !== 'CHECKED_OUT' && status !== 'NO_SHOW';
        });
    },
});

toolRegistry.register({
    name: 'createParkingReservation',
    label: 'Reservando cajón de estacionamiento',
    description:
        'Crea una reservación de cajón de estacionamiento para el usuario autenticado. ' +
        'SIEMPRE consulta getParkingAvailability primero para verificar que haya cajones disponibles. ' +
        'El sistema asigna el cajón automáticamente (FIFO). ' +
        'Si el usuario ya tiene una reserva activa en ese horario, la operación fallará.',
    target: 'SERVER',
    schema: z.object({
        start_time: z.string()
            .describe('Inicio de la reserva en ISO 8601 (ej: "2025-06-10T08:00:00.000Z")'),
        end_time: z.string()
            .describe('Fin de la reserva en ISO 8601. Debe ser posterior a start_time.'),
    }),
    handler: async (args, ctx, services, trace) => {
        trace.push({ attempt: 1, args: args as any });
        const data = {
            start_time: new Date(args.start_time),
            end_time: new Date(args.end_time),
        };

        if (data.end_time <= data.start_time) {
            throw new Error('end_time debe ser posterior a start_time');
        }

        return services.parkingSlots.createReservation(ctx.user, data);
    },
});

toolRegistry.register({
    name: 'cancelParkingReservation',
    label: 'Cancelando reservación de estacionamiento',
    description:
        'Cancela una reservación de estacionamiento por su ID numérico. ' +
        'Usa getMyParkingReservations primero para obtener el ID correcto. ' +
        'Solo se pueden cancelar reservaciones propias.',
    target: 'SERVER',
    schema: z.object({
        id: z.number().int().positive()
            .describe('ID numérico de la reservación de estacionamiento a cancelar'),
    }),
    handler: async (args, ctx, services, trace) => {
        trace.push({ attempt: 1, args: args as any });
        return services.parkingSlots.cancelReservation(args.id, ctx.user);
    },
});
