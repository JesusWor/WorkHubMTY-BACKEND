import { z } from "zod";

export const FriendshipStatus = z.enum([
  "PENDING",
  "ACCEPTED"
]);

export const FriendshipSchema = z.object({
    userLow: z.string(),
    userHigh: z.string(),
    createdBy: z.string(),
    status: FriendshipStatus,
    createTime: z.string()
});
export type Friendship = z.infer<typeof FriendshipSchema>;


export const CreateFriendshipSchema = z.object({
    userLow: z.string(),
    userHigh: z.string(),
    createdBy: z.string()
});
export type CreateFriendship = z.infer<typeof CreateFriendshipSchema>;

// ENDPOINTS: DELETE,  
export const FriendshipActionSchema = z.object({
    userLow: z.string(),
    userHigh: z.string(),
});
export type FriendshipAction = z.infer<typeof FriendshipActionSchema>;