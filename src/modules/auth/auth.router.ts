import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authenticate, asyncHandler } from "../../middleware";

export function makeAuthRouter(controller: AuthController): Router {
    const router = Router();

    router.post("/login", asyncHandler(controller.login));
    router.post("/logout", authenticate, asyncHandler(controller.logout));

    return router;
}
