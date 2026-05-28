import 'dotenv/config';

import http from 'http';
import { createApp } from './app/app.js';
import { env } from './config/env.js';
import { buildContainer } from './app/container.js';
import { initSocket } from './infra/websocket/socket.server.js';
import { reviveNoShowJobs } from './infra/queue/parking-revival.js';

const container = buildContainer();
const app = createApp(container);
const server = http.createServer(app);
const PORT = env.server.port;

initSocket(server, container.userStatusService);

server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);

    // Revival de delayed jobs de no-show perdidos durante downtime
    try {
        await reviveNoShowJobs(container.parkingSlotsRepo);
    } catch (err) {
        console.error("[revival] Error al re-encolar jobs de no-show:", err);
    }
});
