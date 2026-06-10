import { Request, Response, NextFunction } from 'express';
import { createApp } from './app.js';
import { createDb } from '../infra/db/db.js';
import {
  makeNotificationsRouter,
  makeNotificationsController,
  makeNotificationsService,
  makeNotificationsRepo,
} from '../modules/notifications/index.js';
import {
  makeRoleRepo,
  makeRoleService,
  makeRoleController,
  makeRoleRouter,
} from '../modules/role/index.js';
import {
  makeUserRepo,
  makeUserService,
  makeUserStatusService,
  makeUserController,
  makeUserRouter,
  makeUserStatsRepo,
  makeUserStatsService,
} from '../modules/user/index.js';
import { makeUserTimelineService, makeUserTimelineController } from '../modules/user/index.js';
import {
  makeAuthRepo,
  makeAuthService,
  makeAuthController,
  makeAuthRouter,
} from '../modules/auth/index.js';
import {
  makeTeamsRepo,
  makeTeamsService,
  makeTeamsController,
  makeTeamsRouter,
} from '../modules/teams/index.js';
import {
  makeFriendshipRepo,
  makeFriendshipService,
  makeFriendshipController,
  makeFriendshipRouter,
} from '../modules/friendship/index.js';
import {
  makeAchievementsRepo,
  makeAchievementsService,
  makeAchievementsController,
  makeAchievementsRouter,
  initAchievementsListeners,
} from '../modules/achievements/index.js';
import {
  makeOfficeSlotsRepo,
  makeOfficeSlotsService,
  makeOfficeSlotsController,
  makeOfficeSlotsRouter,
} from '../modules/office-slots/index.js';
import {
  makeParkingSlotsRepo,
  makeParkingSlotsService,
  makeParkingSlotsController,
  makeParkingSlotsRouter,
} from '../modules/parking-slots/index.js';

import {
  makeEventsRepo,
  makeEventsService,
  makeEventsController,
  makeEventsRouter,
} from '../modules/guest-events/index.js';
import {
  makeReportsRepo,
  makeReportsService,
  makeReportsController,
  makeReportsRouter,
} from '../modules/reports/index.js';

