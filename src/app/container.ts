import { createDb } from "../infra/db/db.js";
import { makeNotificationsRouter, makeNotificationsController, makeNotificationsService, makeNotificationsRepo } from "../modules/notifications/index.js";
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from "../modules/role/index.js";
import { makeUserRepo, makeUserService, makeUserStatusService, makeUserController, makeUserRouter } from "../modules/user/index.js";
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from "../modules/auth/index.js";
import { makeFriendshipRepo, makeFriendshipService, makeFriendshipController, makeFriendshipRouter } from "../modules/friendship/index.js";
import { makeAchievementsRepo, makeAchievementsService, makeAchievementsController, makeAchievementsRouter } from "../modules/achievements/index.js";
import { makeOfficeSlotsRepo, makeOfficeSlotsService, makeOfficeSlotsController, makeOfficeSlotsRouter, makeReservablesRouter, makeReservationsRouter, makeEventsRouter, makeWorkGroupsRouter } from "../modules/office-slots/index.js";
import { makeParkingSlotsRepo, makeParkingSlotsService, makeParkingSlotsController, makeParkingSlotsRouter } from "../modules/parking-slots/index.js";
import { makeReportsRepo, makeReportsService, makeReportsController, makeReportsRouter } from "../modules/reports/index.js";
import { parkingQueue } from "../infra/queue/parking-queue.js";
import { parkingEvents } from "../infra/events/parking-events.emitter.js";
import { initParkingBroadcaster } from "../infra/events/parking-events.broadcaster.js";
import { createParkingWorker } from "../infra/queue/parking-worker.js";

export function buildContainer() {
    const db = createDb();
    db.testConnection();

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
    const achievementsService = makeAchievementsService(achievementsRepo,userRepo);
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

    const authRepo = makeAuthRepo(db);
    const authService = makeAuthService(authRepo);
    const authController = makeAuthController(authService);
    const authRouter = makeAuthRouter(authController);

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
        roleRouter,
        userRouter,
        userStatusService,
        notificationRouter,
        authRouter,
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
        reportsRouter
    };
};
