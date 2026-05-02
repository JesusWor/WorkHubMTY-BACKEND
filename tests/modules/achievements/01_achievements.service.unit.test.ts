import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAchievementsService } from '../../../src/modules/achievements/achievements.service';
import { AchievementsRepo } from '../../../src/modules/achievements/achievements.repo';
import { Achievements } from '../../../src/modules/achievements/achievements.schema';
import { ConflictError, BadRequestError } from '../../../src/shared/errors/AppError';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAchievement(overrides: Partial<Achievements> = {}): Achievements {
    return {
        id: 1,
        code: 'ACH001',
        name: 'Primer logro',
        description: 'Descripción del logro',
        ...overrides,
    };
}

function makeMockRepo(overrides: Partial<AchievementsRepo> = {}): AchievementsRepo {
    return {
        getAll: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue(null),
        getByCode: vi.fn().mockResolvedValue(null),
        createAchievement: vi.fn().mockResolvedValue({ id: 1 }),
        updateAchievements: vi.fn().mockResolvedValue(undefined),
        getRanking: vi.fn().mockResolvedValue([]),
        getUserAchievements: vi.fn().mockResolvedValue([]),
        getUserStats: vi.fn().mockResolvedValue({ reservations: 0, friends: 0 }),
        getRecentActivity: vi.fn().mockResolvedValue({ lastReservation: null, lastAchievement: { name: null, date: null } }),
        ...overrides,
    };
}

