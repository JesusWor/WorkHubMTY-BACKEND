import bcrypt from "bcrypt";
import type { RoleRepo } from "../role/role.repo.js";
import type { UserRepo } from "./user.repo.js";
import type {
    User,
    Profile,
    Guest,
    ListUsersPage,
    ListUsersQuery,
    UserRelationExclude,
} from "./user.schema.js";
import type { UserStatsService } from "./user-stats.service.js";
import type { FriendshipService } from "../friendship/friendship.service.js";
import type { AchievementsService } from "../achievements/achievements.service.js";
import type { UserStatusService } from "./user-status.service.js";
import { ForbiddenError, InternalError, NotFoundError } from "../../shared/errors/AppError.js";
import { userEvents } from "../../infra/events/index.js";

export type UserService = {
    getAll: () => Promise<User[]>;
    getById: (eId: string) => Promise<User | null>;
    getByIds(eIds: string[]): Promise<User[]>;
    getGuestsByIds(guestIds: number[]): Promise<Guest[]>;

    getUsers: (query: ListUsersQuery, authEId: string) => Promise<ListUsersPage>;
    getPotentialFriends: (userId: string, query?: string) => Promise<User[]>;

    getUserFriends: (userId: string) => Promise<User[]>;
    getAllByName: (name: string) => Promise<User[]>;
    getFullProfile: (requestedEId: string, authEId: string) => Promise<Profile>;

    getAllGuests: () => Promise<Guest[]>;
    getGuestById: (guestId: number) => Promise<Guest>;
    createGuest: (name: string, email: string, invitedByEId: string) => Promise<Guest>;
    updateGuest: (guestId: number, name?: string, email?: string) => Promise<Guest>;
    removeGuest: (guestId: number) => Promise<boolean>;

    TEMPORARY_CREATE?: (eId: string, name: string, email: string, password: string, role: string, title: string|null) => Promise<User>;
};

export async function enrichWithStatus(users: User[], statusService: UserStatusService): Promise<User[]> {
    if (!users.length) return users;
    const statuses = await statusService.getStatuses(users.map((user) => user.eId));
    return users.map((user) => ({ ...user, status: statuses.get(user.eId) ?? "offline" }));
}

async function enrichOneWithStatus(user: User | null, statusService: UserStatusService): Promise<User | null> {
    if (!user) return null;
    const status = await statusService.getStatus(user.eId);
    return { ...user, status };
}

async function resolveExcludedIds(
    authEId: string,
    exclude: UserRelationExclude[],
    excludeIds: string[],
    friendshipService: FriendshipService,
): Promise<string[]> {
    const excluded = new Set<string>(excludeIds);

    const tasks: Promise<string[]>[] = [];
    if (exclude.includes("friends")) {
        tasks.push(friendshipService.getFriendIds(authEId));
    }
    // ESTO, CAMBIARLO PORQUE AHORA SENT REQUESTS ACEPTA MAS DE UN ID
    // hope
    if (exclude.includes("sent_requests")) {
        tasks.push(friendshipService.getSentRequests(authEId).then((requests) => requests.map((request) => request.eId)));
    }
    if (exclude.includes("received_requests")) {
        tasks.push(friendshipService.getReceivedRequests(authEId).then((requests) => requests.map((request) => request.fromUser)));
    }

    const resolved = await Promise.all(tasks);
    for (const ids of resolved) {
        for (const id of ids) {
            excluded.add(id);
        }
    }

    return [...excluded];
}

