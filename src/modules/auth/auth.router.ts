import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { asyncHandler } from "../../middleware/index.js";

export function makeAuthRouter(controller: AuthController): Router {
    const router = Router();

    router.post("/login", asyncHandler(controller.login));
    router.post("/refresh", asyncHandler(controller.refresh));
    router.post("/logout", asyncHandler(controller.logout));

    return router;
}
