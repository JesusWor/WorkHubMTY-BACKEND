import { resourceRegistry } from '../chat.resource-registry.js';
import { ChatContext, ChatServices } from '../chat.types.js';

resourceRegistry.register({
    name: 'floors',
    description:
        'Lista de pisos del edificio con su id (para filtrar espacios), nombre y número de piso. ' +
        'Úsalo para traducir "Piso 2" o "tercer piso" al floorId correcto antes de llamar getAvailableReservables.',
    async load(_ctx: ChatContext, services: ChatServices) {
        const all = await services.officeSlots.getAllReservables();
        const seen = new Map<string, { floor_name: string; floor_id: number; example_space_code: string }>();
        for (const r of all) {
            if (!seen.has(r.floor)) {
                seen.set(r.floor, { floor_name: r.floor, floor_id: r.floor_id, example_space_code: r.code });
            }
        }
        return {
            note: 'Para filtrar por piso en getAvailableReservables necesitas el floorId numérico. ' +
                  'Si el usuario menciona un piso por nombre, usa el nombre exacto de esta lista para identificarlo. ' +
                  'El floorId se obtiene a partir del contexto de los espacios devueltos (campo floor).',
            floors: [...seen.values()],
        };
    },
});
