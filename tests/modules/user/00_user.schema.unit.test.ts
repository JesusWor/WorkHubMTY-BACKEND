import { describe, it, expect } from 'vitest';
import { UpdateGroupSchema } from '../../../src/modules/user/user.schema';

describe('UpdateGroupSchema', () => {
    it('acepta solo metadata del grupo', () => {
        const result = UpdateGroupSchema.safeParse({
            name: 'Nuevo nombre',
            description: 'Nueva descripcion',
        });

        expect(result.success).toBe(true);
    });

    it('acepta solo altas de miembros', () => {
        const result = UpdateGroupSchema.safeParse({
            addMemberEIds: ['USR00001', 'USR00002'],
        });

        expect(result.success).toBe(true);
    });

    it('acepta solo bajas de miembros', () => {
        const result = UpdateGroupSchema.safeParse({
            removeMemberEIds: ['USR00003'],
        });

        expect(result.success).toBe(true);
    });

    it('rechaza body vacio', () => {
        const result = UpdateGroupSchema.safeParse({});

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('At least one field must be provided');
    });

    it('rechaza listas vacias cuando vienen presentes', () => {
        const result = UpdateGroupSchema.safeParse({
            addMemberEIds: [],
        });

        expect(result.success).toBe(false);
    });

    it('rechaza ids duplicados dentro de la misma lista', () => {
        const result = UpdateGroupSchema.safeParse({
            addMemberEIds: ['USR00001', 'USR00001'],
        });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('Member ids must be unique');
    });

    it('rechaza ids repetidos entre add y remove', () => {
        const result = UpdateGroupSchema.safeParse({
            addMemberEIds: ['USR00001'],
            removeMemberEIds: ['USR00001'],
        });

        expect(result.success).toBe(false);
        const messages = result.error?.issues.map((issue) => issue.message) ?? [];
        expect(messages).toContain('Member ids cannot be added and removed in the same request');
    });
});
