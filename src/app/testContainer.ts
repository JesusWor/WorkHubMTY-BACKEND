import { Request, Response, NextFunction } from 'express';
import { createApp } from './app.js';
import { createDb } from '../infra/db/db.js';
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from '../modules/auth/index.js';
import { makeUserRepo, makeUserService, makeUserController, makeUserRouter } from '../modules/user/index.js';
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from '../modules/role/index.js';
import { makeFriendshipRepo, makeFriendshipService, makeFriendshipController, makeFriendshipRouter } from '../modules/friendship/index.js';
import { makeAchievementsRepo, makeAchievementsService, makeAchievementsController, makeAchievementsRouter } from '../modules/achievements/index.js';
import { makeOfficeSlotsRepo, makeOfficeSlotsService, makeOfficeSlotsController, makeOfficeSlotsRouter, makeReservablesRouter, makeReservationsRouter, makeEventsRouter, makeWorkGroupsRouter } from "../modules/office-slots/index.js";
import { makeNotificationsRouter, makeNotificationsController, makeNotificationsService, makeNotificationsRepo } from "../modules/notifications/index.js";
import { makeParkingSlotsRepo, makeParkingSlotsService, makeParkingSlotsController, makeParkingSlotsRouter } from "../modules/parking-slots/index.js";
import { makeReportsRepo, makeReportsService, makeReportsController, makeReportsRouter } from "../modules/reports/index.js";

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
  const achievementsService = makeAchievementsService(achievementsRepo);
  const achievementsController = makeAchievementsController(achievementsService);
  const achievementsRouter = makeAchievementsRouter(achievementsController);

  const userService = makeUserService(userRepo, roleRepo, friendshipService, achievementsService);
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
  const parkingSlotsService = makeParkingSlotsService(parkingSlotsRepo);
  const parkingSlotsController = makeParkingSlotsController(parkingSlotsService);
  const parkingSlotsRouter = makeParkingSlotsRouter(parkingSlotsController);

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
    reportsRouter,
    fakeAuthenticate,
  };
}

export function createTestApp(options: TestContainerOptions = {}) {
  const container = buildTestContainer(options);
  return { app: createApp(container), db: container.db };
}
