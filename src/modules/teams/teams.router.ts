import { Router } from "express";
import type { TeamsController } from "./teams.controller.js";
import { authenticate, authorize, Roles, RolePolicy, asyncHandler } from "../../middleware/index.js";

export function makeTeamsRouter(controller: TeamsController): Router {
    const router = Router();
    const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };

    router.get("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getAllTeams));
    router.get("/me", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getMyTeams));
    router.get("/:teamId/members", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getTeamMembers));
    router.get("/:teamId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.getTeamById));
    router.post("/", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.createTeam));
    router.patch("/:teamId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.updateTeam));
    router.delete("/:teamId", authenticate, authorize(NOT_GUEST_POLICY), asyncHandler(controller.removeTeam));

    return router;
}
