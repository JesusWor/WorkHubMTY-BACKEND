import { z } from "zod";

export const SourceEnum = z.enum(["ADMIN", "REQUEST"]);
export const RequestStatusEnum = z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]);

export type Source = z.infer<typeof SourceEnum>;
export type RequestStatus = z.infer<typeof RequestStatusEnum>;

export const FriendshipSchema = z.object({
    userLow: z.string(),
    userHigh: z.string(),
    source: SourceEnum,
    createdAt: z.string()
});

export const FriendRequestSchema = z.object({
    id: z.number(),
    fromUser: z.string(),
    toUserIds: z.array(z.string()),
    status: RequestStatusEnum,
    createdAt: z.string(),
    resolvedAt: z.string().nullable(),
});

export const SentFriendRequestSchema = z.object({
    id: z.number(),
    eId:z.string(),
    name:z.string(),
    email:z.email(),
    status: RequestStatusEnum,
    createdAt: z.string(),
    resolvedAt: z.string().nullable(),
})

export const FriendRequestsSchema = z.array(FriendRequestSchema)


export const CreateFriendRequestSchema = z.object({
    toUserIds: z.array(z.string()),
    message: z.string().optional()
});

export const AcceptFriendRequestSchema = z.object({
    fromUser: z.string()
});

export const RemoveRelationSchema = z.object({
    userId: z.string()
});

export type Friendship = z.infer<typeof FriendshipSchema>;
export type FriendRequest = z.infer<typeof FriendRequestSchema>;
export type FriendRequests = z.infer<typeof FriendRequestsSchema>
export type SentFriendRequest = z.infer<typeof SentFriendRequestSchema>
