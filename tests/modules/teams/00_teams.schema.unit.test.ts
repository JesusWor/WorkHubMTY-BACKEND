import { describe, it, expect } from 'vitest';
import {
    CreateTeamSchema,
    ListTeamsQuerySchema,
    TeamIdSchema,
    TeamMemberSchema,
    TeamMembersSchema,
    TeamSchema,
    UpdateTeamSchema,
} from '../../../src/modules/teams/teams.schema';

const user = {
    eId: 'USR00001',
    name: 'Usuario',
    email: 'usuario@example.com',
    roleName: 'USER',
    title: null,
    status: 'offline',
};

describe('Team schemas', () => {
    it('acepta team, miembro y team con miembros', () => {
        expect(TeamIdSchema.safeParse('team-1').success).toBe(true);
        expect(TeamSchema.safeParse({ id: 1, name: 'Team A', description: null, memberCount: 2 }).success).toBe(true);
        expect(TeamMemberSchema.safeParse(user).success).toBe(true);
        expect(TeamMembersSchema.safeParse({
            id: 1,
            name: 'Team A',
            description: 'Descripcion',
            users: [user],
        }).success).toBe(true);
    });

    it('CreateTeamSchema exige name y al menos un miembro', () => {
        expect(CreateTeamSchema.safeParse({
            name: 'Team A',
            memberEIds: ['USR00001'],
        }).success).toBe(true);
        expect(CreateTeamSchema.safeParse({ name: 'Team A', memberEIds: [] }).success).toBe(false);
        expect(CreateTeamSchema.safeParse({ memberEIds: ['USR00001'] }).success).toBe(false);
    });
});

describe('UpdateTeamSchema', () => {
    it('acepta solo metadata del team', () => {
        const result = UpdateTeamSchema.safeParse({
            name: 'Nuevo nombre',
            description: 'Nueva descripcion',
        });

        expect(result.success).toBe(true);
    });

    it('acepta solo altas de miembros', () => {
        const result = UpdateTeamSchema.safeParse({
            addMemberEIds: ['USR00001', 'USR00002'],
        });

        expect(result.success).toBe(true);
    });

    it('acepta solo bajas de miembros', () => {
        const result = UpdateTeamSchema.safeParse({
            removeMemberEIds: ['USR00003'],
        });

        expect(result.success).toBe(true);
    });

    it('rechaza body vacio', () => {
        const result = UpdateTeamSchema.safeParse({});

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('At least one field must be provided');
    });

    it('rechaza listas vacias cuando vienen presentes', () => {
        const result = UpdateTeamSchema.safeParse({
            addMemberEIds: [],
        });

        expect(result.success).toBe(false);
    });

    it('rechaza ids duplicados dentro de la misma lista', () => {
        const result = UpdateTeamSchema.safeParse({
            addMemberEIds: ['USR00001', 'USR00001'],
        });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('Member ids must be unique');
    });

    it('rechaza ids repetidos entre add y remove', () => {
        const result = UpdateTeamSchema.safeParse({
            addMemberEIds: ['USR00001'],
            removeMemberEIds: ['USR00001'],
        });

        expect(result.success).toBe(false);
        const messages = result.error?.issues.map((issue) => issue.message) ?? [];
        expect(messages).toContain('Member ids cannot be added and removed in the same request');
    });
});

describe('ListTeamsQuerySchema', () => {
    it('acepta name vacio o ausente', () => {
        expect(ListTeamsQuerySchema.safeParse({}).success).toBe(true);
        expect(ListTeamsQuerySchema.safeParse({ name: '  equipo de ventas  ' }).success).toBe(true);
    });
});
