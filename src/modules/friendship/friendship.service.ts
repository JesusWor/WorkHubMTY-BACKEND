import { FriendshipRepo } from "./friendship.repo.js";
import { Friendship, FriendRequest, Source, FriendRequests } from "./friendship.schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors/AppError.js";

export type FriendshipService = {
    getAll: () => Promise<Friendship[]>;
    getFriendIds: (eId: string) => Promise<string[]>;
    areFriends: (user1: string, user2: string) => Promise<boolean>;
    createFriendship: (user1: string, user2: string, source: Source) => Promise<Friendship | null>;
    removeFriendship: (user1: string, user2: string) => Promise<boolean>;

    getReceivedRequests: (eId: string) => Promise<FriendRequest[]>;
    getSentRequests: (eId: string) => Promise<FriendRequest[]>;
    createRequest: (fromUser: string, toUserIds: string[], message?:string | undefined) => Promise<FriendRequests | null>;
    acceptRequest: (toUser: string, fromUser: string) => Promise<Friendship | null>;
    cancelRequest: (fromUser: string, toUser: string) => Promise<boolean>;
    rejectRequest: (toUser: string, fromUser: string) => Promise<boolean>;
};

export function makeFriendshipService(repo: FriendshipRepo): FriendshipService {

    const getAll = async (): Promise<Friendship[]> => {
        return await repo.getAll();
    };

    const getFriendIds = async (eId: string): Promise<string[]> => {
        if (!eId) throw new BadRequestError("User id is required");
        return await repo.getFriendIds(eId);
    };

    const areFriends = async (user1: string, user2: string): Promise<boolean> => {
        if (!user1 || !user2) throw new BadRequestError("Both user ids are required");
        if (user1 === user2) return true;
        return await repo.areFriends(user1, user2);
    };

    const createFriendship = async (user1: string, user2: string, source: Source): Promise<Friendship | null> => {
        if (!user1 || !user2) throw new BadRequestError("Both user ids are required");
        if (user1 === user2) throw new BadRequestError("A user cannot be friends with themselves");

        const [userLow, userHigh] = user1 < user2 ? [user1, user2] : [user2, user1];

        const friendship = await repo.createFriendship(userLow, userHigh, source);
        if (!friendship) throw new ConflictError("Friendship already exists");

        return friendship;
    };

    const removeFriendship = async (user1: string, user2: string): Promise<boolean> => {
        if (!user1 || !user2) throw new BadRequestError("Both user ids are required");

        const [userLow, userHigh] = user1 < user2 ? [user1, user2] : [user2, user1];

        const removed = await repo.removeFriendship(userLow, userHigh);
        if (!removed) throw new NotFoundError("Friendship not found");

        return true;
    };

    const getReceivedRequests = async (eId: string): Promise<FriendRequest[]> => {
        if (!eId) throw new BadRequestError("User id is required");
        return await repo.getReceivedRequests(eId);
    };

    const getSentRequests = async (eId: string): Promise<FriendRequest[]> => {
        if (!eId) throw new BadRequestError("User id is required");
        return await repo.getSentRequests(eId);
    };

    const createRequest = async (fromUser: string, toUserIds: string[], message?:string| undefined): Promise<FriendRequests | null> => {
        if (!fromUser || !toUserIds || toUserIds.length === 0) throw new BadRequestError("Both user ids are required");
        if (toUserIds.includes(fromUser)) throw new BadRequestError("A user cannot send a friend request to themselves");

        const alreadyFriends = await repo.areFriends(fromUser, toUserIds[0]);
        if (alreadyFriends) throw new ConflictError("Users are already friends");

        const request = await repo.createRequest(fromUser, toUserIds, message);
        if (!request) throw new ConflictError("Friend request already pending");

        return request;
    };

    const acceptRequest = async (fromUser: string, toUser: string): Promise<Friendship | null> => {
        if (!fromUser || !toUser) throw new BadRequestError("Both user ids are required");

        const accepted = await repo.acceptRequest(fromUser, toUser);
        if (!accepted) throw new NotFoundError("Pending friend request not found");

        const friendship = createFriendship(fromUser, toUser, "REQUEST");
        if (!friendship) throw new ConflictError("Friendship already exists");

        return friendship;
    };

    const cancelRequest = async (fromUser: string, toUser: string): Promise<boolean> => {
        if (!fromUser || !toUser) throw new BadRequestError("Both user ids are required");

        const cancelled = await repo.cancelRequest(fromUser, toUser);
        if (!cancelled) throw new NotFoundError("Pending friend request not found");

        return true;
    };

    const rejectRequest = async (toUser: string, fromUser: string): Promise<boolean> => {
        if (!toUser || !fromUser) throw new BadRequestError("Both user ids are required");

        const rejected = await repo.rejectRequest(toUser, fromUser);
        if (!rejected) throw new NotFoundError("Pending friend request not found");

        return true;
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
