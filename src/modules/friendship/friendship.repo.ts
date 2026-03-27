import { Db } from "../../infra/db/db.js";
import { Friendship, FriendDTO, FriendRequest, Source } from "./friendship.schema.js";

export type FriendshipRepo = {
    // Friendships
    getAll: () => Promise<Friendship[]>;
    getFriendsOf: (eId: string) => Promise<FriendDTO[]>;
    createFriendship: (userLow: string, userHigh: string, source: Source) => Promise<Friendship | null>;
    removeFriendship: (userLow: string, userHigh: string) => Promise<boolean>;

    // Requests
    getReceivedRequests: (eId: string) => Promise<FriendRequest[]>;
    getSentRequests: (eId: string) => Promise<FriendRequest[]>;
    createRequest: (fromUser: string, toUser: string) => Promise<FriendRequest | null>;
    removeRequest: (user1: string, user2: string) => Promise<boolean>;

}

export function makeFriendshipRepo(db: Db): FriendshipRepo {
    const getAll = async (): Promise<Friendship[]> => {
        const { rows } = await db.query(`
            SELECT
                user_low as userLow,
                user_high as userHigh,
                source
                create_time as createdAt,
            FROM friendships
        `);
        return rows as Friendship[];
    }

    const getFriendsOf = async (eId: string): Promise<FriendDTO[]> => {
        const { rows } = await db.query(`
            SELECT
                u.e_id as userId,
                u.name as name,
                u.email as email,
                f.create_time as createdAt
            FORM friendships f
            JOIN users u
                ON (
                    (f.user_low = ? AND u.e_id = f.user_high)
                    OR
                    (f.user_high = ? AND u.e_id = f.user_low)
                )
            WHERE f.user_low = ? OR f.user_high = ?
        `, []);
        return rows as FriendDTO[];
    }

    const createFriendship = async (userLow: string, userHigh: string, source: Source): Promise<Friendship | null> => {
        return null;
    }

    const removeFriendship = async (userLow: string, userHigh: string): Promise<boolean> => {
        return false;
    }

    const getReceivedRequests = async (eId: string): Promise<FriendRequest[]> => {
        const { rows } = await db.query(`
            SELECT
                from_user as fromUser,
                to_user as toUser,
                create_time as createdAt
            FROM friend_requests
            WHERE to_user = ?
        `, [eId])
        return rows as FriendRequest[];
    }

    const getSentRequests = async (eId: string): Promise<FriendRequest[]> => {
        const { rows } = await db.query(`
            SELECT
                from_user as fromUser,
                to_user as toUser,
                create_time as createdAt
            FROM friend_requests
            WHERE from_user = ?
        `, [eId])
        return rows as FriendRequest[];
    }

    const createRequest = async (fromUser: string, toUser: string): Promise<FriendRequest | null> => {

    }

    const removeRequest = async (user1: string, user2: string): Promise<boolean> => {

    }


    return {

    }
}

const getAll = async (): Promise<Role[]> => {
    const { rows } = await db.query("SELECT * FROM roles");
    return rows as Role[];
}

const getById = async (id: number): Promise<Role | null> => {
    const { rows } = await db.query("SELECT * FROM roles WHERE id = ?", [id]);
    return rows.length > 0 ? rows[0] : null;
}

const create = async (role: CreateRole): Promise<Role | null> => {
    const { insertId } = await db.execute("INSERT INTO roles (name) VALUES (?)", [role.name]);

    if (!insertId) return null;

    return await getById(insertId);
}