import { Router } from "express";
import { FriendshipController } from "./friendship.controller";
import { authMiddleware, roleMiddleware, Roles } from "../../middleware";

export type FriendshipRouter = {
    router: Router;
}

export function makeFriendshipRouter(controller: FriendshipController): FriendshipRouter {
    const router = Router();

    router.get("/", authMiddleware, roleMiddleware(Roles.ADMIN), controller.getAll);
    router.get("/me", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getMine);
    
    // Admin: crear amistad directa
    router.post("/", authMiddleware, roleMiddleware(Roles.ADMIN), controller.createFriendship);
    router.delete("/", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.removeFriendship);
    
    router.get("/requests/received", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getReceivedRequests);
    router.get("/requests/sent", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.getSentRequests);
    
    router.post("/requests", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.createRequest);
    router.delete("/requests", authMiddleware, roleMiddleware(Roles.ADMIN, Roles.USER), controller.removeRequest);


    return { router }
}