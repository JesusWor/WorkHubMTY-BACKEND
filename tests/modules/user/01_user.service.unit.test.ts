import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeUserService } from "../../../src/modules/user/user.service";
import type { UserRepo } from "../../../src/modules/user/user.repo";
import type { FriendshipService } from "../../../src/modules/friendship/friendship.service";
import type { AchievementsService } from "../../../src/modules/achievements/achievements.service";
import type { UserStatusService } from "../../../src/modules/user/user-status.service";

function makeDeps() {
    const repo = {
        getAll: vi.fn(),
        getById: vi.fn(),
        getByIds: vi.fn(),
        getGuestsByIds: vi.fn(),
        getUsers: vi.fn(),
        listUsers: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
        getAllByName: vi.fn().mockResolvedValue([]),
        TEMPORARY_CREATE: vi.fn(),
        getAllGuests: vi.fn(),
        getGuestById: vi.fn(),
        createGuest: vi.fn(),
        updateGuest: vi.fn(),
        removeGuest: vi.fn(),
    } as unknown as UserRepo;

    const friendshipService = {
        getAll: vi.fn(),
        getFriendIds: vi.fn().mockResolvedValue(["USR00002"]),
        areFriends: vi.fn(),
        createFriendship: vi.fn(),
        removeFriendship: vi.fn(),
        getReceivedRequests: vi.fn().mockResolvedValue([
            { fromUser: "USR00003", toUser: "USR00001" },
        ]),
        getSentRequests: vi.fn().mockResolvedValue([
            { fromUser: "USR00001", toUser: "USR00004" },
        ]),
        createRequest: vi.fn(),
        acceptRequest: vi.fn(),
        cancelRequest: vi.fn(),
        rejectRequest: vi.fn(),
    } as unknown as FriendshipService;

    const achievementsService = {
        getCompletedByUser: vi.fn(),
    } as unknown as AchievementsService;

    const userStatusService = {
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onPing: vi.fn(),
        getStatus: vi.fn().mockResolvedValue("offline"),
        getStatuses: vi.fn().mockResolvedValue(new Map()),
    } as unknown as UserStatusService;

    const service = makeUserService(repo, {}, friendshipService, achievementsService, userStatusService);

    return { service, repo, friendshipService };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("UserService.getUsers", () => {
    it("combina exclusiones relacionales e ids manuales", async () => {
        const { service, repo, friendshipService } = makeDeps();

        await service.getUsers(
            {
                query: "equipo",
                exclude: ["friends", "sent_requests", "received_requests"],
                excludeId: ["USR00005"],
                limit: 10,
                cursor: null,
            },
            "USR00001",
        );

        expect(friendshipService.getFriendIds).toHaveBeenCalledWith("USR00001");
        expect(friendshipService.getSentRequests).toHaveBeenCalledWith("USR00001");
        expect(friendshipService.getReceivedRequests).toHaveBeenCalledWith("USR00001");
        expect(repo.listUsers).toHaveBeenCalledWith({
            query: "equipo",
            exclude: ["friends", "sent_requests", "received_requests"],
            excludeId: ["USR00005", "USR00002", "USR00004", "USR00003"],
            limit: 10,
            cursor: null,
        });
    });
});
