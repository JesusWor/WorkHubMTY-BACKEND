import { Db } from "../../infra/db/db.js";
import { Friendship, CreateFriendship, FriendshipAction } from "./friend.schema.js";

export type FriendshipRepo = {
    getAll: () => Promise<Friendship[]>;
    getUserFriendships: (eId: string) => Promise<Friendship[]>;

    create: (friendship: CreateFriendship) => Promise<Friendship | null>;
    delete: (friendship: FriendshipAction) => Promise<boolean>;

}