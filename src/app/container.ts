import { createDb } from "../infra/db/db";
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from "../modules/role";
import { makeUserRepo, makeUserService, makeUserController, makeUserRouter } from "../modules/user";

export function buildContainer(){
    const db = createDb();
    db.testConnection();

    const roleRepo = makeRoleRepo(db);
    const roleService = makeRoleService(roleRepo);
    const roleController = makeRoleController(roleService);
    const roleRouter = makeRoleRouter(roleController);

    const userRepo  = makeUserRepo(db);
    const userService = makeUserService(userRepo);
    const userController = makeUserController(userService);
    const userRouter = makeUserRouter(userController);

    return { roleRouter, userRouter };
};