import { UserRepo } from "./user.repo";
import { User } from "./user.schema";

export type UserService = {
    getAll : () => Promise<User[]>;
    getById : (eId: string) => Promise<User | null>;

    getAllByName: (name: string) => Promise<User[]>;
}

export function makeUserService(repo: UserRepo): UserService {
    const getAll = async (): Promise<User[]> => {
        return await repo.getAll();
    }

    const getById = async (eId: string): Promise<User | null> => {
        return await repo.getById(eId);
    }

    const getAllByName = async (name: string) : Promise<User[]> => {
        return await repo.getAllByName(name);
    }
    
    return {
        getAll,
        getById,
        getAllByName
    }
}