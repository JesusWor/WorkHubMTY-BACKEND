import { z } from "zod";

export const SourceEnum = z.enum(["ADMIN", "REQUEST"]);

export type Source = z.infer<typeof SourceEnum>;

export const FriendshipSchema = z.object({
    userLow: z.string(),
    userHigh: z.string(),
    source: SourceEnum,
    createdAt: z.string()
});

export type Friendship = z.infer<typeof FriendshipSchema>;


export const FriendSchema = z.object({
    userId: z.string(),
    name: z.string(),
    email: z.email(),
    createdAt: z.string()
});

export type FriendDTO = z.infer<typeof FriendSchema>;


export const FriendRequestSchema = z.object({
    fromUser: z.string(),
    toUser: z.string(),
    createdAt: z.string()
});

export type FriendRequest = z.infer<typeof FriendRequestSchema>;

export const CreateFriendRequestSchema = z.object({
    toUser: z.string()
});

export const AcceptFriendRequestSchema = z.object({
    fromUser: z.string()
});

export const RemoveRelationSchema = z.object({
    userId: z.string()
});