import { Router } from "express";
import { FriendshipController } from "./friendship.controller";
import { authMiddleware, roleMiddleware, Roles } from "../../middleware";

export function makeFriendshipRouter(controller: FriendshipController): Router {
    const router = Router();

    // Friendships
    router.get("/", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.getAll);
    router.get("/me", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.USER] }), controller.getMine);
    router.post("/", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN] }), controller.createFriendship);
    router.delete("/", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.USER] }), controller.removeFriendship);

    // Requests
    router.get("/requests/received", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.USER] }), controller.getReceivedRequests);
    router.get("/requests/sent", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.USER] }), controller.getSentRequests);
    router.post("/requests", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.USER] }), controller.createRequest);
    router.delete("/requests", authMiddleware, roleMiddleware({ allow: [Roles.ADMIN, Roles.USER] }), controller.removeRequest);

    return router;
}
