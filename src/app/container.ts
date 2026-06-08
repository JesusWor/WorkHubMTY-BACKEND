import { createDb } from "../infra/db/db.js";
import { makeNotificationsRouter, makeNotificationsController, makeNotificationsService, makeNotificationsRepo } from "../modules/notifications/index.js";
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from "../modules/role/index.js";
import {
    makeUserRepo,
    makeUserService,
    makeUserStatusService,
    makeUserController,
    makeUserRouter,
    makeUserStatsRepo,
    makeUserStatsService,
} from "../modules/user/index.js";
import { makeUserTimelineService, makeUserTimelineController } from "../modules/user/index.js";
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from "../modules/auth/index.js";
import { makeTeamsRepo, makeTeamsService, makeTeamsController, makeTeamsRouter } from "../modules/teams/index.js";
import { makeFriendshipRepo, makeFriendshipService, makeFriendshipController, makeFriendshipRouter } from "../modules/friendship/index.js";
import {
    makeAchievementsRepo,
    makeAchievementsService,
    makeAchievementsController,
    makeAchievementsRouter,
    initAchievementsListeners,
} from "../modules/achievements/index.js";
import { makeOfficeSlotsRepo, makeOfficeSlotsService, makeOfficeSlotsController, makeOfficeSlotsRouter } from "../modules/office-slots/index.js";
import { makeParkingSlotsRepo, makeParkingSlotsService, makeParkingSlotsController, makeParkingSlotsRouter } from "../modules/parking-slots/index.js";

import {
    makeEventsRepo,
    makeEventsService,
    makeEventsController,
    makeEventsRouter,
} from '../modules/guest-events/index.js';
import { makeReportsRepo, makeReportsService, makeReportsController, makeReportsRouter } from "../modules/reports/index.js";

import { officeEvents, parkingEvents, teamEvents, userEvents } from "../infra/events/index.js";
import { initOfficeBroadcaster, initParkingBroadcaster, initTeamBroadcaster, initUserBroadcaster } from "../infra/websocket/index.js";
import { createOfficeWorker, createParkingWorker, officeQueue, parkingQueue } from "../infra/queue/index.js";


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
    const achievementsService = makeAchievementsService(achievementsRepo, userRepo);
    const achievementsController = makeAchievementsController(achievementsService);
    const achievementsRouter = makeAchievementsRouter(achievementsController);
    initAchievementsListeners(achievementsService);

    const notificationRepo = makeNotificationsRepo(db);
    const notificationService = makeNotificationsService(notificationRepo);
    const notificationController = makeNotificationsController(notificationService);
    const notificationRouter = makeNotificationsRouter(notificationController);

    const authRepo = makeAuthRepo(db);
    const authService = makeAuthService(authRepo);
    const authController = makeAuthController(authService);
    const authRouter = makeAuthRouter(authController);

    const officeSlotsRepo = makeOfficeSlotsRepo(db);
    const officeSlotsService = makeOfficeSlotsService({
        repo: officeSlotsRepo,
        friendshipService,
        queue: officeQueue,
        emitter: officeEvents,
    });
    const officeSlotsController = makeOfficeSlotsController(officeSlotsService);
    const officeSlotsRouter = makeOfficeSlotsRouter(officeSlotsController);

    const parkingSlotsRepo = makeParkingSlotsRepo(db);
    const parkingSlotsService = makeParkingSlotsService({
        repo: parkingSlotsRepo,
        friendshipService,
        queue: parkingQueue,
        emitter: parkingEvents,
    });
    const parkingSlotsController = makeParkingSlotsController(parkingSlotsService);
    const parkingSlotsRouter = makeParkingSlotsRouter(parkingSlotsController);

    // Broadcaster: escucha eventos del emitter y los manda por WebSocket
    initOfficeBroadcaster();
    initParkingBroadcaster();
    initTeamBroadcaster();
    initUserBroadcaster();

    // Worker BullMQ: procesa los delayed jobs de no-show
    const officeWorker = createOfficeWorker({
        markNoShowForReservation: (id) => officeSlotsRepo.markNoShowForReservation(id),
        markCheckoutForReservation: (id) => officeSlotsRepo.markCheckoutForReservation(id),
        getReservableById: (id) => officeSlotsRepo.getReservableById(id),
    });
    const parkingWorker = createParkingWorker({
        markNoShowForReservation: (id) => parkingSlotsRepo.markNoShowForReservation(id),
        markCheckoutForReservation: (id) => parkingSlotsRepo.markCheckoutForReservation(id),
    });

    const reportsRepo = makeReportsRepo(db);
    const reportsSlotsService = makeReportsService(reportsRepo);
    const reportsController = makeReportsController(reportsSlotsService);
    const reportsRouter = makeReportsRouter(reportsController);

    const eventsRepo = makeEventsRepo(db);
    const eventsService = makeEventsService(eventsRepo, userRepo);
    const eventsController = makeEventsController(eventsService);
    const eventsRouter = makeEventsRouter(eventsController);

    const userStatusService = makeUserStatusService();
    const userStatsRepo = makeUserStatsRepo(db);
    const userStatsService = makeUserStatsService(userStatsRepo);
    userStatsService.initListeners();
    userStatsService.initScheduler();
    const userTimelineService = makeUserTimelineService({
        officeSlots: officeSlotsService,
        parkingSlots: parkingSlotsService,
        events: eventsService,
        friendship: friendshipService,
    });
    const userTimelineController = makeUserTimelineController(userTimelineService);
    const userService = makeUserService(userRepo, roleRepo, friendshipService, achievementsService, userStatusService, userStatsService);
    const userController = makeUserController(userService);
    const userRouter = makeUserRouter(userController, userTimelineController);

    const teamsRepo = makeTeamsRepo(db);
    const teamsService = makeTeamsService(teamsRepo, userStatusService);
    const teamsController = makeTeamsController(teamsService);
    const teamsRouter = makeTeamsRouter(teamsController);

    return {
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
        officeWorker,
        officeSlotsRepo,
        teamsRouter,
        parkingSlotsRouter,
        parkingSlotsRepo,
        parkingWorker,
        reportsRouter,
        eventsRouter,
        teamsService,
    };
};
