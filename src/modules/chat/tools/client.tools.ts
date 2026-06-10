import { z } from 'zod';
import { toolRegistry } from '../chat.tool-registry.js';

toolRegistry.register({
    name: 'showSpaceCarousel',
    label: 'Mostrando espacios disponibles',
    description:
        'Muestra un carrusel interactivo de espacios de oficina disponibles para que el usuario elija. ' +
        'CUÁNDO llamar: SIEMPRE que getAvailableReservables devuelva 2 o más espacios. ' +
        'CÓMO llamar: pasa el array "spaces" completo recibido de getAvailableReservables (máx 20 elementos). ' +
        'El campo "id" de cada espacio es el surrogate PK numérico — el frontend lo devuelve como "selected_id" al elegir. ' +
        'El campo "name" debe ser el CODE del espacio (ej: "MZ001"), no el id numérico. ' +
        'NO generes una lista de texto como sustituto de este widget — siempre llama esta herramienta.',
    target: 'CLIENT',
    schema: z.object({
        spaces: z.array(
            z.object({
                id: z.number().int()
                    .describe('Surrogate PK numérico del espacio — se devuelve como selected_id al usuario elegir.'),
                name: z.string()
                    .describe('Code del espacio (ej: "MZ001", "ICSJ-3040") — es el identificador legible para el usuario.'),
                capacity: z.number().int()
                    .describe('Capacidad del espacio.'),
                floor: z.string()
                    .describe('Nombre del piso (ej: "Piso 2").'),
                status: z.string()
                    .describe('Estado: "available", "occupied", "soon" o "blocked".'),
            }),
        ).min(1).max(20).describe('Lista de espacios a mostrar en el carrusel (máximo 20).'),
        context: z.string()
            .describe('Descripción del contexto de búsqueda que ve el usuario, ej: "Hoy de 8am a 12pm · 159 disponibles".'),
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
