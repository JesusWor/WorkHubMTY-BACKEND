import type { TeamsRepo } from "./teams.repo.js";
import { TeamMember } from "./teams.schema.js";

export type TeamsService = {
    getTeamMembers: (teamId:string)=> Promise<TeamMember[]>
}

export function makeTeamsService(teamsRepo:TeamsRepo):TeamsService{
    const getTeamMembers=(teamId:string)=>{
        return teamsRepo.getTeamMembers(teamId);
    }

    return {
        getTeamMembers
    }
}