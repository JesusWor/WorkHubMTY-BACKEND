// Side-effect: register all tools and resources on import
import './tools/office.tools.js';
import './tools/parking.tools.js';
import './tools/user.tools.js';
import './tools/client.tools.js';
import './resources/index.js';

export { makeChatController } from './chat.controller.js';
export { makeChatRouter } from './chat.router.js';
export type { ChatServices } from './chat.types.js';
