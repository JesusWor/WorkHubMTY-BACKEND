import { Db } from "../../infra/db/db.js";
import { TeamMember } from "./teams.schema.js";

export type TeamsRepo = {
    getTeamMembers:(teamId:string)=>Promise<TeamMember[]>;
}

export function makeTeamsRepo(db:Db) : TeamsRepo {
    const getTeamMembers = async (teamId:string) => {
        const {rows} = await db.query(`
            SELECT 
                id,
                name,
                COUNT(members.userId) AS membersCount
            FROM work_groups teams
            JOIN work_group_members members ON 
                teams.id = members.workGroupId
            WHERE teams.id = ?
            GROUP BY teams.id;
        `, [teamId] );

        return rows;
    }

    return {
        getTeamMembers
    }
}