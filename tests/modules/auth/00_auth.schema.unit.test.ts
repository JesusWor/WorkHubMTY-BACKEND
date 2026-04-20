import { describe, it, expect } from 'vitest';
import { UserAuthSchema, LoginSchema } from '../../../src/modules/auth/auth.schema';

describe('UserAuthSchema', () => {
  const valid = {
    eId: 'USR00001',
    passwordHash: '$2b$10$hashedpassword',
    roleName: 'Admin',
  };

  it('acepta un objeto válido', () => {
    const result = UserAuthSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('falla si eId está vacío', () => {
    const result = UserAuthSchema.safeParse({ ...valid, eId: '' });
    expect(result.success).toBe(false);

    const message = result.error!.issues[0].message;
    expect(message).toBe('El e_id es requerido');
  });

  it('falla si eId supera 8 caracteres', () => {
    const result = UserAuthSchema.safeParse({ ...valid, eId: 'TOOLONGID' });
    expect(result.success).toBe(false);

    const message = result.error!.issues[0].message;
    expect(message).toBe('El e_id no puede superar 8 caracteres');
  });

  it('falla si passwordHash no es string', () => {
    const result = UserAuthSchema.safeParse({ ...valid, passwordHash: 12345 });
    expect(result.success).toBe(false);
  });

  it('falla si roleName no es string', () => {
    const result = UserAuthSchema.safeParse({ ...valid, roleName: null });
    expect(result.success).toBe(false);
  });

  it('falla si faltan campos requeridos', () => {
    const result = UserAuthSchema.safeParse({ eId: 'USR00001' });
    expect(result.success).toBe(false);

    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toContain('passwordHash');
    expect(fields).toContain('roleName');
  });
});

describe('LoginSchema', () => {
  const valid = {
    eId: 'USR00001',
    password: 'password123',
  };

  it('acepta credenciales válidas', () => {
    const result = LoginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('falla si eId está vacío', () => {
    const result = LoginSchema.safeParse({ ...valid, eId: '' });
    expect(result.success).toBe(false);

    const message = result.error!.issues[0].message;
    expect(message).toBe('El e_id es requerido');
  });

  it('falla si eId supera 8 caracteres', () => {
    const result = LoginSchema.safeParse({ ...valid, eId: 'TOOLONGID' });
    expect(result.success).toBe(false);

    const message = result.error!.issues[0].message;
    expect(message).toBe('El e_id no puede superar 8 caracteres');
  });

  it('falla si password tiene menos de 3 caracteres', () => {
    const result = LoginSchema.safeParse({ ...valid, password: 'ab' });
    expect(result.success).toBe(false);

    const message = result.error!.issues[0].message;
    expect(message).toBe('La contraseña debe tener al menos 3 caracteres');
  });

  it('falla si password está ausente', () => {
    const result = LoginSchema.safeParse({ eId: 'USR00001' });
    expect(result.success).toBe(false);

    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toContain('password');
  });

  it('falla si eId está ausente', () => {
    const result = LoginSchema.safeParse({ password: 'password123' });
    expect(result.success).toBe(false);

    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toContain('eId');
  });

  it('falla si el body está completamente vacío', () => {
    const result = LoginSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error!.issues.length).toBeGreaterThanOrEqual(2);
  });
});
