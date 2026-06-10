import { resourceRegistry } from '../chat.resource-registry.js';
import { ChatContext, ChatServices } from '../chat.types.js';

// Keep the existing available_locations resource
resourceRegistry.register({
    name: 'available_locations',
    description: 'Todos los espacios de oficina con id, código (ej: MZ001), nombre, capacidad y piso.',
    async load(_ctx: ChatContext, services: ChatServices) {
        return services.officeSlots.getAllReservables();
    },
});
