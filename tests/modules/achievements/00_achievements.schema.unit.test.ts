import { describe, it, expect } from 'vitest';
import {
  AchievementsSchema,
  AchievementLevelSchema,
  CreateAchievementInputSchema,
  UserSummarySchema,
  UserAchievement,
  AchievementProgressesByUser,
} from '../../../src/modules/achievements/achievements.schema.js';

describe('AchievementsSchema', () => {
  it('acepta id y name', () => {
    expect(AchievementsSchema.safeParse({ id: 1, name: 'Red personal' }).success).toBe(true);
  });

  it('falla si falta name', () => {
    expect(AchievementsSchema.safeParse({ id: 1 }).success).toBe(false);
  });
});

describe('AchievementLevelSchema', () => {
  const valid = { level: 1, progressRequired: 5, description: 'Agrega amigos' };

  it('acepta un nivel valido', () => {
    expect(AchievementLevelSchema.safeParse(valid).success).toBe(true);
  });

  it('falla si level o progressRequired no son positivos', () => {
    expect(AchievementLevelSchema.safeParse({ ...valid, level: 0 }).success).toBe(false);
    expect(AchievementLevelSchema.safeParse({ ...valid, progressRequired: 0 }).success).toBe(false);
  });
});

describe('CreateAchievementInputSchema', () => {
  const valid = {
    id: 1,
    name: 'Red personal',
    description: null,
    levels: [{ level: 1, progressRequired: 1, description: 'Agrega 1 amigo' }],
  };

  it('acepta input valido con niveles', () => {
    expect(CreateAchievementInputSchema.safeParse(valid).success).toBe(true);
  });

  it('falla si levels esta vacio', () => {
    const result = CreateAchievementInputSchema.safeParse({ ...valid, levels: [] });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('El logro debe tener al menos un nivel');
  });
});

describe('Achievement user schemas', () => {
  it('acepta summary y achievement de usuario', () => {
    expect(UserSummarySchema.safeParse({
      points: 10,
      totalAchievements: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
    }).success).toBe(true);

    expect(UserAchievement.safeParse({
      id: 1,
      title: 'Red personal',
      description: 'Agrega amigos',
      icon: 'users',
      userProgress: { current: 2, target: 5, status: 'in_progress' },
    }).success).toBe(true);
  });

  it('acepta AchievementProgressesByUser plano', () => {
    expect(AchievementProgressesByUser.safeParse({
      id: 1,
      title: 'Red personal',
      description: 'Agrega amigos',
      icon: 'network',
      progress: 2,
      goal: 5,
      status: 'in_progress',
      level: 1,
    }).success).toBe(true);
  });
});
