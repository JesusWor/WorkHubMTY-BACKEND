import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeUserService } from '../../../src/modules/user/user.service';
import { Roles } from '../../../src/shared/types/role.type';
import { ForbiddenError, UnprocessableError } from '../../../src/shared/errors/AppError';
import type { UserRepo } from '../../../src/modules/user/user.repo';
import type { RoleRepo } from '../../../src/modules/role/role.repo';
import type { FriendshipService } from '../../../src/modules/friendship/friendship.service';
import type { AchievementsService } from '../../../src/modules/achievements/achievements.service';
import type { UserStatusService } from '../../../src/modules/user/user-status.service';
import type { WorkGroupMembers, User } from '../../../src/modules/user/user.schema';

function makeUser(overrides: Partial<User> = {}): User {
    return {
        eId: 'USR00001',
        name: 'Usuario',
        email: 'usuario@example.com',
        roleName: 'USER',
        status: 'offline',
        ...overrides,
    };
}

function makeGroup(overrides: Partial<WorkGroupMembers> = {}): WorkGroupMembers {
    return {
        id: 1,
        name: 'Grupo base',
        description: 'Descripcion base',
        users: [makeUser({ eId: 'USR00001' }), makeUser({ eId: 'USR00002', name: 'Otro usuario', email: 'otro@example.com' })],
        ...overrides,
    };
}

