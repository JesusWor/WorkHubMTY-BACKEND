import { z } from 'zod';

export const AchivementsSchema = z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    description: z.string(),
});

export type Achievements = z.infer<typeof AchivementsSchema>;

// export const UpdateAchivementSchema = AchivementsSchema.partial().pick({ name: true });
// export type UpdateAchievements = z.infer<typeof UpdateAchivementSchema>;