import { Db } from "../../infra/db/db.js";
import { Friendship, FriendRequest, Source, FriendRequests, SentFriendRequest } from "./friendship.schema.js";

export type FriendshipRepo = {
    // Friendships
    getAll: () => Promise<Friendship[]>;
    getFriendIds: (eId: string) => Promise<string[]>;

    areFriends: (user1: string, user2: string) => Promise<boolean>;
    createFriendship: (userLow: string, userHigh: string, source: Source) => Promise<Friendship | null>;
    removeFriendship: (userLow: string, userHigh: string) => Promise<boolean>;

    // Requests
    getReceivedRequests: (eId: string) => Promise<FriendRequest[]>;
    getSentRequests: (eId: string) => Promise<SentFriendRequest[]>;
    createRequest: (fromUser: string, toUserIds: string[], message?: string | undefined) => Promise<FriendRequests | null>;
    acceptRequest: (toUser: string, fromUser: string) => Promise<FriendRequest | null>;
    cancelRequest: (fromUser: string, toUser: string) => Promise<FriendRequest | null>;
    rejectRequest: (toUser: string, fromUser: string) => Promise<FriendRequest | null>;

};

export function makeFriendshipRepo(db: Db): FriendshipRepo {

    const getAll = async (): Promise<Friendship[]> => {
        const { rows } = await db.query(`
            SELECT
                user_low  AS userLow,
                user_high AS userHigh,
                source,
                create_time AS createdAt
            FROM friendships
        `);
        return rows as Friendship[];
    };

    const getFriendIds = async (eId: string): Promise<string[]> => {
        const { rows } = await db.query(`
            SELECT
                CASE
                    WHEN user_low = ? THEN user_high
                    ELSE user_low
                END AS friendId
            FROM friendships
            WHERE user_low = ? OR user_high = ?
        `, [eId, eId, eId]);
        return (rows as { friendId: string }[]).map(r => r.friendId);
    };


    const areFriends = async (user1: string, user2: string): Promise<boolean> => {
        const [userLow, userHigh] = user1 < user2 ? [user1, user2] : [user2, user1];
        const { rows } = await db.query(`
            SELECT 1
            FROM friendships
            WHERE user_low = ? AND user_high = ?
            LIMIT 1
        `, [userLow, userHigh]);

        return rows.length > 0;
    };

    const createFriendship = async (userLow: string, userHigh: string, source: Source): Promise<Friendship | null> => {
        const result = await db.query(`
            INSERT IGNORE INTO friendships (user_low, user_high, source)
            VALUES (?, ?, ?)
        `, [userLow, userHigh, source]);

        if ((result.rows as any).affectedRows === 0) return null;

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
                id,
                from_user AS fromUser,
                to_user AS toUser,
                status,
                create_time AS createdAt,
                resolved_at AS resolvedAt
            FROM friend_requests
            WHERE to_user = ? AND status = 'PENDING'
        `, [eId]);
        return rows as FriendRequest[];
    };

    const getSentRequests = async (eId: string): Promise<SentFriendRequest[]>=> {
        const { rows } = await db.query(`
            SELECT
                fr.id,
                fr.to_user AS eId,
                u.name,
                u.email,
                fr.status,
                fr.create_time AS createdAt,
                fr.resolved_at AS resolvedAt
            FROM friend_requests fr
            JOIN users u ON fr.to_user = u.e_id
            WHERE from_user = ? AND status = 'PENDING'
        `, [eId]);
        return rows as SentFriendRequest[];
    };

    const createRequest = async (
        fromUser: string,
        toUserIds: string[],
        message?: string,
    ): Promise<FriendRequest[]> => {
        const uniqueToUserIds = [...new Set(toUserIds)].filter(
            (id) => id && id !== fromUser,
        );

        if (uniqueToUserIds.length === 0) return [];

        const values = uniqueToUserIds.flatMap((toUserId) => [
            fromUser,
            toUserId,
            message ?? null,
        ]);

        const placeholders = uniqueToUserIds.map(() => "(?, ?, ?)").join(", ");

        const result = await db.query(
            `
            INSERT IGNORE INTO friend_requests (from_user, to_user, message)
            VALUES ${placeholders}
            `,
            values,
        );

        const affectedRows = (result.rows as any).affectedRows ?? 0;

        if (affectedRows === 0) return [];

        const { rows } = await db.query(
            `
            SELECT
                id,
                from_user AS fromUser,
                to_user AS toUser,
                message,
                status,
                create_time AS createdAt,
                resolved_at AS resolvedAt
            FROM friend_requests
            WHERE from_user = ?
                AND to_user IN (${uniqueToUserIds.map(() => "?").join(", ")})
                AND status = 'pending'
            ORDER BY create_time DESC
            `,
            [fromUser, ...uniqueToUserIds],
        );

        return rows;
    };

    const acceptRequest = async (toUser: string, fromUser: string): Promise<FriendRequest | null> => {
        const { rows } = await db.query(`
            UPDATE friend_requests
            SET status = 'ACCEPTED', resolved_at = NOW()
            WHERE from_user = ? AND to_user = ? AND status = 'PENDING'
        `, [fromUser, toUser]);

        return rows[0];
    };

    const cancelRequest = async (fromUser: string, toUser: string): Promise<FriendRequest | null> => {
        const { rows } = await db.query(`
            UPDATE friend_requests
            SET status = 'CANCELLED', resolved_at = NOW()
            WHERE from_user = ? AND to_user = ? AND status = 'PENDING'
        `, [fromUser, toUser]);
        return rows[0];
    };

    const rejectRequest = async (toUser: string, fromUser: string): Promise<FriendRequest | null> => {
        const { rows } = await db.query(`
            UPDATE friend_requests
            SET status = 'REJECTED', resolved_at = NOW()
            WHERE from_user = ? AND to_user = ? AND status = 'PENDING'
        `, [fromUser, toUser]);
        return rows[0];
    };

    return {
        getAll,
        getFriendIds,
        areFriends,
        createFriendship,
        removeFriendship,
        getReceivedRequests,
        getSentRequests,
        createRequest,
        acceptRequest,
        cancelRequest,
        rejectRequest,
    };
}
