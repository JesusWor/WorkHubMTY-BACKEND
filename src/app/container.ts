import { createDb } from "../infra/db/db.js";
import { makeNotificationRouter, makeNotificationController, makeNotificationService } from "../modules/notifications/index.js";
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from "../modules/role/index.js";
import { makeUserRepo, makeUserService, makeUserController, makeUserRouter } from "../modules/user/index.js";
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from "../modules/auth/index.js";
import { makeFriendshipRepo, makeFriendshipService, makeFriendshipController, makeFriendshipRouter } from "../modules/friendship/index.js";
import { makeAchievementsRepo, makeAchievementsService, makeAchievementsController, makeAchievementsRouter } from "../modules/achievements/index.js";
import { makeOfficeSlotsRepo, makeOfficeSlotsService, makeOfficeSlotsController, makeOfficeSlotsRouter } from "../modules/office-slots/index.js";
import { makeParkingSlotsRepo, makeParkingSlotsService, makeParkingSlotsController, makeParkingSlotsRouter } from "../modules/parking-slots/index.js";

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
    
    const achievementsRepo = makeAchievementsRepo(db);
    const achievementsService = makeAchievementsService(achievementsRepo);
    const achievementsController = makeAchievementsController(achievementsService);
    const achievementsRouter = makeAchievementsRouter(achievementsController);
    
    const userRepo = makeUserRepo(db);
    const userService = makeUserService(userRepo, roleRepo, friendshipService, achievementsService);
    const userController = makeUserController(userService);
    const userRouter = makeUserRouter(userController);

    const notificationService = makeNotificationService();
    const notificationController = makeNotificationController(notificationService);
    const notificationRouter = makeNotificationRouter(notificationController);

    const authRepo = makeAuthRepo(db);
    const authService = makeAuthService(authRepo);
    const authController = makeAuthController(authService);
    const authRouter = makeAuthRouter(authController);

    const officeSlotsRepo = makeOfficeSlotsRepo(db);
    const officeSlotsService = makeOfficeSlotsService(officeSlotsRepo);
    const officeSlotsController = makeOfficeSlotsController(officeSlotsService);
    const officeSlotsRouter = makeOfficeSlotsRouter(officeSlotsController);

    const parkingSlotsRepo = makeParkingSlotsRepo(db);
    const parkingSlotsService = makeParkingSlotsService(parkingSlotsRepo);
    const parkingSlotsController = makeParkingSlotsController(parkingSlotsService);
    const parkingSlotsRouter = makeParkingSlotsRouter(parkingSlotsController);

    return { roleRouter, userRouter, notificationRouter, authRouter, friendshipRouter, achievementsRouter, officeSlotsRouter, parkingSlotsRouter };
};