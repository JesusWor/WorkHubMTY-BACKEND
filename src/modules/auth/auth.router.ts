import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

export function makeAuthRouter(controller: AuthController): Router {
    const router = Router();

    router.post("/login", controller.login);
    router.post("/logout", authenticate, controller.logout);

    return router;
}