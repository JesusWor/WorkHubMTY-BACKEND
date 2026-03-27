import {  } from "./friendship.repo";
import {  } from "./friendship.schema";

export type FriendshipService = {
    getAll : () => Promise<User[]>;
    getById : (eId: string) => Promise<User | null>;

    getAllByName: (name: string) => Promise<User[]>;
}

export function makeFriendshipService(repo: FriendshipRepo): FriendshipService {

    
    return {
        getAll,
        getById,
        getAllByName
    }
}