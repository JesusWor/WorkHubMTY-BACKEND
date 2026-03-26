import { createDb } from "../infra/db/db";
import { makeNotificationRouter, makeNotificationController, makeNotificationService } from "../modules/notifications";
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from "../modules/role";
import { makeUserRepo, makeUserService, makeUserController, makeUserRouter } from "../modules/user";
import { makeAuthRepo, makeAuthService, makeAuthController, makeAuthRouter } from "../modules/auth";

export function buildContainer(){
    const db = createDb();
    db.testConnection();

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

    const authRepo = makeAuthRepo(db);
    const authService = makeAuthService(authRepo);
    const authController = makeAuthController(authService);
    const authRouter = makeAuthRouter(authController);

    return { roleRouter, userRouter, notificationRouter, authRouter };
};