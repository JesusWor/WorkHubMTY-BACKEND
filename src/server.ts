import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from './app/app.js';
import { env } from './config/env.js';
import { buildContainer } from './app/container.js';
import { initSocket } from './infra/websocket/socket.server.js';

const container = buildContainer();
const app = createApp(container);
const server = http.createServer(app);
const PORT = env.server.port;

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
