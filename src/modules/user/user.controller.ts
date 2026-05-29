import { UserService } from "./user.service.js";
import { Request, Response } from "express";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import { z } from "zod";
import { CreateUserSchema, CreateGuestSchema, UpdateGuestSchema } from "./user.schema.js";
import { CreateGroupSchema, GroupMembersBodySchema, UpdateGroupSchema } from "../teams/teams.schema.js";
import { mapRole } from "../../middleware/index.js";

export type UserController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;
    getUsers: (req: Request, res: Response) => Promise<void>;

    getMyFriendships: (req: Request, res: Response) => Promise<void>;
    getUserFriendships: (req: Request, res: Response) => Promise<void>;

    getAllByName: (req: Request, res: Response) => Promise<void>;

    getMyFullProfile: (req: Request, res: Response) => Promise<void>;
    getUserFullProfile: (req: Request, res: Response) => Promise<void>;

    // Groups
    getAllGroups: (req: Request, res: Response) => Promise<void>;
    getMyGroups: (req: Request, res: Response) => Promise<void>;
    updateGroup: (req: Request, res: Response) => Promise<void>;
    removeGroup: (req: Request, res: Response) => Promise<void>;
    addGroupMembers: (req: Request, res: Response) => Promise<void>;
    removeGroupMembers: (req: Request, res: Response) => Promise<void>;

    // Guests
    getAllGuests: (req: Request, res: Response) => Promise<void>;
    getGuestById: (req: Request, res: Response) => Promise<void>;
    createGuest: (req: Request, res: Response) => Promise<void>;
    updateGuest: (req: Request, res: Response) => Promise<void>;
    removeGuest: (req: Request, res: Response) => Promise<void>;

    TEMPORARY_CREATE?: (req: Request, res: Response) => Promise<void>;
}

export function makeUserController(service: UserService): UserController {

    // Helpers

    const requireAuth = (req: Request, res: Response) => {
        const authEId = req.user?.eId;
        const authRoleRaw = req.user?.role;
        if (!authEId || !authRoleRaw) {
            GlobalResponse.unauthorized(res);
            return null;
        }
        return { authEId, authRole: mapRole(authRoleRaw) };
    };

    const parseGroupId = (req: Request, res: Response): number | null => {
        const parsed = z.coerce.number().int().positive().safeParse(req.params.groupId);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, "groupId must be a positive integer");
            return null;
        }
        return parsed.data;
    };

    const parseGuestId = (req: Request, res: Response): number | null => {
        const parsed = z.coerce.number().int().positive().safeParse(req.params.guestId);
        if (!parsed.success) {
            GlobalResponse.badRequest(res, "guestId must be a positive integer");
            return null;
        }
        return parsed.data;
    };

    // Users

    const getAll = async (_req: Request, res: Response): Promise<void> => {
        const users = await service.getAll();
        GlobalResponse.okWithData(res, users);
    };

    const getById = async (req: Request, res: Response): Promise<void> => {
        if (!req.params.eId) {
            GlobalResponse.badRequest(res, "User eId is required");
            return;
        }
        const eId = z.string().min(1).parse(req.params.eId);
        const user = await service.getById(eId);
        if (!user) {
            GlobalResponse.notFound(res, "User not found");
            return;
        }
        GlobalResponse.okWithData(res, user);
    };

    const getFriends = async (eId: string) => service.getUserFriends(eId);

    const getMyFriendships = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;
        const friends = await getFriends(auth.authEId);
        GlobalResponse.okWithData(res, friends);
    };

    const getUserFriendships = async (req: Request, res: Response): Promise<void> => {
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
        const name = z.string().min(1).parse(req.params.name);
        const users = await service.getAllByName(name);
        GlobalResponse.okWithData(res, users);
    };

    const getMyFullProfile = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;
        const profile = await service.getFullProfile(auth.authEId, auth.authEId);
        GlobalResponse.okWithData(res, profile);
    };

    const getUserFullProfile = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;
        const requestedEId = req.params.eId ? z.string().min(1).parse(req.params.eId) : auth.authEId;
        const profile = await service.getFullProfile(requestedEId, auth.authEId);
        GlobalResponse.okWithData(res, profile);
    };

    const getUsers = async (req: Request, res: Response): Promise<void> => {
        const query = req.query.query ? z.string().parse(req.query.query) : undefined;
        const excludeId = req.query.excludeId ? z.string().parse(req.query.excludeId) : undefined;
        const users = await service.getUsers(query, excludeId);
        GlobalResponse.okWithData(res, users);
    }

    // Groups

    const getAllGroups = async (_req: Request, res: Response): Promise<void> => {
        const groups = await service.getAllGroups();
        GlobalResponse.okWithData(res, groups);
    };

    const getMyGroups = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const groups = await service.getMyGroups(auth.authEId);
        GlobalResponse.okWithData(res, groups);
    };

    const updateGroup = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const groupId = parseGroupId(req, res);
        if (groupId === null) return;

        const parsed = UpdateGroupSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const updated = await service.updateGroup(groupId, auth.authEId, auth.authRole, parsed.data.name, parsed.data.description);
        GlobalResponse.okWithData(res, updated);
    };

    const removeGroup = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const groupId = parseGroupId(req, res);
        if (groupId === null) return;

        await service.removeGroup(groupId, auth.authEId, auth.authRole);
        GlobalResponse.ok(res);
    };

    const addGroupMembers = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const groupId = parseGroupId(req, res);
        if (groupId === null) return;

        const parsed = GroupMembersBodySchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const updated = await service.addGroupMembers(groupId, auth.authEId, auth.authRole, parsed.data.memberEIds);
        GlobalResponse.okWithData(res, updated);
    };

    const removeGroupMembers = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const groupId = parseGroupId(req, res);
        if (groupId === null) return;

        const parsed = GroupMembersBodySchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const updated = await service.removeGroupMembers(groupId, auth.authEId, auth.authRole, parsed.data.memberEIds);
        GlobalResponse.okWithData(res, updated);
    };

    // Guests

    const getAllGuests = async (_req: Request, res: Response): Promise<void> => {
        const guests = await service.getAllGuests();
        GlobalResponse.okWithData(res, guests);
    };

    const getGuestById = async (req: Request, res: Response): Promise<void> => {
        const guestId = parseGuestId(req, res);
        if (guestId === null) return;
        const guest = await service.getGuestById(guestId);
        GlobalResponse.okWithData(res, guest);
    };

    const createGuest = async (req: Request, res: Response): Promise<void> => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const parsed = CreateGuestSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const guest = await service.createGuest(parsed.data.name, parsed.data.email, auth.authEId);
        GlobalResponse.okWithData(res, guest);
    };

    const updateGuest = async (req: Request, res: Response): Promise<void> => {
        const guestId = parseGuestId(req, res);
        if (guestId === null) return;

        const parsed = UpdateGuestSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const updated = await service.updateGuest(guestId, parsed.data.name, parsed.data.email);
        GlobalResponse.okWithData(res, updated);
    };

    const removeGuest = async (req: Request, res: Response): Promise<void> => {
        const guestId = parseGuestId(req, res);
        if (guestId === null) return;
        await service.removeGuest(guestId);
        GlobalResponse.ok(res);
    };

    // Temp

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
        getAllGroups,
        getMyGroups,
        getUsers,
        updateGroup,
        removeGroup,
        addGroupMembers,
        removeGroupMembers,
        getAllGuests,
        getGuestById,
        createGuest,
        updateGuest,
        removeGuest,
        TEMPORARY_CREATE,
    };
}
