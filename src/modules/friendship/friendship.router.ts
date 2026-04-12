import { Router } from "express";
import { FriendshipController } from "./friendship.controller";
import { authenticate, authorize, Roles } from "../../middleware";

export type FriendshipRouter = {
    router: Router;
}

export function makeFriendshipRouter(controller: FriendshipController): FriendshipRouter {
    const router = Router();

    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN]}), controller.getAll);
    router.get("/me", authenticate, authorize({allow: [Roles.ADMIN, Roles.USER]}), controller.getMine);
    
    // Admin: crear amistad directa
    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN]}), controller.createFriendship);
    router.delete("/", authenticate, authorize({allow: [Roles.ADMIN, Roles.USER]}), controller.removeFriendship);
    
    router.get("/requests/received", authenticate, authorize({allow: [Roles.ADMIN, Roles.USER]}), controller.getReceivedRequests);
    router.get("/requests/sent", authenticate, authorize({allow: [Roles.ADMIN, Roles.USER]}), controller.getSentRequests);
    
    router.post("/requests", authenticate, authorize({allow: [Roles.ADMIN, Roles.USER]}), controller.createRequest);
    router.delete("/requests", authenticate, authorize({allow: [Roles.ADMIN, Roles.USER]}), controller.removeRequest);


    return { router }
}