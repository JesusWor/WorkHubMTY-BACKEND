import { z } from 'zod';
import { toolRegistry } from '../chat.tool-registry.js';

toolRegistry.register({
    name: 'showSpaceCarousel',
    label: 'Mostrando espacios disponibles',
    description:
        'Muestra un carrusel visual de espacios disponibles para que el usuario elija. ' +
        'Úsalo después de obtener resultados de getAvailableReservables cuando hay múltiples opciones. ' +
        'El frontend devuelve el id del espacio seleccionado (o null si cancela).',
    target: 'CLIENT',
    schema: z.object({
        spaces: z.array(
            z.object({
                id: z.number().int(),
                name: z.string(),
                capacity: z.number().int(),
                floor: z.string(),
                status: z.string(),
            }),
        ).min(1).describe('Lista de espacios disponibles'),
        context: z.string()
            .describe('Descripción del contexto (ej: "mañana de 3pm a 5pm")'),
    }),
});

toolRegistry.register({
    name: 'openParticipantPicker',
    label: 'Seleccionando participantes',
    description:
        'Abre un selector de participantes para que el usuario busque y elija personas. ' +
        'Úsalo cuando necesites saber quiénes participarán en una reservación y no tienes esa info. ' +
        'El frontend devuelve un array de eIds seleccionados.',
    target: 'CLIENT',
    schema: z.object({
        prompt: z.string()
            .describe('Mensaje que se mostrará al usuario en el picker (ej: "¿Quiénes participarán en la reunión?")'),
        preselected_eids: z.array(z.string()).default([])
            .describe('eIds preseleccionados (puede estar vacío)'),
    }),
});
