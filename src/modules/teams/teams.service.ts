import { enrichWithStatus } from "../user/user.service.js";
import type { TeamsRepo } from "./teams.repo.js";
import { TeamMember, TeamMembers } from "./teams.schema.js";
import { NotFoundError } from "../../shared/errors/AppError.js";
import { UserStatusService } from "../user/user-status.service.js";

export type TeamsService = {
  getTeamMembers: (teamId: string) => Promise<TeamMember[]>;
  createTeam: (
    name: string,
    description: string,
    memberEIds: string[],
  ) => Promise<TeamMembers>;
  getTeamById: (groupId: number) => Promise<TeamMembers>;
};

export const enrichGroupMembers = async (
  group: TeamMembers,
  userStatusService: UserStatusService,
): Promise<TeamMembers> => {
  const enrichedUsers = await enrichWithStatus(group.users, userStatusService);
  return { ...group, users: enrichedUsers };
};

export function makeTeamsService(
  teamsRepo: TeamsRepo,
  userStatusService: UserStatusService,
): TeamsService {
  
  const getTeamMembers = (teamId: string) => {
    return teamsRepo.getTeamMembers(teamId);
  };
  
  const createTeam = async (
    name: string,
    description: string,
    memberEIds: string[],
  ): Promise<TeamMembers> => {
    const group = await teamsRepo.createGroup(name, description, memberEIds);
    return enrichGroupMembers(group, userStatusService);
  };

  const getTeamById = async (groupId: number): Promise<TeamMembers> => {
    const group = await teamsRepo.getTeamById(groupId);
    if (!group) throw new NotFoundError("Grupo no encontrado");
    return enrichGroupMembers(group, userStatusService);
  };

  return {
    getTeamMembers,
    createTeam,
    getTeamById,
  };
}
