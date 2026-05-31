import { Request, Response } from "express";
import { FriendshipService } from "./friendship.service.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import {
    CreateFriendRequestSchema,
    AcceptFriendRequestSchema,
    RemoveRelationSchema,
} from "./friendship.schema.js";

export type FriendshipController = {
    // Friendships
    getAll: (req: Request, res: Response) => Promise<void>;
    createFriendship: (req: Request, res: Response) => Promise<void>;
    removeFriendship: (req: Request, res: Response) => Promise<void>;

    // Requests
    getReceivedRequests: (req: Request, res: Response) => Promise<void>;
    getSentRequests: (req: Request, res: Response) => Promise<void>;
    createRequest: (req: Request, res: Response) => Promise<void>;
    acceptRequest: (req: Request, res: Response) => Promise<void>;
    cancelRequest: (req: Request, res: Response) => Promise<void>;
    rejectRequest: (req: Request, res: Response) => Promise<void>;

};

export function makeFriendshipController(service: FriendshipService): FriendshipController {

    // GET /friendships — solo ADMIN
    const getAll = async (_req: Request, res: Response): Promise<void> => {
        const friendships = await service.getAll();
        GlobalResponse.okWithData(res, friendships);
    };

    // POST /friendships — ADMIN crea amistad directa entre dos usuarios
    const createFriendship = async (req: Request, res: Response): Promise<void> => {
        const { userLow, userHigh } = req.body;

        if (!userLow || !userHigh) {
            GlobalResponse.badRequest(res, "userLow and userHigh are required");
            return;
        }

        const friendship = await service.createFriendship(userLow, userHigh, "ADMIN");
        GlobalResponse.created(res, friendship);
    };

    // DELETE /friendships — usuario o admin elimina una amistad
    const removeFriendship = async (req: Request, res: Response): Promise<void> => {
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
    };

    // GET /friendships/requests/received
    const getReceivedRequests = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const requests = await service.getReceivedRequests(req.user.eId);
        GlobalResponse.okWithData(res, requests);
    };

    // GET /friendships/requests/sent
    const getSentRequests = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const requests = await service.getSentRequests(req.user.eId);
        GlobalResponse.okWithData(res, requests);
    };

    // POST /friendships/requests — usuario envía solicitud de amistad
    const createRequest = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const parsed = CreateFriendRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const request = await service.createRequest(req.user.eId, parsed.data.toUserIds);
        GlobalResponse.created(res, request);
    };

    // POST /friendships/requests/received — receptor acepta la solicitud
    const acceptRequest = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const parsed = AcceptFriendRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const friendship = await service.acceptRequest(req.user.eId, parsed.data.fromUser);
        GlobalResponse.created(res, friendship);
    };

    // DELETE /friendships/requests/sent — emisor cancela su solicitud
    const cancelRequest = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const parsed = RemoveRelationSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        await service.cancelRequest(req.user.eId, parsed.data.userId);
        GlobalResponse.ok(res, "Friend request cancelled");
    };

    // DELETE /friendships/requests/received — receptor rechaza la solicitud
    const rejectRequest = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const parsed = RemoveRelationSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        await service.rejectRequest(req.user.eId, parsed.data.userId);
        GlobalResponse.ok(res, "Friend request rejected");
    };

    return {
        getAll,
        createFriendship,
        removeFriendship,
        getReceivedRequests,
        getSentRequests,
        createRequest,
        acceptRequest,
        cancelRequest,
        rejectRequest,
    };
}
