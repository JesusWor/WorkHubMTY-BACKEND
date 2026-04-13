import { RoleRepo } from "./role.repo";
import { Role, CreateRole, UpdateRole } from "./role.schema";
import { InternalError, NotFoundError } from "../../shared/errors/AppError";

export type RoleService = {
    getAll: () => Promise<Role[]>;
    getById: (id: number) => Promise<Role | null>;
    create: (role: CreateRole) => Promise<Role>;
    update: (id: number, role: UpdateRole) => Promise<Role | null>;
    delete: (id: number) => Promise<boolean>;
}

export function makeRoleService(repo: RoleRepo): RoleService {
    const getAll = async (): Promise<Role[]> => {
        return await repo.getAll();
    };

    const getById = async (id: number): Promise<Role | null> => {
        return await repo.getById(id);
    };

    const create = async (role: CreateRole): Promise<Role> => {
        const created = await repo.create(role);
        if (!created) throw new InternalError("Failed to create role");
        return created;
    };

    const update = async (id: number, role: UpdateRole): Promise<Role | null> => {
        const updated = await repo.update(id, role);
        if (!updated) throw new NotFoundError("Role not found");
        return updated;
    };

    const remove = async (id: number): Promise<boolean> => {
        const deleted = await repo.delete(id);
        if (!deleted) throw new NotFoundError("Role not found");
        return deleted;
    };

    return {
        getAll,
        getById,
        create,
        update,
        delete: remove
    };
}
