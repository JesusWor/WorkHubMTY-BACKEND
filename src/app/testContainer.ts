import { Request, Response, NextFunction } from 'express';
import { createApp } from './app';
import { createDb } from '../infra/db/db';
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from '../modules/auth';
import { makeUserRepo, makeUserService, makeUserController, makeUserRouter } from '../modules/user';
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from '../modules/role';
import { makeFriendshipRepo, makeFriendshipService, makeFriendshipController, makeFriendshipRouter } from '../modules/friendship';
import { makeNotificationRouter, makeNotificationController, makeNotificationService } from '../modules/notifications';
import { makeOfficeSlotsRepo, makeOfficeSlotsService, makeOfficeSlotsController, makeOfficeSlotsRouter } from "../modules/office-slots";
import { makeParkingSlotsRepo, makeParkingSlotsService, makeParkingSlotsController, makeParkingSlotsRouter } from "../modules/parking-slots";

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
  const userService = makeUserService(userRepo, roleRepo);
  const userController = makeUserController(userService);
  const userRouter = makeUserRouter(userController);

  const notificationService = makeNotificationService();
  const notificationController = makeNotificationController(notificationService);
  const notificationRouter = makeNotificationRouter(notificationController);

  const friendshipRepo = makeFriendshipRepo(db);
  const friendshipService = makeFriendshipService(friendshipRepo);
  const friendshipController = makeFriendshipController(friendshipService);
  const friendshipRouter = makeFriendshipRouter(friendshipController);

  const officeSlotsRepo = makeOfficeSlotsRepo(db);
  const officeSlotsService = makeOfficeSlotsService(officeSlotsRepo);
  const officeSlotsController = makeOfficeSlotsController(officeSlotsService);
  const officeSlotsRouter = makeOfficeSlotsRouter(officeSlotsController);

  const parkingSlotsRepo = makeParkingSlotsRepo(db);
  const parkingSlotsService = makeParkingSlotsService(parkingSlotsRepo);
  const parkingSlotsController = makeParkingSlotsController(parkingSlotsService);
  const parkingSlotsRouter = makeParkingSlotsRouter(parkingSlotsController);

  return {
    db,
    authRouter,
    roleRouter,
    userRouter,
    notificationRouter,
    friendshipRouter,
    officeSlotsRouter,
    parkingSlotsRouter,
    fakeAuthenticate,
  };
}

export function createTestApp(options: TestContainerOptions = {}) {
  const container = buildTestContainer(options);
  return { app: createApp(container), db: container.db };
}
