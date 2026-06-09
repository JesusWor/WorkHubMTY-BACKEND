import { describe, it, expect } from 'vitest';
import { UserAuthSchema, LoginSchema } from '../../../src/modules/auth/auth.schema.js';

describe('UserAuthSchema', () => {
  const valid = {
    eId: 'USR00001',
    name: 'Ana',
    passwordHash: '$2b$10$hashedpassword',
    roleName: 'Admin',
  };

  it('acepta un usuario auth valido', () => {
    expect(UserAuthSchema.safeParse(valid).success).toBe(true);
  });

  it('valida eId, passwordHash y roleName', () => {
    expect(UserAuthSchema.safeParse({ ...valid, eId: '' }).success).toBe(false);
    expect(UserAuthSchema.safeParse({ ...valid, eId: 'TOOLONGID' }).success).toBe(false);
    expect(UserAuthSchema.safeParse({ ...valid, passwordHash: 123 }).success).toBe(false);
    expect(UserAuthSchema.safeParse({ ...valid, roleName: null }).success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('acepta credenciales validas', () => {
    expect(LoginSchema.safeParse({ eId: 'USR00001', password: 'password123' }).success).toBe(true);
  });

  it('rechaza eId invalido y password corto', () => {
    expect(LoginSchema.safeParse({ eId: '', password: 'password123' }).success).toBe(false);
    expect(LoginSchema.safeParse({ eId: 'TOOLONGID', password: 'password123' }).success).toBe(false);
    expect(LoginSchema.safeParse({ eId: 'USR00001', password: 'ab' }).success).toBe(false);
  });
});
