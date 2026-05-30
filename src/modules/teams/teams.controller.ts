import { Request, Response } from "express";
import type { TeamsService } from "./teams.service.js";
import { CreateGroupSchema, teamIdSchema } from "./teams.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import { z } from "zod";
export type TeamsController = {
  getTeamMembers: (req: Request, res: Response) => Promise<void>;
  getTeamById: (req: Request, res: Response) => Promise<void>;
  createTeam: (req: Request, res: Response) => Promise<void>;
};

export function makeTeamsController(service: TeamsService): TeamsController {
  const parseGroupId = (req: Request, res: Response): number | null => {
    const parsed = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(req.params.teamId);
    if (!parsed.success) {
      GlobalResponse.badRequest(res, "teamId must be a positive integer");
      return null;
    }
    return parsed.data;
  };

  const getTeamMembers = async (req: Request, res: Response) => {
    const teamId = teamIdSchema.parse(req.params.teamId);
    const members = await service.getTeamMembers(teamId);
    GlobalResponse.okWithData(res, members);
  };

  const getTeamById = async (req: Request, res: Response): Promise<void> => {
    const teamId = parseGroupId(req, res);
    if (teamId === null) return;
    const team = await service.getTeamById(teamId);
    GlobalResponse.okWithData(res, team);
  };

  const createTeam = async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      GlobalResponse.zodError(res, parsed.error);
      return;
    }
    const { name, description, memberEIds } = parsed.data;
    const group = await service.createTeam(name, description, memberEIds);
    GlobalResponse.okWithData(res, group);
  };

  return {
    getTeamMembers,
    getTeamById,
    createTeam,
  };
}
