import { z } from "zod";

export const AchievementsSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const AchievementLevelSchema = z.object({
    level: z.number().int().positive(),
    progressRequired: z.number().int().positive(),
    description: z.string().max(100),
});

export const CreateAchievementInputSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(32),
    description: z.string().max(255).nullable().optional(),
    levels: z
        .array(AchievementLevelSchema)
        .min(1, "El logro debe tener al menos un nivel"),
});

export const UserSummarySchema = z.object({
    points: z.number(),
    totalAchievements: z.number(),
    completed: z.number(),
    inProgress: z.number(),
    notStarted: z.number(),
});

export const AchievementProgressesByUser = z.object({
  id: z.number(), // id del achievement
  title: z.string(), // nombre del logro
  description: z.string(), // descripción del nivel
  icon: z.enum(["users", "network", "flame"]), // ícono permitido
  progress: z.number(), // progreso actual del usuario
  goal: z.number(), // meta del nivel actual
  status: z.enum(["completed", "in_progress", "locked"]), // estado calculado
  level: z.number() // nivel alcanzado
});
/*
description
: 
"Agrega 1 amigo a tu red"
icon
: 
"users"
id
: 
1
title
: 
"Red personal"
userProgress
: 
current
: 
2
status
: 
"completed"
target
: 
1 */
export const UserAchievement = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  icon: z.enum(["users", "network", "flame"]),
  userProgress: z.object({
    current: z.number(),
    target: z.number(),
    status: z.enum(["completed", "in_progress", "locked"]),
  }),
})

export type AchievementUserData = z.infer<typeof UserAchievement>
export type AchievementProgressesByUser = z.infer<typeof AchievementProgressesByUser>
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type Achievements = z.infer<typeof AchievementsSchema>;
export type AchievementLevel = z.infer<typeof AchievementLevelSchema>;
export type CreateAchievementInput = z.infer<typeof CreateAchievementInputSchema>;