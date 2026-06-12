import { describe, it, expect } from 'vitest';
import {
    RoleSchema,
    CreateRoleSchema,
    UpdateRoleSchema,
} from '../../../src/modules/role/role.schema';

describe('RoleSchema', () => {
    it('acepta un role válido', () => {
        expect(RoleSchema.safeParse({ id: 1, name: 'ADMIN' }).success).toBe(true);
    });

    it('rechaza sin name', () => {
        expect(RoleSchema.safeParse({ id: 1 }).success).toBe(false);
    });

    it('rechaza sin id', () => {
        expect(RoleSchema.safeParse({ name: 'USER' }).success).toBe(false);
    });
});

describe('CreateRoleSchema', () => {
    it('acepta solo name', () => {
        expect(CreateRoleSchema.safeParse({ name: 'MANAGER' }).success).toBe(true);
    });

    it('rechaza si name está ausente', () => {
        expect(CreateRoleSchema.safeParse({}).success).toBe(false);
    });
});

describe('UpdateRoleSchema', () => {
    it('acepta name opcional', () => {
        expect(UpdateRoleSchema.safeParse({ name: 'SUPERVISOR' }).success).toBe(true);
        expect(UpdateRoleSchema.safeParse({}).success).toBe(true);
    });
});
