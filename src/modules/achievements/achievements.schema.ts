import { z } from "zod";

export const AchievementsSchema = z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
});

export const AchievementLevelSchema = z.object({
    level: z.number().int().positive(),
    progress_required: z.number().int().positive(),
});

export const CreateAchievementInputSchema = z.object({
    code: z.string().min(1).max(16),
    name: z.string().min(1).max(32),
    description: z.string().max(255).nullable().optional(),
    levels: z
        .array(AchievementLevelSchema)
        .min(1, "El logro debe tener al menos un nivel"),
});

export type Achievements = z.infer<typeof AchievementsSchema>;
export type AchievementLevel = z.infer<typeof AchievementLevelSchema>;
export type CreateAchievementInput = z.infer<typeof CreateAchievementInputSchema>;