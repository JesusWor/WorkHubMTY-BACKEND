import { Router } from "express";
import { AuthController } from "./auth.controller.js";

export function makeAuthRouter(controller: AuthController): Router {
    const router = Router();

    router.post("/login", controller.login);

    return router;
}