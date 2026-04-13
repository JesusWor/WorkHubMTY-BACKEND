import { Router } from "express";
import { FriendshipController } from "./friendship.controller";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware";

export function makeFriendshipRouter(controller: FriendshipController): Router {
    const router = Router();

    router.get("/",
        authenticate, authorize({ allow: [Roles.ADMIN] }),
        asyncHandler(controller.getAll));
    router.get("/me",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }),
        asyncHandler(controller.getMine));

    router.post("/",
        authenticate, authorize({ allow: [Roles.ADMIN] }),
        asyncHandler(controller.createFriendship));
    router.delete("/",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }),
        asyncHandler(controller.removeFriendship));

    router.get("/requests/received",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }),
        asyncHandler(controller.getReceivedRequests));
    router.get("/requests/sent",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }),
        asyncHandler(controller.getSentRequests));

    router.post("/requests",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }),
        asyncHandler(controller.createRequest));
    router.delete("/requests",
        authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }),
        asyncHandler(controller.removeRequest));

    return router;
}
