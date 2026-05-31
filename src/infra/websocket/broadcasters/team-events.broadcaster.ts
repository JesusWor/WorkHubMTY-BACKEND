import { teamEvents } from "../../events/team-events.emitter.js";
import { getIO, Rooms } from "../socket.server.js";
import type {
    TeamPublicUpdate,
    TeamMembersUpdate,
    AdminUpdateMessage,
} from "../socket.types.js";
import type { Team, TeamMembers } from "../../../modules/teams/teams.schema.js";

function toPublicTeam(team: TeamMembers): Team {
    return {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: team.users.length,
    };
}

function emitPublic(teamId: number, msg: TeamPublicUpdate): void {
    try {
        getIO().to(Rooms.team(teamId)).emit("teamPublicUpdate", msg);
    } catch (err) {
        console.warn("[team-broadcaster] teamPublicUpdate socket no disponible:", (err as Error).message);
    }
}

function emitMembers(teamId: number, msg: TeamMembersUpdate): void {
    try {
        getIO().to(Rooms.teamMembers(teamId)).emit("teamMembersUpdate", msg);
    } catch (err) {
        console.warn("[team-broadcaster] teamMembersUpdate socket no disponible:", (err as Error).message);
    }
}

function emitToAdmin(event: AdminUpdateMessage): void {
    try {
        getIO().to(Rooms.admin).emit("adminUpdate", event);
    } catch (err) {
        console.warn("[team-broadcaster] adminUpdate socket no disponible:", (err as Error).message);
    }
}

export function initTeamBroadcaster(): void {
    teamEvents.on("team.created", (team) => {
        emitToAdmin({ domain: "team", event: { type: "team.created", payload: team } });
    });

    teamEvents.on("team.updated", (team) => {
        const publicMsg: TeamPublicUpdate = { type: "team.updated", payload: toPublicTeam(team) };
        const privateMsg: TeamMembersUpdate = { type: "team.updated", payload: team };

        emitPublic(team.id, publicMsg);
        emitMembers(team.id, privateMsg);
        emitToAdmin({ domain: "team", event: privateMsg });
    });

    teamEvents.on("team.deleted", (teamId) => {
        const msg: TeamPublicUpdate = { type: "team.deleted", payload: { teamId } };
        emitPublic(teamId, msg);
        emitToAdmin({ domain: "team", event: msg });
    });

    teamEvents.on("team.memberAdded", (team) => {
        const msg: TeamMembersUpdate = { type: "team.memberAdded", payload: team };
        emitMembers(team.id, msg);
        emitToAdmin({ domain: "team", event: msg });
        emitPublic(team.id, { type: "team.updated", payload: toPublicTeam(team) });
        addMembersToPrivateRoom(team.id, team.users.map((u) => u.eId));
    });

    teamEvents.on("team.memberRemoved", (team) => {
        const msg: TeamMembersUpdate = { type: "team.memberRemoved", payload: team };
        emitMembers(team.id, msg);
        emitToAdmin({ domain: "team", event: msg });
        emitPublic(team.id, { type: "team.updated", payload: toPublicTeam(team) });
    });
}

function addMembersToPrivateRoom(teamId: number, memberEIds: string[]): void {
    try {
        const io = getIO();
        for (const eId of memberEIds) {
            io.in(Rooms.dm(eId)).socketsJoin(Rooms.teamMembers(teamId));
        }
    } catch (err) {
        console.warn("[team-broadcaster] addMembersToPrivateRoom failed:", (err as Error).message);
    }
}
