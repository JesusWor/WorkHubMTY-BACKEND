import { Router } from "express";
import { TeamsController } from "./teams.controller.js";
import {
  authenticate,
  authorize,
  Roles,
  asyncHandler,
  RolePolicy,
} from "../../middleware/index.js";

export function makeTeamsRouter(controller: TeamsController): Router {
  const NOT_GUEST_POLICY: RolePolicy = { deny: [Roles.GUEST] };
  const ADMIN_ONLY_POLICY: RolePolicy = { allow: [Roles.ADMIN] };
  const router = Router();

  router.get(
    "/:teamId/members",
    authenticate,
    authorize({ allow: [Roles.ADMIN, Roles.IT, Roles.USER] }),
    asyncHandler(controller.getTeamMembers),
  );

  router.get(
    "/:teamId",
    authenticate,
    authorize(NOT_GUEST_POLICY),
    asyncHandler(controller.getTeamById),
  );

  router.post(
    "/",
    authenticate,
    authorize(NOT_GUEST_POLICY),
    asyncHandler(controller.createTeam),
  );

  router.get(
    "/:teamId/members",
    authenticate,
    authorize(NOT_GUEST_POLICY),
    asyncHandler(controller.getTeamMembers),
  );

  return router;
}
