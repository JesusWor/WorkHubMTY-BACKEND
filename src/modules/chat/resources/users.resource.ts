import { resourceRegistry } from '../chat.resource-registry.js';
import { ChatContext, ChatServices } from '../chat.types.js';

resourceRegistry.register({
    name: 'users_directory',
    description:
        'Directorio de usuarios: mapeo de eId → nombre completo, email y rol. ' +
        'Usa este recurso para mostrar nombres en lugar de eIds al presentar reservaciones, ' +
        'y para resolver nombres parciales a eIds sin necesidad de llamar searchUsers para usuarios comunes.',
    async load(_ctx: ChatContext, services: ChatServices) {
        const users = await services.user.getAll();
        return users.map((u) => ({
            eId: u.eId,
            name: u.name,
            email: u.email,
            role: u.roleName,
        }));
    },
});
