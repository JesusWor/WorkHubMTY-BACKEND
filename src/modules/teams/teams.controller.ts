import { Request } from "express";
import type { TeamsService } from "./teams.service.js";
import { teamIdSchema } from "./teams.schema.js";
 
export type TeamsController = {
    getTeamMembers: (req:Request) => Promise<any>
}

export function makeTeamsController(service:TeamsService):TeamsController{
    const getTeamMembers = async (req:Request) => {
        const teamId = teamIdSchema.parse(req.params);
        return service.getTeamMembers(teamId);
    }

    return {
        getTeamMembers
    }
}
