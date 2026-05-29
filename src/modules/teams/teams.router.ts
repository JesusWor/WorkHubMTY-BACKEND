import {Router} from "express";
import {TeamsController} from "./teams.controller.js";
import {authenticate, authorize, Roles, asyncHandler} from "../../middleware/index.js";

export function makeTeamsRouter(controller: TeamsController): Router {
    const router = Router();
    router.get("/:teamId/members", authenticate, authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }), asyncHandler(controller.getTeamMembers));
    return router;
}