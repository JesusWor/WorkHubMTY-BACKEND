// import { UserService } from "./user.service";
import { Request, Response } from "express";
import { FriendshipService } from "./friendship.service";
import { Roles } from "../../middleware";
import { GlobalResponse } from "../../shared/response/globalresponse";
import { z } from "zod";

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
    removeRequest:  (req: Request, res: Response) => Promise<void>;
}

export function makeFriendshipController(service: FriendshipService) {
    const getAll = async (req: Request, res: Response) : Promise<void> => {
        try {
            
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    }
    return {
        
    }
}
// if (!req.user || req.user.role != Roles.ADMIN) return GlobalResponse.