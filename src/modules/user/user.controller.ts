import { UserService } from "./user.service.js";
import { Request, Response } from "express";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import { z } from "zod";
import { CreateUserSchema, User } from "./user.schema.js";

export type UserController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;

    getMyFriendships: (req: Request, res: Response) => Promise<void>;
    getUserFriendships: (req: Request, res: Response) => Promise<void>;

    getAllByName: (req: Request, res: Response) => Promise<void>;

    getMyFullProfile: (req: Request, res: Response) => Promise<void>;
    getUserFullProfile: (req: Request, res: Response) => Promise<void>;

    TEMPORARY_CREATE?: (req: Request, res: Response) => Promise<void>;
}

export function makeUserController(service: UserService): UserController {
    const getAll = async (_req: Request, res: Response): Promise<void> => {
        const users = await service.getAll();
        GlobalResponse.okWithData(res, users);
    };

    const getById = async (req: Request, res: Response): Promise<void> => {
        if (!req.params.eId) {
            GlobalResponse.badRequest(res, "User eId is required");
            return;
        }

        // z.string().parse() lanza ZodError — lo captura el errorHandler global
        const eId = z.string().min(1).parse(req.params.eId);

        const user = await service.getById(eId);
        if (!user) {
            GlobalResponse.notFound(res, "User not found");
            return;
        }

        GlobalResponse.okWithData(res, user);
    };

    const getFriends = async (eId: string): Promise<User[]> => {
        return await service.getUserFriends(eId);
    };

    const getMyFriendships = async (req: Request, res: Response): Promise<void> => {
        const authEId = req.user?.eId;
        if (!authEId) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const friends = await getFriends(authEId);

        GlobalResponse.okWithData(res, friends);
    };

    const getUserFriendships = async (req: Request, res: Response) => {
        const paramId = z.string().parse(req.params.id);

        if (!paramId) {
            GlobalResponse.badRequest(res, "User id is required");
            return;
        }

        const friends = await getFriends(paramId);

        GlobalResponse.okWithData(res, friends);
    };

    const getAllByName = async (req: Request, res: Response): Promise<void> => {
        if (!req.params.name) {
            GlobalResponse.badRequest(res, "User name is required");
            return;
        }

        // z.string().parse() lanza ZodError — lo captura el errorHandler global
        const name = z.string().min(1).parse(req.params.name);
        const users = await service.getAllByName(name);
        GlobalResponse.okWithData(res, users);
    };

    const getFullProfile = async (requestedEId: string, authEId: string) => {
        return await service.getFullProfile(requestedEId, authEId);
    };

    const getMyFullProfile = async (req: Request, res: Response): Promise<void> => {
        const authEId = req.user?.eId;
        if (!authEId) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const profile = await getFullProfile(authEId, authEId);
        GlobalResponse.okWithData(res, profile);
    };

    const getUserFullProfile = async (req: Request, res: Response): Promise<void> => {
        const authEId = req.user?.eId;
        if (!authEId) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const requestedEId = req.params.eId ? z.string().min(1).parse(req.params.eId) : authEId;

        const profile = await getFullProfile(requestedEId, authEId);
        GlobalResponse.okWithData(res, profile);
    };

    const TEMPORARY_CREATE = async (req: Request, res: Response): Promise<void> => {
        if (!service.TEMPORARY_CREATE) return;

        const parsed = CreateUserSchema.safeParse(req.body);
        if (!parsed.success || !parsed.data) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const userCreated = await service.TEMPORARY_CREATE(
            parsed.data.eId,
            parsed.data.name,
            parsed.data.email,
            parsed.data.password,
            parsed.data.roleName
        );
        GlobalResponse.okWithData(res, userCreated);
    };

    return {
        getAll,
        getById,
        getMyFriendships,
        getUserFriendships,
        getAllByName,
        getMyFullProfile,
        getUserFullProfile,
        TEMPORARY_CREATE
    };
}
