import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeTeamsService } from '../../../src/modules/teams/teams.service';
import { Roles } from '../../../src/shared/types/role.type';
import { ForbiddenError, UnprocessableError } from '../../../src/shared/errors/AppError';
import type { TeamsRepo } from '../../../src/modules/teams/teams.repo';
import type { UserStatusService } from '../../../src/modules/user/user-status.service';
import type { TeamMembers, Team, TeamMember } from '../../../src/modules/teams/teams.schema';
import type { User } from '../../../src/modules/user/user.schema';

function makeUser(overrides: Partial<User> = {}): User {
    return {
        eId: 'USR00001',
        name: 'Usuario',
        email: 'usuario@example.com',
        roleName: 'USER',
        title: null,
        status: 'offline',
        ...overrides,
    };
}

function makeTeam(overrides: Partial<TeamMembers> = {}): TeamMembers {
    return {
        id: 1,
        name: 'Team base',
        description: 'Descripcion base',
        users: [makeUser({ eId: 'USR00001' }), makeUser({ eId: 'USR00002', name: 'Otro usuario', email: 'otro@example.com' })],
        ...overrides,
    };
}

function makeServices(currentTeamRef: { value: TeamMembers }) {
    const repo = {
        getAllTeams: vi.fn().mockResolvedValue([]),
        getMyTeams: vi.fn().mockResolvedValue([]),
        getTeamMembers: vi.fn().mockResolvedValue([] as TeamMember[]),
        getTeamById: vi.fn().mockImplementation(async () => currentTeamRef.value),
        createTeam: vi.fn().mockResolvedValue(currentTeamRef.value),
        updateTeam: vi.fn().mockImplementation(async (_teamId: number, name?: string, description?: string) => {
            currentTeamRef.value = {
                ...currentTeamRef.value,
                name: name ?? currentTeamRef.value.name,
                description: description ?? currentTeamRef.value.description,
            };
            return currentTeamRef.value;
        }),
        removeTeam: vi.fn().mockResolvedValue(true),
        addTeamMembers: vi.fn().mockImplementation(async (_teamId: number, memberEIds: string[]) => {
            currentTeamRef.value = {
                ...currentTeamRef.value,
                users: [
                    ...currentTeamRef.value.users,
                    ...memberEIds.map((memberEId) => makeUser({ eId: memberEId, name: `Nombre ${memberEId}`, email: `${memberEId.toLowerCase()}@example.com` })),
                ],
            };
            return currentTeamRef.value;
        }),
        removeTeamMembers: vi.fn().mockImplementation(async (_teamId: number, memberEIds: string[]) => {
            currentTeamRef.value = {
                ...currentTeamRef.value,
                users: currentTeamRef.value.users.filter((user) => !memberEIds.includes(user.eId)),
            };
            return currentTeamRef.value;
        }),
    } as unknown as TeamsRepo;

    const userStatusService = {
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onPing: vi.fn(),
        getStatus: vi.fn().mockResolvedValue('offline'),
        getStatuses: vi.fn().mockImplementation(async (eIds: string[]) => {
            return new Map(eIds.map((eId) => [eId, 'online'] as const));
        }),
    } as unknown as UserStatusService;

    const service = makeTeamsService(repo, userStatusService);
    return { service, repo };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TeamsService.updateTeam', () => {
    it('enriquece getTeamById con status de usuarios', async () => {
        const currentTeamRef = { value: makeTeam({ users: [makeUser({ eId: 'USR00001' })] }) };
        const { service } = makeServices(currentTeamRef);

        const result = await service.getTeamById(1);

        expect(result.users[0].status).toBe('online');
    });

    it('lanza BadRequestError si getMyTeams no recibe userId', async () => {
        const currentTeamRef = { value: makeTeam() };
        const { service } = makeServices(currentTeamRef);

        await expect(service.getMyTeams('')).rejects.toThrow('User id is required');
    });

    it('permite patch a un admin aunque no pertenezca al team', async () => {
        const currentTeamRef = { value: makeTeam({ users: [makeUser({ eId: 'USR00002' })] }) };
        const { service, repo } = makeServices(currentTeamRef);

        const result = await service.updateTeam(1, 'ADMIN001', Roles.ADMIN, {
            name: 'Team actualizado',
        });

        expect(repo.updateTeam).toHaveBeenCalledWith(1, 'Team actualizado', undefined);
        expect(result.name).toBe('Team actualizado');
        expect(result.users).toHaveLength(1);
    });

    it('permite patch a un miembro del team', async () => {
        const currentTeamRef = { value: makeTeam({ users: [makeUser({ eId: 'USR00001' })] }) };
        const { service, repo } = makeServices(currentTeamRef);

        const result = await service.updateTeam(1, 'USR00001', Roles.USER, {
            description: 'Nueva descripcion',
        });

        expect(repo.updateTeam).toHaveBeenCalledWith(1, undefined, 'Nueva descripcion');
        expect(result.description).toBe('Nueva descripcion');
    });

    it('rechaza a quien no es miembro ni admin', async () => {
        const currentTeamRef = { value: makeTeam({ users: [makeUser({ eId: 'USR00002' })] }) };
        const { service, repo } = makeServices(currentTeamRef);

        await expect(
            service.updateTeam(1, 'USR00001', Roles.USER, { name: 'Nuevo nombre' })
        ).rejects.toBeInstanceOf(ForbiddenError);

        expect(repo.updateTeam).not.toHaveBeenCalled();
        expect(repo.addTeamMembers).not.toHaveBeenCalled();
        expect(repo.removeTeamMembers).not.toHaveBeenCalled();
    });

    it('aplica cambios mixtos en una sola operacion logica', async () => {
        const currentTeamRef = {
            value: makeTeam({
                name: 'Team base',
                description: 'Descripcion base',
                users: [
                    makeUser({ eId: 'USR00001' }),
                    makeUser({ eId: 'USR00002' }),
                    makeUser({ eId: 'USR00003', name: 'A eliminar', email: 'eliminar@example.com' }),
                ],
            }),
        };
        const { service, repo } = makeServices(currentTeamRef);

        const result = await service.updateTeam(1, 'USR00001', Roles.USER, {
            name: 'Team nuevo',
            description: 'Descripcion nueva',
            addMemberEIds: ['USR00004'],
            removeMemberEIds: ['USR00003'],
        });

        expect(repo.updateTeam).toHaveBeenCalledWith(1, 'Team nuevo', 'Descripcion nueva');
        expect(repo.addTeamMembers).toHaveBeenCalledWith(1, ['USR00004']);
        expect(repo.removeTeamMembers).toHaveBeenCalledWith(1, ['USR00003']);
        expect(result.name).toBe('Team nuevo');
        expect(result.description).toBe('Descripcion nueva');
        expect(result.users.map((user) => user.eId)).toEqual(['USR00001', 'USR00002', 'USR00004']);
    });

    it('rechaza patches sin cambios utiles', async () => {
        const currentTeamRef = {
            value: makeTeam({
                name: 'Team base',
                description: 'Descripcion base',
                users: [makeUser({ eId: 'USR00001' })],
            }),
        };
        const { service, repo } = makeServices(currentTeamRef);

        await expect(
            service.updateTeam(1, 'USR00001', Roles.USER, {
                name: 'Team base',
                addMemberEIds: ['USR00001'],
            })
        ).rejects.toBeInstanceOf(UnprocessableError);

        expect(repo.updateTeam).not.toHaveBeenCalled();
        expect(repo.addTeamMembers).not.toHaveBeenCalled();
        expect(repo.removeTeamMembers).not.toHaveBeenCalled();
    });

    it('removeTeam valida acceso antes de eliminar', async () => {
        const currentTeamRef = { value: makeTeam({ users: [makeUser({ eId: 'USR00001' })] }) };
        const { service, repo } = makeServices(currentTeamRef);

        await expect(service.removeTeam(1, 'USR00001', Roles.USER)).resolves.toBe(true);
        expect(repo.removeTeam).toHaveBeenCalledWith(1);
    });
});
