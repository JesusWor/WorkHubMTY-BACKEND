import { Db } from "../../infra/db/db";
import { Friendship, FriendDTO, FriendRequest, Source } from "./friendship.schema";

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
};

export function makeFriendshipRepo(db: Db): FriendshipRepo {

    const getAll = async (): Promise<Friendship[]> => {
        const { rows } = await db.query(`
            SELECT
                user_low AS userLow,
                user_high AS userHigh,
                source,
                create_time AS createdAt
            FROM friendships
        `);
        return rows as Friendship[];
    };

    const getFriendsOf = async (eId: string): Promise<FriendDTO[]> => {
        const { rows } = await db.query(`
            SELECT
                u.e_id AS userId,
                u.name AS name,
                u.email AS email,
                f.create_time AS createdAt
            FROM friendships f
            JOIN users u
                ON (
                    (f.user_low = ? AND u.e_id = f.user_high)
                    OR
                    (f.user_high = ? AND u.e_id = f.user_low)
                )
            WHERE f.user_low = ? OR f.user_high = ?
        `, [eId, eId, eId, eId]);
        return rows as FriendDTO[];
    };

    const createFriendship = async (userLow: string, userHigh: string, source: Source): Promise<Friendship | null> => {
        const { rows: existing } = await db.query(`
            SELECT user_low FROM friendships
            WHERE user_low = ? AND user_high = ?
        `, [userLow, userHigh]);

        if (existing.length > 0) return null;

        await db.query(`
            INSERT INTO friendships (user_low, user_high, source)
            VALUES (?, ?, ?)
        `, [userLow, userHigh, source]);

        const { rows } = await db.query(`
            SELECT
                user_low AS userLow,
                user_high AS userHigh,
                source,
                create_time AS createdAt
            FROM friendships
            WHERE user_low = ? AND user_high = ?
        `, [userLow, userHigh]);

        return rows.length > 0 ? (rows[0] as Friendship) : null;
    };

    const removeFriendship = async (userLow: string, userHigh: string): Promise<boolean> => {
        const { rows } = await db.query(`
            DELETE FROM friendships
            WHERE user_low = ? AND user_high = ?
        `, [userLow, userHigh]);

        return (rows as any).affectedRows > 0;
    };

    const getReceivedRequests = async (eId: string): Promise<FriendRequest[]> => {
        const { rows } = await db.query(`
            SELECT
                from_user AS fromUser,
                to_user AS toUser,
                create_time AS createdAt
            FROM friend_requests
            WHERE to_user = ?
        `, [eId]);
        return rows as FriendRequest[];
    };

    const getSentRequests = async (eId: string): Promise<FriendRequest[]> => {
        const { rows } = await db.query(`
            SELECT
                from_user AS fromUser,
                to_user AS toUser,
                create_time AS createdAt
            FROM friend_requests
            WHERE from_user = ?
        `, [eId]);
        return rows as FriendRequest[];
    };

    const createRequest = async (fromUser: string, toUser: string): Promise<FriendRequest | null> => {
        const { rows: existing } = await db.query(`
            SELECT from_user FROM friend_requests
            WHERE from_user = ? AND to_user = ?
        `, [fromUser, toUser]);

        if (existing.length > 0) return null;

        await db.query(`
            INSERT INTO friend_requests (from_user, to_user)
            VALUES (?, ?)
        `, [fromUser, toUser]);

        const { rows } = await db.query(`
            SELECT
                from_user AS fromUser,
                to_user AS toUser,
                create_time AS createdAt
            FROM friend_requests
            WHERE from_user = ? AND to_user = ?
        `, [fromUser, toUser]);

        return rows.length > 0 ? (rows[0] as FriendRequest) : null;
    };

    const removeRequest = async (user1: string, user2: string): Promise<boolean> => {
        const { rows } = await db.query(`
            DELETE FROM friend_requests
            WHERE (from_user = ? AND to_user = ?)
               OR (from_user = ? AND to_user = ?)
        `, [user1, user2, user2, user1]);

        return (rows as any).affectedRows > 0;
    };

    return {
        getAll,
        getFriendsOf,
        createFriendship,
        removeFriendship,
        getReceivedRequests,
        getSentRequests,
        createRequest,
        removeRequest,
    };
}
