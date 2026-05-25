import { RoleRepo } from "../role/role.repo.js";
import { UserRepo } from "./user.repo.js";
import { User, Profile, Guest, WorkGroup, WorkGroupMembers } from "./user.schema.js";
import { FriendshipService } from "../friendship/friendship.service.js";
import { AchievementsService } from "../achievements/achievements.service.js";
import bcrypt from "bcrypt";
import { ForbiddenError, InternalError, NotFoundError } from "../../shared/errors/AppError.js";
import { Roles } from "../../middleware/index.js";

export type UserService = {
    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;
    getByIds(eIds: string[]): Promise<User[]>;
    getGuestsByIds(guestIds: number[]): Promise<Guest[]>;

    getUserFriends: (userId: string) => Promise<User[]>;
    getAllByName: (name: string) => Promise<User[]>;
    getFullProfile: (requestedEId: string, authEId: string) => Promise<Profile>;

    // Groups
    getAllGroups: () => Promise<WorkGroup[]>;
    getGroupById: (groupId: number) => Promise<WorkGroupMembers>;
    createGroup: (name: string, description: string, memberEIds: string[]) => Promise<WorkGroupMembers>;
    updateGroup: (groupId: number, authEId: string, authRole: Roles, name?: string, description?: string) => Promise<WorkGroupMembers>;
    removeGroup: (groupId: number, authEId: string, authRole: Roles) => Promise<boolean>;
    addGroupMembers: (groupId: number, authEId: string, authRole: Roles, memberEIds: string[]) => Promise<WorkGroupMembers>;
    removeGroupMembers: (groupId: number, authEId: string, authRole: Roles, memberEIds: string[]) => Promise<WorkGroupMembers>;

    // Guests
    getAllGuests: () => Promise<Guest[]>;
    getGuestById: (guestId: number) => Promise<Guest>;
    createGuest: (name: string, email: string, invitedByEId: string) => Promise<Guest>;
    updateGuest: (guestId: number, name?: string, email?: string) => Promise<Guest>;
    removeGuest: (guestId: number) => Promise<boolean>;

    TEMPORARY_CREATE?: (eId: string, name: string, email: string, password: string, role: string) => Promise<User>;

}

export function makeUserService(repo: UserRepo, roleRepo: RoleRepo,
    friendshipService: FriendshipService,
    achievementService: AchievementsService
): UserService {

    // Users

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

    // Groups

    const assertGroupAccess = async (groupId: number, authEId: string, authRole: Roles): Promise<WorkGroupMembers> => {
        const group = await repo.getGroupById(groupId);
        if (!group) throw new NotFoundError("Grupo no encontrado");

        const isAdmin = authRole === Roles.ADMIN;
        const isMember = group.users.some(u => u.eId === authEId);

        if (!isAdmin && !isMember) {
            throw new ForbiddenError("Solo miembros del grupo o administradores pueden realizar esta acción");
        }

        return group;
    };

    const getAllGroups = async (): Promise<WorkGroup[]> => repo.getAllGroups();

    const getGroupById = async (groupId: number): Promise<WorkGroupMembers> => {
        const group = await repo.getGroupById(groupId);
        if (!group) throw new NotFoundError("Grupo no encontrado");
        return group;
    };

    const createGroup = async (name: string, description: string, memberEIds: string[]): Promise<WorkGroupMembers> => {
        return repo.createGroup(name, description, memberEIds);
    };

    const updateGroup = async (
        groupId: number,
        authEId: string,
        authRole: Roles,
        name?: string,
        description?: string
    ): Promise<WorkGroupMembers> => {
        await assertGroupAccess(groupId, authEId, authRole);
        const updated = await repo.updateGroup(groupId, name, description);
        if (!updated) throw new NotFoundError("Grupo no encontrado");
        return updated;
    };

    const removeGroup = async (groupId: number, authEId: string, authRole: Roles): Promise<boolean> => {
        await assertGroupAccess(groupId, authEId, authRole);
        return repo.removeGroup(groupId);
    };

    const addGroupMembers = async (
        groupId: number,
        authEId: string,
        authRole: Roles,
        memberEIds: string[]
    ): Promise<WorkGroupMembers> => {
        await assertGroupAccess(groupId, authEId, authRole);
        return repo.addGroupMembers(groupId, memberEIds);
    };

    const removeGroupMembers = async (
        groupId: number,
        authEId: string,
        authRole: Roles,
        memberEIds: string[]
    ): Promise<WorkGroupMembers> => {
        await assertGroupAccess(groupId, authEId, authRole);
        return repo.removeGroupMembers(groupId, memberEIds);
    };

    // Guests

    const getAllGuests = async (): Promise<Guest[]> => repo.getAllGuests();

    const getGuestById = async (guestId: number): Promise<Guest> => {
        const guest = await repo.getGuestById(guestId);
        if (!guest) throw new NotFoundError("Invitado no encontrado");
        return guest;
    };

    const createGuest = async (name: string, email: string, invitedByEId: string): Promise<Guest> => {
        return repo.createGuest(name, email, invitedByEId);
    };

    const updateGuest = async (guestId: number, name?: string, email?: string): Promise<Guest> => {
        const updated = await repo.updateGuest(guestId, name, email);
        if (!updated) throw new NotFoundError("Invitado no encontrado");
        return updated;
    };

    const removeGuest = async (guestId: number): Promise<boolean> => {
        return repo.removeGuest(guestId);
    };

    // Temp

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
        getAllGroups,
        getGroupById,
        createGroup,
        updateGroup,
        removeGroup,
        addGroupMembers,
        removeGroupMembers,
        getAllGuests,
        getGuestById,
        createGuest,
        updateGuest,
        removeGuest,
        TEMPORARY_CREATE,
    };
}
