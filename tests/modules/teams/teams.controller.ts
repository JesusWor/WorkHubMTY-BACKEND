import { Request, Response } from "express";
import { z } from "zod";
import type { TeamsService } from "./teams.service.js";
import { CreateTeamSchema, ListTeamsQuerySchema, TeamIdSchema, UpdateTeamSchema } from "./teams.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import { mapRole } from "../../middleware/index.js";

export type TeamsController = {
    getAllTeams: (req: Request, res: Response) => Promise<void>;
    getMyTeams: (req: Request, res: Response) => Promise<void>;
    getTeamMembers: (req: Request, res: Response) => Promise<void>;
    getTeamById: (req: Request, res: Response) => Promise<void>;
    createTeam: (req: Request, res: Response) => Promise<void>;
    updateTeam: (req: Request, res: Response) => Promise<void>;
    removeTeam: (req: Request, res: Response) => Promise<void>;
};

export function makeTeamsController(service: TeamsService): TeamsController {
    const requireAuth = (req: Request, res: Response) => {
        const authEId = req.user?.eId;
        const authRoleRaw = req.user?.role;
        if (!authEId || !authRoleRaw) {
            GlobalResponse.unauthorized(res);
            return null;
        }
        return { authEId, authRole: mapRole(authRoleRaw) };
    };

    const parseTeamId = (req: Request, res: Response): number | null => {
        const parsed = z.coerce.number().int().positive().safeParse(req.params.teamId);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, "teamId must be a positive integer");
            return null;
        }
        return parsed.data;
    };

    const getAllTeams = async (_req: Request, res: Response): Promise<void> => {
        const parsed = ListTeamsQuerySchema.safeParse(_req.query);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const teams = await service.getAllTeams(parsed.data.name);
        GlobalResponse.okWithData(res, teams);
    };

    const getMyTeams = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const teams = await service.getMyTeams(auth.authEId);
        GlobalResponse.okWithData(res, teams);
    };

    const getTeamMembers = async (req: Request, res: Response): Promise<void> => {
        const teamId = TeamIdSchema.safeParse(req.params.teamId);
        if (!teamId.success) {
            GlobalResponse.badRequest(res, "teamId must be a positive string");
            return;
        }

        const members = await service.getTeamMembers(teamId.data);
        GlobalResponse.okWithData(res, members);
    };

    const getTeamById = async (req: Request, res: Response): Promise<void> => {
        const teamId = parseTeamId(req, res);
        if (teamId === null) return;

        const team = await service.getTeamById(teamId);
        GlobalResponse.okWithData(res, team);
    };

    const createTeam = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateTeamSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const { name, description, memberEIds } = parsed.data;
        const team = await service.createTeam(name, description, memberEIds);
        GlobalResponse.okWithData(res, team);
    };

    const updateTeam = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const teamId = parseTeamId(req, res);
        if (teamId === null) return;

        const parsed = UpdateTeamSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const updated = await service.updateTeam(teamId, auth.authEId, auth.authRole, parsed.data);
        GlobalResponse.okWithData(res, updated);
    };

    const removeTeam = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const teamId = parseTeamId(req, res);
        if (teamId === null) return;

        await service.removeTeam(teamId, auth.authEId, auth.authRole);
        GlobalResponse.ok(res);
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
