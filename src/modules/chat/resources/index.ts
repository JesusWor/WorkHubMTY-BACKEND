import { resourceRegistry } from '../chat.resource-registry.js';

resourceRegistry.register({
    name: 'available_locations',
    description: 'Todos los espacios de oficina con id, nombre, capacidad y piso.',
    async load(_ctx, services) {
        return services.officeSlots.getAllReservables();
    },
});
