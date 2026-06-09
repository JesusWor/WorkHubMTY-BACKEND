import { describe, it, expect, vi } from 'vitest';
import { makeAchievementsService } from '../../../src/modules/achievements/achievements.service.js';
import { AchievementsRepo } from '../../../src/modules/achievements/achievements.repo.js';
import { BadRequestError, ConflictError } from '../../../src/shared/errors/AppError.js';

function makeRepo(overrides: Partial<AchievementsRepo> = {}): AchievementsRepo {
  return {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    createAchievement: vi.fn().mockResolvedValue({ id: 1 }),
    updateAchievements: vi.fn().mockResolvedValue(undefined),
    getRanking: vi.fn().mockResolvedValue([]),
    getUserAchievements: vi.fn().mockResolvedValue([]),
    getCompletedByUser: vi.fn().mockResolvedValue([]),
    getUserStats: vi.fn().mockResolvedValue({}),
    getRecentActivity: vi.fn().mockResolvedValue({}),
    getUserSummary: vi.fn().mockResolvedValue({ points: 0, totalAchievements: 0, completed: 0, inProgress: 0, notStarted: 0 }),
    ...overrides,
  } as AchievementsRepo;
}

const userRepo = {} as any;

describe('AchievementsService.createAchievement', () => {
  const input = {
    id: 1,
    name: 'Red personal',
    description: null,
    levels: [{ level: 1, progressRequired: 1, description: 'Agrega 1 amigo' }],
  };

  it('crea si el id no existe', async () => {
    const repo = makeRepo();
    const service = makeAchievementsService(repo, userRepo);

    await expect(service.createAchievement(input)).resolves.toEqual({ id: 1 });
    expect(repo.getById).toHaveBeenCalledWith(1);
    expect(repo.createAchievement).toHaveBeenCalledWith(input);
  });

  it('lanza ConflictError si el id ya existe', async () => {
    const repo = makeRepo({ getById: vi.fn().mockResolvedValue({ id: 1, name: 'Existente' }) });
    const service = makeAchievementsService(repo, userRepo);

    await expect(service.createAchievement(input)).rejects.toThrow(ConflictError);
    expect(repo.createAchievement).not.toHaveBeenCalled();
  });
});

describe('AchievementsService progress and reads', () => {
  it('valida updateAchievements', async () => {
    const repo = makeRepo();
    const service = makeAchievementsService(repo, userRepo);

    await service.updateAchievements('USR00001', 1, 2);
    expect(repo.updateAchievements).toHaveBeenCalledWith('USR00001', 1, 2);
    await expect(service.updateAchievements('', 1, 2)).rejects.toThrow(BadRequestError);
    await expect(service.updateAchievements('USR00001', 0, 2)).rejects.toThrow(BadRequestError);
    await expect(service.updateAchievements('USR00001', 1, 0)).rejects.toThrow(BadRequestError);
  });

  it('mapea achievements de usuario al formato nuevo', async () => {
    const repo = makeRepo({
      getUserAchievements: vi.fn().mockResolvedValue([{
        id: 1,
        title: 'Red personal',
        description: 'Agrega amigos',
        icon: 'users',
        progress: 2,
        goal: 5,
        status: 'in_progress',
      }]),
    });
    const service = makeAchievementsService(repo, userRepo);

    await expect(service.getUserAchievements('USR00001')).resolves.toEqual([{
      id: 1,
      title: 'Red personal',
      description: 'Agrega amigos',
      icon: 'users',
      userProgress: { current: 2, target: 5, status: 'in_progress' },
    }]);
  });

  it('delega summary al repo', async () => {
    const summary = { points: 10, totalAchievements: 2, completed: 1, inProgress: 1, notStarted: 0 };
    const repo = makeRepo({ getUserSummary: vi.fn().mockResolvedValue(summary) });
    const service = makeAchievementsService(repo, userRepo);

    await expect(service.getUserSummary('USR00001')).resolves.toEqual(summary);
  });
});
