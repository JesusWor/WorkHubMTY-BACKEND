import 'dotenv/config';

import http from 'http';
import { createApp } from './app/app';
import { env } from './config/env';
import { buildContainer } from './app/container';
import { initSocket } from './infra/websocket/socket.server';

const container = buildContainer();
const app = createApp(container);
const server = http.createServer(app);
const PORT = env.server.port;

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
