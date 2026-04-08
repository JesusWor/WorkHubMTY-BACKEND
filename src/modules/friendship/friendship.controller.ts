import { Request, Response } from "express";
import { FriendshipService } from "./friendship.service";
import { GlobalResponse } from "../../shared/response/globalresponse";
import {
    CreateFriendRequestSchema,
    RemoveRelationSchema,
} from "./friendship.schema";

export type FriendshipController = {
    // Friendships
    getAll: (req: Request, res: Response) => Promise<void>;
    getMine: (req: Request, res: Response) => Promise<void>;
    createFriendship: (req: Request, res: Response) => Promise<void>;
    removeFriendship: (req: Request, res: Response) => Promise<void>;

    // Requests
    getReceivedRequests: (req: Request, res: Response) => Promise<void>;
    getSentRequests: (req: Request, res: Response) => Promise<void>;
    createRequest: (req: Request, res: Response) => Promise<void>;
    removeRequest: (req: Request, res: Response) => Promise<void>;
};

export function makeFriendshipController(service: FriendshipService): FriendshipController {

    // GET /friendships — solo ADMIN
    const getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const friendships = await service.getAll();
            GlobalResponse.okWithData(res, friendships);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // GET /friendships/me — usuario autenticado ve sus amigos
    const getMine = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const friends = await service.getFriendsOf(req.user.eId);
            GlobalResponse.okWithData(res, friends);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // POST /friendships — ADMIN crea amistad directa entre dos usuarios
    const createFriendship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userLow, userHigh } = req.body;

            if (!userLow || !userHigh) {
                GlobalResponse.badRequest(res, "userLow and userHigh are required");
                return;
            }

            const friendship = await service.createFriendship(userLow, userHigh, "ADMIN");
            GlobalResponse.created(res, friendship);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // DELETE /friendships — usuario o admin elimina una amistad
    const removeFriendship = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const parsed = RemoveRelationSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.zodError(res, parsed.error);
                return;
            }

            await service.removeFriendship(req.user.eId, parsed.data.userId);
            GlobalResponse.ok(res, "Friendship removed");
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // GET /friendships/requests/received
    const getReceivedRequests = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const requests = await service.getReceivedRequests(req.user.eId);
            GlobalResponse.okWithData(res, requests);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // GET /friendships/requests/sent
    const getSentRequests = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const requests = await service.getSentRequests(req.user.eId);
            GlobalResponse.okWithData(res, requests);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // POST /friendships/requests — usuario envía solicitud de amistad
    const createRequest = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const parsed = CreateFriendRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.zodError(res, parsed.error);
                return;
            }

            const request = await service.createRequest(req.user.eId, parsed.data.toUser);
            GlobalResponse.created(res, request);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    // DELETE /friendships/requests — cancelar/rechazar solicitud
    const removeRequest = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                GlobalResponse.unauthorized(res);
                return;
            }

            const parsed = RemoveRelationSchema.safeParse(req.body);
            if (!parsed.success) {
                GlobalResponse.zodError(res, parsed.error);
                return;
            }

            await service.removeRequest(req.user.eId, parsed.data.userId);
            GlobalResponse.ok(res, "Friend request removed");
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    };

    return {
        getAll,
        getMine,
        createFriendship,
        removeFriendship,
        getReceivedRequests,
        getSentRequests,
        createRequest,
        removeRequest,
    };
}
