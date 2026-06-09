import { z } from 'zod';
import { toolRegistry } from '../chat.tool-registry.js';

toolRegistry.register({
    name: 'searchUsers',
    label: 'Buscando usuarios',
    description:
        'Busca usuarios por nombre o nombre parcial. ' +
        'Devuelve eId, nombre, email y rol. ' +
        'SIEMPRE usa este tool para resolver un nombre de persona a su eId antes de crear una reservación.',
    target: 'SERVER',
    schema: z.object({
        query: z.string().min(1).describe('Nombre o parte del nombre a buscar'),
    }),
    handler: async (args, _ctx, services, trace) => {
        trace.push({ attempt: 1, args: args as any });
        const results = await services.user.getAllByName(args.query);
        return {
            count: results.length,
            users: results.map((u) => ({
                eId: u.eId,
                name: u.name,
                email: u.email,
                role: u.roleName,
            })),
        };
    },
});
