import { describe, it, expect } from 'vitest';
import {
    AchievementsSchema,
    AchievementLevelSchema,
    CreateAchievementInputSchema,
} from '../../../src/modules/achievements/achievements.schema';

// ─── AchievementsSchema ───────────────────────────────────────────────────────

describe('AchievementsSchema', () => {
    const valid = { id: 1, code: 'ACH001', name: 'Primer logro', description: 'Descripción del logro' };

    it('acepta un objeto válido con description', () => {
        expect(AchievementsSchema.safeParse(valid).success).toBe(true);
    });

    it('acepta description null', () => {
        const result = AchievementsSchema.safeParse({ ...valid, description: null });
        expect(result.success).toBe(true);
    });

    it('acepta sin campo description (optional)', () => {
        const { description: _, ...noDesc } = valid;
        expect(AchievementsSchema.safeParse(noDesc).success).toBe(true);
    });

    it('falla si id no es número', () => {
        expect(AchievementsSchema.safeParse({ ...valid, id: 'uno' }).success).toBe(false);
    });

    it('falla si code no es string', () => {
        expect(AchievementsSchema.safeParse({ ...valid, code: 123 }).success).toBe(false);
    });

    it('falla si name no es string', () => {
        expect(AchievementsSchema.safeParse({ ...valid, name: null }).success).toBe(false);
    });

    it('falla si faltan campos requeridos', () => {
        const result = AchievementsSchema.safeParse({ id: 1 });
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('code');
        expect(fields).toContain('name');
    });
});

// ─── AchievementLevelSchema ───────────────────────────────────────────────────

describe('AchievementLevelSchema', () => {
    const valid = { level: 1, progress_required: 10 };

    it('acepta un nivel válido', () => {
        expect(AchievementLevelSchema.safeParse(valid).success).toBe(true);
    });

    it('falla si level es 0', () => {
        expect(AchievementLevelSchema.safeParse({ ...valid, level: 0 }).success).toBe(false);
    });

    it('falla si level es negativo', () => {
        expect(AchievementLevelSchema.safeParse({ ...valid, level: -1 }).success).toBe(false);
    });

    it('falla si progress_required es 0', () => {
        expect(AchievementLevelSchema.safeParse({ ...valid, progress_required: 0 }).success).toBe(false);
    });

    it('falla si progress_required es negativo', () => {
        expect(AchievementLevelSchema.safeParse({ ...valid, progress_required: -5 }).success).toBe(false);
    });

    it('falla si level no es entero', () => {
        expect(AchievementLevelSchema.safeParse({ ...valid, level: 1.5 }).success).toBe(false);
    });

    it('falla si faltan ambos campos', () => {
        const result = AchievementLevelSchema.safeParse({});
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('level');
        expect(fields).toContain('progress_required');
    });
});

// ─── CreateAchievementInputSchema ─────────────────────────────────────────────

describe('CreateAchievementInputSchema', () => {
    const validLevel = { level: 1, progress_required: 10 };
    const valid = {
        code: 'ACH001',
        name: 'Primer logro',
        description: 'Descripción',
        levels: [validLevel],
    };

    it('acepta un input válido con un nivel', () => {
        expect(CreateAchievementInputSchema.safeParse(valid).success).toBe(true);
    });

    it('acepta múltiples niveles', () => {
        const result = CreateAchievementInputSchema.safeParse({
            ...valid,
            levels: [
                { level: 1, progress_required: 10 },
                { level: 2, progress_required: 25 },
                { level: 3, progress_required: 50 },
            ],
        });
        expect(result.success).toBe(true);
    });

    it('acepta description null', () => {
        expect(CreateAchievementInputSchema.safeParse({ ...valid, description: null }).success).toBe(true);
    });

    it('acepta sin description (optional)', () => {
        const { description: _, ...noDesc } = valid;
        expect(CreateAchievementInputSchema.safeParse(noDesc).success).toBe(true);
    });

    it('falla si code está vacío', () => {
        expect(CreateAchievementInputSchema.safeParse({ ...valid, code: '' }).success).toBe(false);
    });

    it('falla si code supera 16 caracteres', () => {
        expect(CreateAchievementInputSchema.safeParse({ ...valid, code: 'A'.repeat(17) }).success).toBe(false);
    });

    it('falla si name está vacío', () => {
        expect(CreateAchievementInputSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    });

    it('falla si name supera 32 caracteres', () => {
        expect(CreateAchievementInputSchema.safeParse({ ...valid, name: 'N'.repeat(33) }).success).toBe(false);
    });

    it('falla si description supera 255 caracteres', () => {
        expect(CreateAchievementInputSchema.safeParse({ ...valid, description: 'D'.repeat(256) }).success).toBe(false);
    });

    it('falla si levels es un arreglo vacío', () => {
        const result = CreateAchievementInputSchema.safeParse({ ...valid, levels: [] });
        expect(result.success).toBe(false);
        expect(result.error!.issues[0].message).toBe('El logro debe tener al menos un nivel');
    });

    it('falla si levels no está presente', () => {
        const { levels: _, ...noLevels } = valid;
        expect(CreateAchievementInputSchema.safeParse(noLevels).success).toBe(false);
    });

    it('falla si un nivel tiene progress_required inválido', () => {
        const result = CreateAchievementInputSchema.safeParse({
            ...valid,
            levels: [{ level: 1, progress_required: -1 }],
        });
        expect(result.success).toBe(false);
    });

    it('falla si code y name están ausentes', () => {
        const result = CreateAchievementInputSchema.safeParse({ levels: [validLevel] });
        expect(result.success).toBe(false);
        const fields = result.error!.issues.map(i => i.path[0]);
        expect(fields).toContain('code');
        expect(fields).toContain('name');
    });
});
