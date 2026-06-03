import 'dotenv/config';

import http from 'http';
import { createApp } from './app/app.js';
import { env } from './config/env.js';
import { buildContainer } from './app/container.js';
import { initSocket } from './infra/websocket/socket.server.js';
import { reviveOfficeJobs, reviveParkingJobs } from './infra/queue/index.js';
import { validateAchievementsListenerRules } from './modules/achievements/index.js';

const container = buildContainer();
await validateAchievementsListenerRules(container.achievementsService);
const app = createApp(container);
const server = http.createServer(app);
const PORT = env.server.port;

initSocket(server, {
    userStatusService: container.userStatusService,
    userService: container.userService,
    teamsService: container.teamsService,
});

server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);

    // Revival de delayed jobs de no-show perdidos durante downtime
    try {
        await reviveParkingJobs(container.parkingSlotsRepo);
        await reviveOfficeJobs(container.officeSlotsRepo);
    } catch (err) {
        console.error("[revival] Error al re-encolar jobs de no-show:", err);
    }
});