function makeServices(currentGroupRef: { value: WorkGroupMembers }) {
    const repo = {
        getAll: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue(null),
        getByIds: vi.fn().mockResolvedValue([]),
        getGuestsByIds: vi.fn().mockResolvedValue([]),
        getUsers: vi.fn().mockResolvedValue([]),
        getAllByName: vi.fn().mockResolvedValue([]),
        getAllGuests: vi.fn().mockResolvedValue([]),
        getGuestById: vi.fn().mockResolvedValue(null),
        createGuest: vi.fn().mockResolvedValue(null),
        updateGuest: vi.fn().mockResolvedValue(null),
        removeGuest: vi.fn().mockResolvedValue(true),
        getAllGroups: vi.fn().mockResolvedValue([]),
        getMyGroups: vi.fn().mockResolvedValue([]),
        getGroupById: vi.fn().mockImplementation(async () => currentGroupRef.value),
        createGroup: vi.fn().mockResolvedValue(currentGroupRef.value),
        updateGroup: vi.fn().mockImplementation(async (_groupId: number, name?: string, description?: string) => {
            currentGroupRef.value = {
                ...currentGroupRef.value,
                name: name ?? currentGroupRef.value.name,
                description: description ?? currentGroupRef.value.description,
            };
            return currentGroupRef.value;
        }),
        removeGroup: vi.fn().mockResolvedValue(true),
        addGroupMembers: vi.fn().mockImplementation(async (_groupId: number, memberEIds: string[]) => {
            currentGroupRef.value = {
                ...currentGroupRef.value,
                users: [
                    ...currentGroupRef.value.users,
                    ...memberEIds.map((memberEId) => makeUser({ eId: memberEId, name: `Nombre ${memberEId}`, email: `${memberEId.toLowerCase()}@example.com` })),
                ],
            };
            return currentGroupRef.value;
        }),
        removeGroupMembers: vi.fn().mockImplementation(async (_groupId: number, memberEIds: string[]) => {
            currentGroupRef.value = {
                ...currentGroupRef.value,
                users: currentGroupRef.value.users.filter((user) => !memberEIds.includes(user.eId)),
            };
            return currentGroupRef.value;
        }),
        TEMPORARY_CREATE: vi.fn(),
    } as unknown as UserRepo;

    const roleRepo = {
        getAll: vi.fn(),
        getByName: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    } as unknown as RoleRepo;

    const friendshipService = {
        getAll: vi.fn(),
        getFriendIds: vi.fn(),
        areFriends: vi.fn(),
        createFriendship: vi.fn(),
        removeFriendship: vi.fn(),
        getReceivedRequests: vi.fn(),
        getSentRequests: vi.fn(),
        createRequest: vi.fn(),
        acceptRequest: vi.fn(),
        cancelRequest: vi.fn(),
        rejectRequest: vi.fn(),
    } as unknown as FriendshipService;

    const achievementsService = {
        getAll: vi.fn(),
        getById: vi.fn(),
        createAchievement: vi.fn(),
        updateAchievements: vi.fn(),
        getRanking: vi.fn(),
        getUserAchievements: vi.fn(),
        getCompletedByUser: vi.fn(),
        getUserStats: vi.fn(),
        getRecentActivity: vi.fn(),
        getUserSummary: vi.fn(),
    } as unknown as AchievementsService;

    const userStatusService = {
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onPing: vi.fn(),
        getStatus: vi.fn().mockResolvedValue('offline'),
        getStatuses: vi.fn().mockImplementation(async (eIds: string[]) => {
            return new Map(eIds.map((eId) => [eId, 'online'] as const));
        }),
    } as unknown as UserStatusService;

    const service = makeUserService(
        repo,
        roleRepo,
        friendshipService,
        achievementsService,
        userStatusService
    );

    return { service, repo, userStatusService };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('UserService.updateGroup', () => {
    it('permite patch a un admin aunque no pertenezca al grupo', async () => {
        const currentGroupRef = { value: makeGroup({ users: [makeUser({ eId: 'USR00002' })] }) };
        const { service, repo } = makeServices(currentGroupRef);

        const result = await service.updateGroup(1, 'ADMIN001', Roles.ADMIN, {
            name: 'Grupo actualizado',
        });

        expect(repo.updateGroup).toHaveBeenCalledWith(1, 'Grupo actualizado', undefined);
        expect(result.name).toBe('Grupo actualizado');
        expect(result.users).toHaveLength(1);
    });

    it('permite patch a un miembro del grupo', async () => {
        const currentGroupRef = { value: makeGroup({ users: [makeUser({ eId: 'USR00001' })] }) };
        const { service, repo } = makeServices(currentGroupRef);

        const result = await service.updateGroup(1, 'USR00001', Roles.USER, {
            description: 'Nueva descripcion',
        });

        expect(repo.updateGroup).toHaveBeenCalledWith(1, undefined, 'Nueva descripcion');
        expect(result.description).toBe('Nueva descripcion');
    });

    it('rechaza a quien no es miembro ni admin', async () => {
        const currentGroupRef = { value: makeGroup({ users: [makeUser({ eId: 'USR00002' })] }) };
        const { service, repo } = makeServices(currentGroupRef);

        await expect(
            service.updateGroup(1, 'USR00001', Roles.USER, { name: 'Nuevo nombre' })
        ).rejects.toBeInstanceOf(ForbiddenError);

        expect(repo.updateGroup).not.toHaveBeenCalled();
        expect(repo.addGroupMembers).not.toHaveBeenCalled();
        expect(repo.removeGroupMembers).not.toHaveBeenCalled();
    });

    it('aplica cambios mixtos en una sola operacion logica', async () => {
        const currentGroupRef = {
            value: makeGroup({
                name: 'Grupo base',
                description: 'Descripcion base',
                users: [
                    makeUser({ eId: 'USR00001' }),
                    makeUser({ eId: 'USR00002' }),
                    makeUser({ eId: 'USR00003', name: 'A eliminar', email: 'eliminar@example.com' }),
                ],
            }),
        };
        const { service, repo } = makeServices(currentGroupRef);

        const result = await service.updateGroup(1, 'USR00001', Roles.USER, {
            name: 'Grupo nuevo',
            description: 'Descripcion nueva',
            addMemberEIds: ['USR00004'],
            removeMemberEIds: ['USR00003'],
        });

        expect(repo.updateGroup).toHaveBeenCalledWith(1, 'Grupo nuevo', 'Descripcion nueva');
        expect(repo.addGroupMembers).toHaveBeenCalledWith(1, ['USR00004']);
        expect(repo.removeGroupMembers).toHaveBeenCalledWith(1, ['USR00003']);
        expect(result.name).toBe('Grupo nuevo');
        expect(result.description).toBe('Descripcion nueva');
        expect(result.users.map((user) => user.eId)).toEqual(['USR00001', 'USR00002', 'USR00004']);
    });

    it('rechaza patches sin cambios utiles', async () => {
        const currentGroupRef = {
            value: makeGroup({
                name: 'Grupo base',
                description: 'Descripcion base',
                users: [makeUser({ eId: 'USR00001' })],
            }),
        };
        const { service, repo } = makeServices(currentGroupRef);

        await expect(
            service.updateGroup(1, 'USR00001', Roles.USER, {
                name: 'Grupo base',
                addMemberEIds: ['USR00001'],
            })
        ).rejects.toBeInstanceOf(UnprocessableError);

        expect(repo.updateGroup).not.toHaveBeenCalled();
        expect(repo.addGroupMembers).not.toHaveBeenCalled();
        expect(repo.removeGroupMembers).not.toHaveBeenCalled();
    });
});
