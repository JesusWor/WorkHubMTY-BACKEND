import { Router } from "express";
import { FriendshipController } from "./friendship.controller.js";
import { authenticate, authorize, Roles, asyncHandler } from "../../middleware/index.js";

export function makeFriendshipRouter(controller: FriendshipController): Router {
    const router = Router();

    // Las amistades se manejan por módulo. users/me/friendships (perfiles de amigos), reservations/me/friendships (reservas de amigos)...
    // Esto se convierte en un servicio solo para requests y monitoreo de admin, no para consultar perfiles.

    router.get("/", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.getAll));

    router.post("/", authenticate, authorize({ allow: [Roles.ADMIN] }), asyncHandler(controller.createFriendship));
    router.delete("/", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.removeFriendship));

    router.get("/requests/received", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.getReceivedRequests));
    router.get("/requests/sent", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.getSentRequests));

    router.post("/requests", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.createRequest));
    router.post("/requests/received", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.acceptRequest));
    router.delete("/requests/sent", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.cancelRequest));
    router.delete("/requests/received", authenticate, authorize({ allow: [Roles.ADMIN, Roles.USER] }), asyncHandler(controller.rejectRequest));

    return router;
}
