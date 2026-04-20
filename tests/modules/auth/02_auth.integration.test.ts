import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { seed } from '../../setup';
import { createTestApp } from '../../../src/app/testContainer';
import { SuccessResponseSchema, ErrorResponseSchema, ZodErrorResponseSchema } from '../../utils/zod.util';

const { app, db } = createTestApp();
const agent = request.agent(app);
const cookies = request.cookies;

const validCredentials = {
  eId: seed.users[0].eId,
  password: seed.users[0].password,
};

beforeAll(async () => {
  await agent
    .post('/api/auth/login')
    .send(validCredentials)
    .expect(200);
});

afterAll(async () => {
  await db.close();
});

describe('POST /api/auth/login', () => {

  it('retorna 200, body válido y setea cookie httpOnly', async () => {
    await request(app)
      .post('/api/auth/login')
      .send(validCredentials)
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(cookies.set({ name: 'token', options: { httponly: true } }))
      .expect((res) => {
        const parsed = SuccessResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
        if (res.body.message !== 'Login exitoso') throw new Error(`Mensaje inesperado: ${res.body.message}`);
      });
  });

  it('retorna 401 si el usuario no existe', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ eId: 'NOEXIST', password: 'password123' })
      .expect(401)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const parsed = ErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
        if (res.body.message !== 'Credenciales inválidas') throw new Error(`Mensaje inesperado: ${res.body.message}`);
      });
  });

  it('retorna 401 si la contraseña es incorrecta', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ eId: seed.users[0].eId, password: 'wrongpassword' })
      .expect(401)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const parsed = ErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
        if (res.body.message !== 'Credenciales inválidas') throw new Error(`Mensaje inesperado: ${res.body.message}`);
      });
  });

  it('retorna 422 con errores de validación si el body está vacío', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(422)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const parsed = ZodErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));

        const fields = res.body.errors.map((e: { field: string }) => e.field);
        if (!fields.includes('eId')) throw new Error('Falta error en campo eId');
        if (!fields.includes('password')) throw new Error('Falta error en campo password');
      });
  });

  it('retorna 422 si password tiene menos de 3 caracteres', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ eId: 'USR00001', password: 'ab' })
      .expect(422)
      .expect((res) => {
        const parsed = ZodErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));

        const passwordError = res.body.errors.find((e: { field: string }) => e.field === 'password');
        if (!passwordError) throw new Error('No hay error en campo password');
        if (passwordError.message !== 'La contraseña debe tener al menos 3 caracteres') {
          throw new Error(`Mensaje inesperado: ${passwordError.message}`);
        }
      });
  });

  it('retorna 422 si eId supera 8 caracteres', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ eId: 'TOOLONGID', password: 'password123' })
      .expect(422)
      .expect((res) => {
        const parsed = ZodErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));

        const eIdError = res.body.errors.find((e: { field: string }) => e.field === 'eId');
        if (!eIdError) throw new Error('No hay error en campo eId');
        if (eIdError.message !== 'El e_id no puede superar 8 caracteres') {
          throw new Error(`Mensaje inesperado: ${eIdError.message}`);
        }
      });
  });
});

describe('POST /api/auth/logout', () => {

  it('retorna 401 si no hay cookie token', async () => {
    // Plain request(app) — no agent, no cookie
    await request(app)
      .post('/api/auth/logout')
      .expect(401)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const parsed = ErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
      });
  });

  it('retorna 401 si el token es inválido', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'token=this.is.not.a.valid.jwt')
      .expect(401)
      .expect((res) => {
        const parsed = ErrorResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
      });
  });

  it('retorna 200 y limpia la cookie con token válido (via agent)', async () => {
    // agent already has the token cookie from beforeAll — no manual extraction needed
    await agent
      .post('/api/auth/logout')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(cookies.contain({ name: 'token', value: '', options: { httponly: true } }))
      .expect((res) => {
        const parsed = SuccessResponseSchema.safeParse(res.body);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
        if (res.body.message !== 'Logout exitoso') throw new Error(`Mensaje inesperado: ${res.body.message}`);
      });
  });
});