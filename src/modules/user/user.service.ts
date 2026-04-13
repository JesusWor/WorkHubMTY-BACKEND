import { RoleRepo } from "../role/role.repo";
import { UserRepo } from "./user.repo";
import { User } from "./user.schema";
import bcrypt from "bcrypt";
import { InternalError } from "../../shared/errors/AppError";

export type UserService = {
    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;
    getAllByName: (name: string) => Promise<User[]>;
    TEMPORARY_CREATE?: (eId: string, name: string, email: string, password: string, role: string) => Promise<User>;
}

export function makeUserService(repo: UserRepo, roleRepo: RoleRepo): UserService {
    const getAll = async (): Promise<User[]> => {
        return await repo.getAll();
    };

    const getById = async (eId: string): Promise<User | null> => {
        return await repo.getById(eId);
    };

    const getAllByName = async (name: string): Promise<User[]> => {
        return await repo.getAllByName(name);
    };

    const TEMPORARY_CREATE = async (eId: string, name: string, email: string, password: string, role: string): Promise<User> => {
        const hashedPassword = await bcrypt.hash(password, 10);

        const roles = await roleRepo.getByName(role);
        console.log(roles);

        if (!roles || roles.length === 0) {
            const createdRole = await roleRepo.create({ name: role });
            console.log(createdRole);
            if (!createdRole) throw new InternalError("Could not create role");
            return await repo.TEMPORARY_CREATE(eId, name, email, hashedPassword, createdRole.id);
        }

        return await repo.TEMPORARY_CREATE(eId, name, email, hashedPassword, roles[0].id);
    };

    return {
        getAll,
        getById,
        getAllByName,
        TEMPORARY_CREATE
    };
}
