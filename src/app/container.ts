import { createDb } from "../infra/db/db";
import { makeRoleRepo, makeRoleService, makeRoleController, makeRoleRouter } from "../modules/role";

export function buildContainer(){
    const db = createDb();
    db.testConnection();

    const roleRepo = makeRoleRepo(db);
    const roleService = makeRoleService(roleRepo);
    const roleController = makeRoleController(roleService);
    const roleRouter = makeRoleRouter(roleController);

    return { roleRouter };
};