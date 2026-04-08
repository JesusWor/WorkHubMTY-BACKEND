import { FriendshipRepo } from "./friendship.repo";
import { Friendship, FriendDTO, FriendRequest, Source } from "./friendship.schema";

export type FriendshipService = {
    // Friendships
    getAll: () => Promise<Friendship[]>;
    getFriendsOf: (eId: string) => Promise<FriendDTO[]>;
    createFriendship: (userLow: string, userHigh: string, source: Source) => Promise<Friendship | null>;
    removeFriendship: (user1: string, user2: string) => Promise<boolean>;

    // Requests
    getReceivedRequests: (eId: string) => Promise<FriendRequest[]>;
    getSentRequests: (eId: string) => Promise<FriendRequest[]>;
    createRequest: (fromUser: string, toUser: string) => Promise<FriendRequest | null>;
    removeRequest: (user1: string, user2: string) => Promise<boolean>;
};

export function makeFriendshipService(repo: FriendshipRepo): FriendshipService {

    const getAll = async (): Promise<Friendship[]> => {
        return await repo.getAll();
    };

    const getFriendsOf = async (eId: string): Promise<FriendDTO[]> => {
        if (!eId) throw new Error("User id is required");
        return await repo.getFriendsOf(eId);
    };

    const createFriendship = async (user1: string, user2: string, source: Source): Promise<Friendship | null> => {
        if (!user1 || !user2) throw new Error("Both user ids are required");
        if (user1 === user2) throw new Error("A user cannot be friends with themselves");

        // Enforce canonical order: user_low < user_high
        const [userLow, userHigh] = user1 < user2 ? [user1, user2] : [user2, user1];

        const friendship = await repo.createFriendship(userLow, userHigh, source);
        if (!friendship) throw new Error("Friendship already exists");

        return friendship;
    };

    const removeFriendship = async (user1: string, user2: string): Promise<boolean> => {
        if (!user1 || !user2) throw new Error("Both user ids are required");

        const [userLow, userHigh] = user1 < user2 ? [user1, user2] : [user2, user1];

        const removed = await repo.removeFriendship(userLow, userHigh);
        if (!removed) throw new Error("Friendship not found");

        return true;
    };

    const getReceivedRequests = async (eId: string): Promise<FriendRequest[]> => {
        if (!eId) throw new Error("User id is required");
        return await repo.getReceivedRequests(eId);
    };

    const getSentRequests = async (eId: string): Promise<FriendRequest[]> => {
        if (!eId) throw new Error("User id is required");
        return await repo.getSentRequests(eId);
    };

    const createRequest = async (fromUser: string, toUser: string): Promise<FriendRequest | null> => {
        if (!fromUser || !toUser) throw new Error("Both user ids are required");
        if (fromUser === toUser) throw new Error("A user cannot send a friend request to themselves");

        const request = await repo.createRequest(fromUser, toUser);
        if (!request) throw new Error("Friend request already exists");

        return request;
    };

    const removeRequest = async (user1: string, user2: string): Promise<boolean> => {
        if (!user1 || !user2) throw new Error("Both user ids are required");

        const removed = await repo.removeRequest(user1, user2);
        if (!removed) throw new Error("Friend request not found");

        return true;
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
