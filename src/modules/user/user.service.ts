import { RoleRepo } from "../role/role.repo.js";
import { UserRepo } from "./user.repo.js";
import { User, Profile } from "./user.schema.js";
import { FriendshipService } from "../friendship/friendship.service.js";
import { AchievementsService } from "../achievements/achievements.service.js";
import bcrypt from "bcrypt";
import { ForbiddenError, InternalError, NotFoundError } from "../../shared/errors/AppError.js";

export type UserService = {
    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;
    getAllByName: (name: string) => Promise<User[]>;
    getProfile: (requestedEId: string, authEId: string) => Promise<Profile>;
    TEMPORARY_CREATE?: (eId: string, name: string, email: string, password: string, role: string) => Promise<User>;
}

export function makeUserService(repo: UserRepo, roleRepo: RoleRepo,
    friendshipService: FriendshipService,
    achievementService: AchievementsService
): UserService {

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

    const getProfile = async (requestedEId: string, authEId: string): Promise<Profile> => {
        if (!requestedEId || !authEId) throw new ForbiddenError("No autorizado para ver este perfil");
        const isAllowed = await friendshipService.areFriends(requestedEId, authEId);
        if (!isAllowed) throw new ForbiddenError("Solo puedes ver el perfil si eres amigo o es tuyo");

        const user = await repo.getById(requestedEId);
        if (!user) throw new NotFoundError("Usuario no encontrado");

        const friends = await friendshipService.getFriendsOf(requestedEId);
        const achievements = await achievementService.getCompletedByUser(requestedEId) || [];

        return {
            eId: user.eId,
            name: user.name,
            email: user.email,
            roleName: user.roleName,
            friendCount: friends.length,
            achievementCount: achievements.length
        };
    };

    return {
        getAll,
        getById,
        getAllByName,
        getProfile,
        TEMPORARY_CREATE
    };
}
