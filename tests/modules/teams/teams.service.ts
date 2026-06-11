import type { TeamsRepo } from "./teams.repo.js";
import type { Team, TeamMember, TeamMembers, UpdateTeam } from "./teams.schema.js";
import type { UserStatusService } from "../user/user-status.service.js";
import { BadRequestError, ForbiddenError, NotFoundError, UnprocessableError } from "../../shared/errors/AppError.js";
import { Roles } from "../../shared/types/role.type.js";
import type { User } from "../user/user.schema.js";

export type TeamsService = {
    getAllTeams: (name?: string) => Promise<Team[]>;
    getMyTeams: (userId: string) => Promise<Team[]>;
    getTeamMembers: (teamId: string) => Promise<TeamMember[]>;
    getTeamById: (teamId: number) => Promise<TeamMembers>;
    createTeam: (name: string, description: string, memberEIds: string[]) => Promise<TeamMembers>;
    updateTeam: (teamId: number, authEId: string, authRole: Roles, patch: UpdateTeam) => Promise<TeamMembers>;
    removeTeam: (teamId: number, authEId: string, authRole: Roles) => Promise<boolean>;
};

async function enrichWithStatus(users: User[], userStatusService: UserStatusService): Promise<User[]> {
    if (!users.length) return users;
    const statuses = await userStatusService.getStatuses(users.map((user) => user.eId));
    return users.map((user) => ({ ...user, status: statuses.get(user.eId) ?? "offline" }));
}

async function enrichTeamMembers(team: TeamMembers, userStatusService: UserStatusService): Promise<TeamMembers> {
    const users = await enrichWithStatus(team.users, userStatusService);
    return { ...team, users };
}

export function makeTeamsService(
    teamsRepo: TeamsRepo,
    userStatusService: UserStatusService,
): TeamsService {
    const assertTeamAccess = async (teamId: number, authEId: string, authRole: Roles): Promise<TeamMembers> => {
        const team = await teamsRepo.getTeamById(teamId);
        if (!team) throw new NotFoundError("Team not found");

        const isAdmin = authRole === Roles.ADMIN;
        const isMember = team.users.some((user) => user.eId === authEId);

        if (!isAdmin && !isMember) {
            throw new ForbiddenError("Solo miembros del team o administradores pueden realizar esta accion");
        }

        return team;
    };

    const getAllTeams = async (name?: string): Promise<Team[]> => teamsRepo.getAllTeams(name);

    const getMyTeams = async (userId: string): Promise<Team[]> => {
        if (!userId) throw new BadRequestError("User id is required");
        return teamsRepo.getMyTeams(userId);
    };

    const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => teamsRepo.getTeamMembers(teamId);

    const getTeamById = async (teamId: number): Promise<TeamMembers> => {
        const team = await teamsRepo.getTeamById(teamId);
        if (!team) throw new NotFoundError("Team not found");
        return enrichTeamMembers(team, userStatusService);
    };

    const createTeam = async (name: string, description: string, memberEIds: string[]): Promise<TeamMembers> => {
        const team = await teamsRepo.createTeam(name, description, memberEIds);
        return enrichTeamMembers(team, userStatusService);
    };

    const updateTeam = async (
        teamId: number,
        authEId: string,
        authRole: Roles,
        patch: UpdateTeam,
    ): Promise<TeamMembers> => {
        const currentTeam = await assertTeamAccess(teamId, authEId, authRole);
        const currentMemberIds = new Set(currentTeam.users.map((user) => user.eId));

        const nextName = patch.name !== undefined && patch.name !== currentTeam.name ? patch.name : undefined;
        const nextDescription = patch.description !== undefined && patch.description !== currentTeam.description ? patch.description : undefined;

        const addMemberEIds = patch.addMemberEIds
            ? [...new Set(patch.addMemberEIds)].filter((memberEId) => !currentMemberIds.has(memberEId))
            : [];
        const removeMemberEIds = patch.removeMemberEIds
            ? [...new Set(patch.removeMemberEIds)].filter((memberEId) => currentMemberIds.has(memberEId))
            : [];

        if (
            nextName === undefined &&
            nextDescription === undefined &&
            addMemberEIds.length === 0 &&
            removeMemberEIds.length === 0
        ) {
            throw new UnprocessableError("No fields to update");
        }

        let updatedTeam = currentTeam;

        if (nextName !== undefined || nextDescription !== undefined) {
            const renamed = await teamsRepo.updateTeam(teamId, nextName, nextDescription);
            if (!renamed) throw new NotFoundError("Team not found");
            updatedTeam = renamed;
        }

        if (addMemberEIds.length > 0) {
            updatedTeam = await teamsRepo.addTeamMembers(teamId, addMemberEIds);
        }

        if (removeMemberEIds.length > 0) {
            updatedTeam = await teamsRepo.removeTeamMembers(teamId, removeMemberEIds);
        }

        return enrichTeamMembers(updatedTeam, userStatusService);
    };

    const removeTeam = async (teamId: number, authEId: string, authRole: Roles): Promise<boolean> => {
        await assertTeamAccess(teamId, authEId, authRole);
        return teamsRepo.removeTeam(teamId);
    };

    return {
        getAllTeams,
        getMyTeams,
        getTeamMembers,
        getTeamById,
        createTeam,
        updateTeam,
        removeTeam,
    };
}
