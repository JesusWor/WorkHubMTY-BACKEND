import { TypedEventEmitter } from "./typed-event-emitter.js";
import type { TeamMembers } from "../../modules/teams/teams.schema.js";

export type TeamEventMap = {
    "team.created": [team: TeamMembers];
    "team.updated": [team: TeamMembers];
    "team.deleted": [teamId: number];

    "team.memberAdded": [team: TeamMembers];
    "team.memberRemoved": [team: TeamMembers];
};

export const teamEvents = new TypedEventEmitter<TeamEventMap>();