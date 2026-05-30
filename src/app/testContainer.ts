import { Request, Response, NextFunction } from 'express';
import { createApp } from './app.js';
import { createDb } from '../infra/db/db.js';
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from '../modules/auth/index.js';
import { makeUserRepo, makeUserService, makeUserStatusService, makeUserController, makeUserRouter } from '../modules/user/index.js';
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from '../modules/role/index.js';
import { makeFriendshipRepo, makeFriendshipService, makeFriendshipController, makeFriendshipRouter } from '../modules/friendship/index.js';
import { makeAchievementsRepo, makeAchievementsService, makeAchievementsController, makeAchievementsRouter } from '../modules/achievements/index.js';
import { makeOfficeSlotsRepo, makeOfficeSlotsService, makeOfficeSlotsController, makeOfficeSlotsRouter, makeReservablesRouter, makeReservationsRouter, makeEventsRouter, makeWorkGroupsRouter } from "../modules/office-slots/index.js";
import { makeNotificationsRouter, makeNotificationsController, makeNotificationsService, makeNotificationsRepo } from "../modules/notifications/index.js";
import { makeParkingSlotsRepo, makeParkingSlotsService, makeParkingSlotsController, makeParkingSlotsRouter } from "../modules/parking-slots/index.js";
import { makeReportsRepo, makeReportsService, makeReportsController, makeReportsRouter } from "../modules/reports/index.js";

import { parkingQueue } from "../infra/queue/parking-queue.js";
import { parkingEvents } from "../infra/events/parking-events.emitter.js";
import { initParkingBroadcaster } from "../infra/events/parking-events.broadcaster.js";
import { createParkingWorker } from "../infra/queue/parking-worker.js";

/**
 * Fake authenticate middleware — only for tests
 * 
 * Usage in test requests:
 *    request(app).get('/protected').set('x-test-user', JSON.stringify({ eId: 'USR00001', role: 'ADMIN' }))
 * 
 * Reads x-test-user header and injects it into req.user directly.
 */
export const fakeAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  const raw = req.headers['x-test-user'];

  if (!raw || typeof raw !== 'string') {
    res.status(401).json({ success: false, message: 'No autorizado' });
    return;
  }

  try {
    req.user = JSON.parse(raw);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'No autorizado' });
  }
};

export type TestContainerOptions = {
  useRealAuth?: boolean;
};

export function buildTestContainer(options: TestContainerOptions = {}) {
  const { useRealAuth = true } = options;

  const db = createDb();

  const authRepo = makeAuthRepo(db);
  const authService = makeAuthService(authRepo);
  const authController = makeAuthController(authService);
  const authRouter = makeAuthRouter(authController);

  const roleRepo = makeRoleRepo(db);
  const roleService = makeRoleService(roleRepo);
  const roleController = makeRoleController(roleService);
  const roleRouter = makeRoleRouter(roleController);

  const userRepo = makeUserRepo(db);

  const friendshipRepo = makeFriendshipRepo(db);
  const friendshipService = makeFriendshipService(friendshipRepo);

  const achievementsRepo = makeAchievementsRepo(db);
  const achievementsService = makeAchievementsService(achievementsRepo, userRepo);
  const achievementsController = makeAchievementsController(achievementsService);
  const achievementsRouter = makeAchievementsRouter(achievementsController);

  const userStatusService = makeUserStatusService();
  const userService = makeUserService(userRepo, roleRepo, friendshipService, achievementsService, userStatusService);
  const userController = makeUserController(userService);
  const userRouter = makeUserRouter(userController);

  const notificationRepo = makeNotificationsRepo(db);
  const notificationService = makeNotificationsService(notificationRepo);
  const notificationController = makeNotificationsController(notificationService);
  const notificationRouter = makeNotificationsRouter(notificationController);

  const friendshipController = makeFriendshipController(friendshipService);
  const friendshipRouter = makeFriendshipRouter(friendshipController);

  const officeSlotsRepo = makeOfficeSlotsRepo(db);
  const officeSlotsService = makeOfficeSlotsService(officeSlotsRepo, friendshipService, userService);
  const officeSlotsController = makeOfficeSlotsController(officeSlotsService);
  const officeSlotsRouter = makeOfficeSlotsRouter(officeSlotsController);
  const reservablesRouter = makeReservablesRouter(officeSlotsController);
  const reservationsRouter = makeReservationsRouter(officeSlotsController);
  const eventsRouter = makeEventsRouter(officeSlotsController);
  const workGroupsRouter = makeWorkGroupsRouter(officeSlotsController);

  const parkingSlotsRepo = makeParkingSlotsRepo(db);
  const parkingSlotsService = makeParkingSlotsService({
    repo: parkingSlotsRepo,
    friendshipService: friendshipService,
    queue: parkingQueue,
    emitter: parkingEvents,
  });
  const parkingSlotsController = makeParkingSlotsController(parkingSlotsService);
  const parkingSlotsRouter = makeParkingSlotsRouter(parkingSlotsController);

  // Broadcaster: escucha eventos del emitter y los manda por WebSocket
  initParkingBroadcaster();

  // Worker BullMQ: procesa los delayed jobs de no-show
  const parkingWorker = createParkingWorker({
    markNoShowForReservation: (id) => parkingSlotsRepo.markNoShowForReservation(id),
  });

  const reportsRepo = makeReportsRepo(db);
  const reportsSlotsService = makeReportsService(reportsRepo);
  const reportsController = makeReportsController(reportsSlotsService);
  const reportsRouter = makeReportsRouter(reportsController);

  return {
    db,
    authRouter,
    roleRouter,
    userRouter,
    notificationRouter,
    friendshipRouter,
    achievementsRouter,
    officeSlotsRouter,
    reservablesRouter,
    reservationsRouter,
    eventsRouter,
    workGroupsRouter,
    parkingSlotsRouter,
    parkingSlotsRepo,
    parkingWorker,
    reportsRouter,
    userStatusService,
    fakeAuthenticate,
  };
}

export function createTestApp(options: TestContainerOptions = {}) {
  const container = buildTestContainer(options);
  return { app: createApp(container), db: container.db };
}