export function makeUserService(
    repo: UserRepo,
    roleRepo: RoleRepo,
    friendshipService: FriendshipService,
    achievementService: AchievementsService,
    userStatusService: UserStatusService,
    userStatsService: UserStatsService,
): UserService {
    const getAll = async (): Promise<User[]> => {
        const users = await repo.getAll();
        return enrichWithStatus(users, userStatusService);
    };

    const getById = async (eId: string): Promise<User | null> => {
        const user = await repo.getById(eId);
        return enrichOneWithStatus(user, userStatusService);
    };

    const getByIds = async (eIds: string[]): Promise<User[]> => {
        const users = await repo.getByIds(eIds);
        return enrichWithStatus(users, userStatusService);
    };

    const getGuestsByIds = async (guestIds: number[]): Promise<Guest[]> => {
        return repo.getGuestsByIds(guestIds);
    };

    const getUserFriends = async (userId: string): Promise<User[]> => {
        const friendIds = await friendshipService.getFriendIds(userId);
        if (!friendIds.length) return [];
        const users = await repo.getByIds(friendIds);
        return enrichWithStatus(users, userStatusService);
    };

    const getAllByName = async (name: string): Promise<User[]> => {
        const users = await repo.getAllByName(name);
        return enrichWithStatus(users, userStatusService);
    };

    const getFullProfile = async (requestedEId: string, authEId: string): Promise<Profile> => {
        if (!requestedEId || !authEId) {
            throw new ForbiddenError("No autorizado");
        }

        const isAllowed = await friendshipService.areFriends(requestedEId, authEId);
        if (!isAllowed && requestedEId !== authEId) {
            throw new ForbiddenError("Solo puedes ver este perfil si eres amigo o eres tu");
        }

        const user = await repo.getById(requestedEId);
        if (!user) {
            throw new NotFoundError("Usuario no encontrado");
        }

        const [friends, achievements, status, userStats] = await Promise.all([
            getUserFriends(requestedEId),
            achievementService.getCompletedByUser(requestedEId),
            userStatusService.getStatus(requestedEId),
            userStatsService.getByUserId(requestedEId),
        ]);

        return {
            ...user,
            status,
            stats: {
                streak: userStats?.streak ?? 0,
                friendCount: friends.length,
                levelsPassed: (achievements ?? []).length,
                hoursInOffice: userStats?.total_work_hours ?? 0,
                ap: userStats?.ap ?? 0,
            }
        };
    };

    const getUsers = async (query: ListUsersQuery, authEId: string): Promise<ListUsersPage> => {
        const excludedIds = await resolveExcludedIds(
            authEId,
            query.exclude ?? [],
            query.excludeId ?? [],
            friendshipService,
        );

        const page = await repo.listUsers({
            query: query.query,
            exclude: query.exclude,
            excludeId: excludedIds,
            limit: query.limit,
            cursor: query.cursor,
        });

        return {
            items: await enrichWithStatus(page.items, userStatusService),
            nextCursor: page.nextCursor,
        };
    };

    const getPotentialFriends = async (userId: string, query?: string): Promise<User[]> => {
        const users = await repo.getPotentialFriends(query, userId);
        return enrichWithStatus(users, userStatusService);
    }

    const getAllGuests = async (): Promise<Guest[]> => repo.getAllGuests();

    const getGuestById = async (guestId: number): Promise<Guest> => {
        const guest = await repo.getGuestById(guestId);
        if (!guest) throw new NotFoundError("Invitado no encontrado");
        return guest;
    };

    const createGuest = async (name: string, email: string, invitedByEId: string): Promise<Guest> => {
        const guest = await repo.createGuest(name, email, invitedByEId);
        userEvents.emit("guest.created", guest);
        return guest;
    };

    const updateGuest = async (guestId: number, name?: string, email?: string): Promise<Guest> => {
        const updated = await repo.updateGuest(guestId, name, email);
        if (!updated) throw new NotFoundError("Invitado no encontrado");
        userEvents.emit("guest.updated", updated);
        return updated;
    };

    const removeGuest = async (guestId: number): Promise<boolean> => {
        const removed = await repo.removeGuest(guestId);
        if (removed) {
            userEvents.emit("guest.deleted", guestId);
        }
        return removed;
    };

    const TEMPORARY_CREATE = async (eId: string, name: string, email: string, password: string, role: string, title: string|null): Promise<User> => {
        const hashedPassword = await bcrypt.hash(password, 10);

        const roles = await roleRepo.getByName(role);

        if (!roles || roles.length === 0) {
            const createdRole = await roleRepo.create({ name: role });
            if (!createdRole) throw new InternalError("Could not create role");
            return await repo.TEMPORARY_CREATE(eId, name, email, hashedPassword, createdRole.id, title);
        }

        await repo.TEMPORARY_CREATE(eId, name, email, hashedPassword, roles[0].id, title);
        const user = await getById(eId);

        if (user) {
            userEvents.emit("user.created", user);
        }

        return user as User;
    };

    return {
        getAll,
        getById,
        getByIds,
        getGuestsByIds,
        getUserFriends,
        getAllByName,
        getFullProfile,
        getUsers,
        getPotentialFriends,
        getAllGuests,
        getGuestById,
        createGuest,
        updateGuest,
        removeGuest,
        TEMPORARY_CREATE,
    };
}