import { officeEvents, parkingEvents, teamEvents, userEvents } from '../infra/events/index.js';
import {
  initOfficeBroadcaster,
  initParkingBroadcaster,
  initTeamBroadcaster,
  initUserBroadcaster,
} from '../infra/websocket/index.js';
import {
  createOfficeWorker,
  createParkingWorker,
  officeQueue,
  parkingQueue,
} from '../infra/queue/index.js';
import {
  makeChatController,
  makeChatRouter,
} from '../modules/chat/index.js';

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
  const db = createDb();

  const roleRepo = makeRoleRepo(db);
  const roleService = makeRoleService(roleRepo);
  const roleController = makeRoleController(roleService);
  const roleRouter = makeRoleRouter(roleController);

  const friendshipRepo = makeFriendshipRepo(db);
  const friendshipService = makeFriendshipService(friendshipRepo);
  const friendshipController = makeFriendshipController(friendshipService);
  const friendshipRouter = makeFriendshipRouter(friendshipController);

  const userRepo = makeUserRepo(db);

  const achievementsRepo = makeAchievementsRepo(db);
  const achievementsService = makeAchievementsService(
    achievementsRepo,
    userRepo,
  );
  const achievementsController =
    makeAchievementsController(achievementsService);
  const achievementsRouter =
    makeAchievementsRouter(achievementsController);

  initAchievementsListeners(achievementsService);

  const notificationRepo = makeNotificationsRepo(db);
  const notificationService =
    makeNotificationsService(notificationRepo);
  const notificationController =
    makeNotificationsController(notificationService);
  const notificationRouter =
    makeNotificationsRouter(notificationController);

  const authRepo = makeAuthRepo(db);
  const authService = makeAuthService(authRepo);
  const authController = makeAuthController(authService);
  const authRouter = makeAuthRouter(authController);

  const userStatusService = makeUserStatusService();

  const userStatsRepo = makeUserStatsRepo(db);
  const userStatsService =
    makeUserStatsService(userStatsRepo);

  const teamsRepo = makeTeamsRepo(db);
  const teamsService = makeTeamsService(
    teamsRepo,
    userStatusService,
  );
  const teamsController =
    makeTeamsController(teamsService);
  const teamsRouter =
    makeTeamsRouter(teamsController);

  const officeSlotsRepo = makeOfficeSlotsRepo(db);

  const officeSlotsService = makeOfficeSlotsService({
    repo: officeSlotsRepo,
    friendshipService,
    queue: officeQueue,
    emitter: officeEvents,
    teamsService,
  });

  const officeSlotsController =
    makeOfficeSlotsController(officeSlotsService);

  const officeSlotsRouter =
    makeOfficeSlotsRouter(officeSlotsController);

  const parkingSlotsRepo =
    makeParkingSlotsRepo(db);

  const parkingSlotsService =
    makeParkingSlotsService({
      repo: parkingSlotsRepo,
      friendshipService,
      queue: parkingQueue,
      emitter: parkingEvents,
    });

  const parkingSlotsController =
    makeParkingSlotsController(
      parkingSlotsService,
    );

  const parkingSlotsRouter =
    makeParkingSlotsRouter(
      parkingSlotsController,
    );

  initOfficeBroadcaster();
  initParkingBroadcaster();
  initTeamBroadcaster();
  initUserBroadcaster();

  const officeWorker =
    createOfficeWorker({
      markNoShowForReservation: (id) =>
        officeSlotsRepo.markNoShowForReservation(id),
      markCheckoutForReservation: (id) =>
        officeSlotsRepo.markCheckoutForReservation(id),
      getReservableById: (id) =>
        officeSlotsRepo.getReservableById(id),
    });

  const parkingWorker =
    createParkingWorker({
      markNoShowForReservation: (id) =>
        parkingSlotsRepo.markNoShowForReservation(id),
      markCheckoutForReservation: (id) =>
        parkingSlotsRepo.markCheckoutForReservation(id),
    });

  const reportsRepo = makeReportsRepo(db);
  const reportsService =
    makeReportsService(reportsRepo);
  const reportsController =
    makeReportsController(reportsService);
  const reportsRouter =
    makeReportsRouter(reportsController);

  const eventsRepo = makeEventsRepo(db);
  const eventsService =
    makeEventsService(eventsRepo, userRepo);
  const eventsController =
    makeEventsController(eventsService);
  const eventsRouter =
    makeEventsRouter(eventsController);

  userStatsService.initListeners();
  userStatsService.initScheduler();

  const userTimelineService =
    makeUserTimelineService({
      officeSlots: officeSlotsService,
      parkingSlots: parkingSlotsService,
      events: eventsService,
      friendship: friendshipService,
    });

  const userTimelineController =
    makeUserTimelineController(
      userTimelineService,
    );

  const userService = makeUserService(
    userRepo,
    roleRepo,
    friendshipService,
    achievementsService,
    userStatusService,
    userStatsService,
  );

  const userController =
    makeUserController(userService);

  const userRouter =
    makeUserRouter(
      userController,
      userTimelineController,
    );

  const chatController =
    makeChatController({
      officeSlots: officeSlotsService,
      parkingSlots: parkingSlotsService,
      user: userService,
    });

  const chatRouter = makeChatRouter(chatController);

  return {
    db,
    roleRouter,
    userRouter,
    userService,
    userStatusService,
    notificationRouter,
    authRouter,
    friendshipRouter,
    achievementsRouter,
    achievementsService,
    officeSlotsRouter,
    officeSlotsRepo,
    officeWorker,
    teamsRouter,
    teamsService,
    parkingSlotsRouter,
    parkingSlotsRepo,
    parkingWorker,
    reportsRouter,
    eventsRouter,
    chatRouter,
    fakeAuthenticate,
  };
}

export function createTestApp(options: TestContainerOptions = {}) {
  const container = buildTestContainer(options);
  return { app: createApp(container), db: container.db };
}
