import { RoleRepo } from "../role/role.repo.js";
import { UserRepo } from "./user.repo.js";
import { User, Profile, Guest } from "./user.schema.js";
import { FriendshipService } from "../friendship/friendship.service.js";
import { AchievementsService } from "../achievements/achievements.service.js";
import bcrypt from "bcrypt";
import { ForbiddenError, InternalError, NotFoundError } from "../../shared/errors/AppError.js";

export type UserService = {
    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;
    getByIds(eIds: string[]): Promise<User[]>;
    getGuestsByIds(guestIds: number[]): Promise<Guest[]>;

    getUserFriends: (userId: string) => Promise<User[]>;

    getAllByName: (name: string) => Promise<User[]>;

    getFullProfile: (requestedEId: string, authEId: string) => Promise<Profile>;

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

    const getByIds = async (eIds: string[]) => {
        return repo.getByIds(eIds);
    }

    const getGuestsByIds = async (guestIds: number[]): Promise<Guest[]> => {
        return repo.getGuestsByIds(guestIds);
    }

    const getUserFriends = async (userId: string): Promise<User[]> => {
        const friendIds = await friendshipService.getFriendIds(userId);
        if (!friendIds.length) return [];
        return await repo.getByIds(friendIds);
    };

    const getAllByName = async (name: string): Promise<User[]> => {
        return await repo.getAllByName(name);
    };

    const getFullProfile = async (requestedEId: string, authEId: string): Promise<Profile> => {
        if (!requestedEId || !authEId) {
            throw new ForbiddenError("No autorizado");
        }

        const isAllowed = await friendshipService.areFriends(requestedEId, authEId);

        if (!isAllowed && requestedEId !== authEId) {
            throw new ForbiddenError("Solo puedes ver este perfil si eres amigo o eres tú");
        }

        const user = await repo.getById(requestedEId);

        if (!user) {
            throw new NotFoundError("Usuario no encontrado");
        }

        const friends = await getUserFriends(requestedEId);
        const achievements = await achievementService.getCompletedByUser(requestedEId) || [];

        return {
            ...user,
            friendCount: friends.length,
            achievementCount: achievements.length
        };
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
        getByIds,
        getGuestsByIds,
        getUserFriends,
        getAllByName,
        getFullProfile,
        TEMPORARY_CREATE
    };
}
