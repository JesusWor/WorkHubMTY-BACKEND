import { TypedEventEmitter } from "./typed-event-emitter.js";
import type { User, Guest } from "../../modules/user/user.schema.js";
import type {
    Friendship,
    FriendRequest,
} from "../../modules/friendship/friendship.schema.js";

export type UserEventMap = {
    "user.created": [user: User];
    "user.updated": [user: User];
    "user.deleted": [eId: string];

    "guest.created": [guest: Guest];
    "guest.updated": [guest: Guest];
    "guest.deleted": [guestId: number];

    "friendship.created": [friendship: Friendship];
    "friendship.removed": [userLow: string, userHigh: string];

    "friendRequest.sent": [request: FriendRequest];
    "friendRequest.accepted": [request: FriendRequest];
    "friendRequest.canceled": [request: FriendRequest];
    "friendRequest.rejected": [request: FriendRequest];
};

export type UserEventsEmitter = TypedEventEmitter<UserEventMap>;
export const userEvents = new TypedEventEmitter<UserEventMap>();