const validInput = {
    code: 'ACH001',
    name: 'Primer logro',
    description: 'Descripción',
    levels: [{ level: 1, progress_required: 10 }],
};

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('AchievementsService.getAll', () => {
    it('retorna todos los logros', async () => {
        const achievements = [makeAchievement(), makeAchievement({ id: 2, code: 'ACH002' })];
        const repo = makeMockRepo({ getAll: vi.fn().mockResolvedValue(achievements) });
        const service = makeAchievementsService(repo);

        const result = await service.getAll();
        expect(result).toHaveLength(2);
        expect(repo.getAll).toHaveBeenCalledTimes(1);
    });

    it('retorna arreglo vacío si no hay logros', async () => {
        const repo = makeMockRepo({ getAll: vi.fn().mockResolvedValue([]) });
        const service = makeAchievementsService(repo);

        const result = await service.getAll();
        expect(result).toEqual([]);
    });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe('AchievementsService.getById', () => {
    it('retorna el logro si existe', async () => {
        const achievement = makeAchievement();
        const repo = makeMockRepo({ getById: vi.fn().mockResolvedValue(achievement) });
        const service = makeAchievementsService(repo);

        const result = await service.getById(1);
        expect(result).toEqual(achievement);
        expect(repo.getById).toHaveBeenCalledWith(1);
    });

    it('retorna null si el logro no existe', async () => {
        const repo = makeMockRepo({ getById: vi.fn().mockResolvedValue(null) });
        const service = makeAchievementsService(repo);

        const result = await service.getById(999);
        expect(result).toBeNull();
    });

    it('llama al repo con el id correcto', async () => {
        const repo = makeMockRepo();
        const service = makeAchievementsService(repo);

        await service.getById(42);
        expect(repo.getById).toHaveBeenCalledWith(42);
        expect(repo.getById).toHaveBeenCalledTimes(1);
    });
});

// ─── getByCode ────────────────────────────────────────────────────────────────

describe('AchievementsService.getByCode', () => {
    it('retorna el logro si existe el código', async () => {
        const achievement = makeAchievement();
        const repo = makeMockRepo({ getByCode: vi.fn().mockResolvedValue(achievement) });
        const service = makeAchievementsService(repo);

        const result = await service.getByCode('ACH001');
        expect(result).toEqual(achievement);
        expect(repo.getByCode).toHaveBeenCalledWith('ACH001');
    });

    it('retorna null si el código no existe', async () => {
        const repo = makeMockRepo({ getByCode: vi.fn().mockResolvedValue(null) });
        const service = makeAchievementsService(repo);

        const result = await service.getByCode('NOEXIST');
        expect(result).toBeNull();
    });
});

// ─── createAchievement ────────────────────────────────────────────────────────

describe('AchievementsService.createAchievement', () => {
    it('crea el logro y retorna el id si el código no existe', async () => {
        const repo = makeMockRepo({
            getByCode: vi.fn().mockResolvedValue(null),
            createAchievement: vi.fn().mockResolvedValue({ id: 5 }),
        });
        const service = makeAchievementsService(repo);

        const result = await service.createAchievement(validInput);
        expect(result).toEqual({ id: 5 });
        expect(repo.createAchievement).toHaveBeenCalledWith(validInput);
    });

    it('lanza ConflictError si el código ya existe', async () => {
        const repo = makeMockRepo({
            getByCode: vi.fn().mockResolvedValue(makeAchievement()),
        });
        const service = makeAchievementsService(repo);

        await expect(service.createAchievement(validInput))
            .rejects.toThrow(ConflictError);
        await expect(service.createAchievement(validInput))
            .rejects.toThrow('ACH001');
    });

    it('no llama al repo.createAchievement si el código ya existe', async () => {
        const createMock = vi.fn();
        const repo = makeMockRepo({
            getByCode: vi.fn().mockResolvedValue(makeAchievement()),
            createAchievement: createMock,
        });
        const service = makeAchievementsService(repo);

        await service.createAchievement(validInput).catch(() => {});
        expect(createMock).not.toHaveBeenCalled();
    });

    it('verifica el código antes de crear (llama getByCode con el código correcto)', async () => {
        const getByCodeMock = vi.fn().mockResolvedValue(null);
        const repo = makeMockRepo({ getByCode: getByCodeMock });
        const service = makeAchievementsService(repo);

        await service.createAchievement(validInput);
        expect(getByCodeMock).toHaveBeenCalledWith('ACH001');
    });
});

// ─── updateAchievements ───────────────────────────────────────────────────────

describe('AchievementsService.updateAchievements', () => {
    it('llama al repo con los parámetros correctos', async () => {
        const updateMock = vi.fn().mockResolvedValue(undefined);
        const repo = makeMockRepo({ updateAchievements: updateMock });
        const service = makeAchievementsService(repo);

        await service.updateAchievements('USR00001', 1, 5);
        expect(updateMock).toHaveBeenCalledWith('USR00001', 1, 5);
    });

    it('lanza BadRequestError si userId está vacío', async () => {
        const repo = makeMockRepo();
        const service = makeAchievementsService(repo);

        await expect(service.updateAchievements('', 1, 5))
            .rejects.toThrow(BadRequestError);
    });

    it('lanza BadRequestError si achievementId es 0', async () => {
        const repo = makeMockRepo();
        const service = makeAchievementsService(repo);

        await expect(service.updateAchievements('USR00001', 0, 5))
            .rejects.toThrow(BadRequestError);
    });

    it('lanza BadRequestError si increment es 0', async () => {
        const repo = makeMockRepo();
        const service = makeAchievementsService(repo);

        await expect(service.updateAchievements('USR00001', 1, 0))
            .rejects.toThrow(BadRequestError);
    });

    it('lanza BadRequestError si increment es negativo', async () => {
        const repo = makeMockRepo();
        const service = makeAchievementsService(repo);

        await expect(service.updateAchievements('USR00001', 1, -3))
            .rejects.toThrow(BadRequestError);
    });

    it('no llama al repo si los parámetros son inválidos', async () => {
        const updateMock = vi.fn();
        const repo = makeMockRepo({ updateAchievements: updateMock });
        const service = makeAchievementsService(repo);

        await service.updateAchievements('', 1, 5).catch(() => {});
        expect(updateMock).not.toHaveBeenCalled();
    });
});

// ─── getRanking / getUserAchievements / getUserStats / getRecentActivity ──────

describe('AchievementsService.getRanking', () => {
    it('delega al repo con el userId correcto', async () => {
        const ranking = [{ e_id: 'USR00001', name: 'Ana', points: 100 }];
        const repo = makeMockRepo({ getRanking: vi.fn().mockResolvedValue(ranking) });
        const service = makeAchievementsService(repo);

        const result = await service.getRanking('USR00001');
        expect(result).toEqual(ranking);
        expect(repo.getRanking).toHaveBeenCalledWith('USR00001');
    });
});

describe('AchievementsService.getUserAchievements', () => {
    it('delega al repo con el userId correcto', async () => {
        const userAchs = [{ name: 'Primer logro', progress: 5, goal: 10, completed: 0 }];
        const repo = makeMockRepo({ getUserAchievements: vi.fn().mockResolvedValue(userAchs) });
        const service = makeAchievementsService(repo);

        const result = await service.getUserAchievements('USR00001');
        expect(result).toEqual(userAchs);
        expect(repo.getUserAchievements).toHaveBeenCalledWith('USR00001');
    });
});

describe('AchievementsService.getUserStats', () => {
    it('delega al repo con el userId correcto', async () => {
        const stats = { reservations: 3, friends: 2 };
        const repo = makeMockRepo({ getUserStats: vi.fn().mockResolvedValue(stats) });
        const service = makeAchievementsService(repo);

        const result = await service.getUserStats('USR00001');
        expect(result).toEqual(stats);
        expect(repo.getUserStats).toHaveBeenCalledWith('USR00001');
    });
});

describe('AchievementsService.getRecentActivity', () => {
    it('delega al repo con el userId correcto', async () => {
        const activity = { lastReservation: '2025-06-01T08:00:00', lastAchievement: { name: 'Primer logro', date: '2025-05-01' } };
        const repo = makeMockRepo({ getRecentActivity: vi.fn().mockResolvedValue(activity) });
        const service = makeAchievementsService(repo);

        const result = await service.getRecentActivity('USR00001');
        expect(result).toEqual(activity);
        expect(repo.getRecentActivity).toHaveBeenCalledWith('USR00001');
    });
});
