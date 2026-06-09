/**
 * PREREQUISITO — antes de correr estos tests, registrar achievements en la app:
 *
 * 1. src/app/app.ts — agregar achievementsRouter al AppContainer y montarlo:
 *      router.use('/achievements', container.achievementsRouter);
 *
 * 2. src/app/testContainer.ts — construir y exportar el router:
 *      import { makeAchievementsRepo, makeAchievementsService, makeAchievementsController, makeAchievementsRouter } from '../modules/achievements';
 *      const achievementsRepo = makeAchievementsRepo(db);
 *      const achievementsService = makeAchievementsService(achievementsRepo);
 *      const achievementsController = makeAchievementsController(achievementsService);
 *      const achievementsRouter = makeAchievementsRouter(achievementsController);
 *      // incluir achievementsRouter en el objeto retornado
 *
 * 3. tests/utils/seed.util.ts — agregar tablas de achievements:
 *      achievements, achievement_levels, user_achievements
 *    y registrarlas en TABLE_ORDER respetando FKs:
 *      'roles', 'users', 'achievements', 'achievement_levels', 'user_achievements', ...
 *
 * NOTA: getRanking, getUserStats y getRecentActivity tienen bugs en el repo
 * (usan tabla `friends` con columna `status` que no existe en el schema actual,
 * y getRecentActivity referencia `ua.achieved_at` que tampoco está en la DB).
 * Esos endpoints NO se prueban aquí hasta que se corrijan.
 */

import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { SuccessResponseSchema, ErrorResponseSchema } from '../../utils/zod.util';
import { shouldSkipDbIntegration } from '../../utils/test-env';

const skipDbIntegration = shouldSkipDbIntegration();
const describeIfDb = skipDbIntegration ? describe.skip : describe;
let app: any;
let db: any;
let seed: any;

if (!skipDbIntegration) {
    const setup = await import('../../setup');
    const testContainer = await import('../../../src/app/testContainer');
    seed = setup.seed;
    ({ app, db } = testContainer.createTestApp());
    setup.useSeedSetup({ tables: ['roles', 'users', 'achievements', 'achievement_levels', 'user_achievements'] });
}

afterAll(async () => {
    if (!db) return;
    await db.close();
});

// Helper: login y obtener agent autenticado
async function loginAs(user: { eId: string; password: string }) {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ eId: user.eId, password: user.password }).expect(200);
    return agent;
}

const validAchievementBody = {
    code: 'TEST01',
    name: 'Test Achievement',
    description: 'Para pruebas de integración',
    levels: [
        { level: 1, progress_required: 10 },
        { level: 2, progress_required: 25 },
    ],
};

// ─── GET /api/achievements ─────────────────────────────────────────────────────

describeIfDb('GET /api/achievements', () => {
    it('retorna 401 si no está autenticado', async () => {
        await request(app)
            .get('/api/achievements')
            .expect(401);
    });

    it('retorna 200 y arreglo de logros (usuario normal)', async () => {
        const agent = await loginAs(seed.users[1]); // USER role
        await agent
            .get('/api/achievements')
            .expect(200)
            .expect('Content-Type', /json/)
            .expect((res) => {
                const parsed = SuccessResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
                if (!Array.isArray(res.body.data)) throw new Error('data debe ser un array');
            });
    });

    it('retorna 200 y arreglo de logros (admin)', async () => {
        const agent = await loginAs(seed.users[0]); // ADMIN role
        await agent
            .get('/api/achievements')
            .expect(200)
            .expect((res) => {
                if (!Array.isArray(res.body.data)) throw new Error('data debe ser un array');
            });
    });
});

// ─── GET /api/achievements/:id ─────────────────────────────────────────────────

describeIfDb('GET /api/achievements/:id', () => {
    it('retorna 401 si no está autenticado', async () => {
        await request(app).get('/api/achievements/1').expect(401);
    });

    it('retorna 404 si el logro no existe', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .get('/api/achievements/99999')
            .expect(404)
            .expect((res) => {
                const parsed = ErrorResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });
    });

    it('retorna 400 si el id no es numérico', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .get('/api/achievements/abc')
            .expect(400);
    });

    it('retorna 200 con datos del logro si existe', async () => {
        // Primero crea un logro como admin para luego buscarlo por id
        const admin = await loginAs(seed.users[0]);
        const createRes = await admin
            .post('/api/achievements')
            .send(validAchievementBody)
            .expect(200);

        const { id } = createRes.body.data;

        await admin
            .get(`/api/achievements/${id}`)
            .expect(200)
            .expect((res) => {
                const parsed = SuccessResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
                if (res.body.data.code !== validAchievementBody.code) throw new Error('code no coincide');
                if (res.body.data.name !== validAchievementBody.name) throw new Error('name no coincide');
            });
    });
});

// ─── GET /api/achievements/code/:code ─────────────────────────────────────────

describeIfDb('GET /api/achievements/code/:code', () => {
    it('retorna 401 si no está autenticado', async () => {
        await request(app).get('/api/achievements/code/TEST01').expect(401);
    });

    it('retorna 404 si el código no existe', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .get('/api/achievements/code/NOEXIST')
            .expect(404)
            .expect((res) => {
                const parsed = ErrorResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });
    });

    it('retorna 200 con el logro si el código existe', async () => {
        const admin = await loginAs(seed.users[0]);
        await admin.post('/api/achievements').send(validAchievementBody).expect(200);

        await admin
            .get(`/api/achievements/code/${validAchievementBody.code}`)
            .expect(200)
            .expect((res) => {
                const parsed = SuccessResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
                if (res.body.data.code !== validAchievementBody.code) throw new Error('code no coincide');
            });
    });
});

// ─── POST /api/achievements ────────────────────────────────────────────────────

describeIfDb('POST /api/achievements', () => {
    it('retorna 401 si no está autenticado', async () => {
        await request(app)
            .post('/api/achievements')
            .send(validAchievementBody)
            .expect(401);
    });

    it('retorna 403 si el usuario es USER (no tiene permiso)', async () => {
        const agent = await loginAs(seed.users[1]); // USER role
        await agent
            .post('/api/achievements')
            .send(validAchievementBody)
            .expect(403);
    });

    it('retorna 200 y el id del logro creado (admin)', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .post('/api/achievements')
            .send(validAchievementBody)
            .expect(200)
            .expect((res) => {
                const parsed = SuccessResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
                if (typeof res.body.data.id !== 'number') throw new Error('data.id debe ser número');
            });
    });

    it('retorna 409 si el código ya existe', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent.post('/api/achievements').send(validAchievementBody).expect(200);

        // Segundo intento con el mismo código
        await agent
            .post('/api/achievements')
            .send(validAchievementBody)
            .expect(409);
    });

    it('retorna 400 si el body está vacío', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .post('/api/achievements')
            .send({})
            .expect(400);
    });

    it('retorna 400 si levels está vacío', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .post('/api/achievements')
            .send({ ...validAchievementBody, levels: [] })
            .expect(400);
    });

    it('retorna 400 si falta el campo name', async () => {
        const agent = await loginAs(seed.users[0]);
        const { name: _, ...noName } = validAchievementBody;
        await agent
            .post('/api/achievements')
            .send(noName)
            .expect(400);
    });
});

// ─── PATCH /api/achievements/progress ─────────────────────────────────────────

describeIfDb('PATCH /api/achievements/progress', () => {
    it('retorna 401 si no está autenticado', async () => {
        await request(app)
            .patch('/api/achievements/progress')
            .send({ userId: 'USR00001', achievementId: 1, increment: 1 })
            .expect(401);
    });

    it('retorna 400 si faltan campos requeridos', async () => {
        const agent = await loginAs(seed.users[0]);
        await agent
            .patch('/api/achievements/progress')
            .send({})
            .expect(400);
    });

    it('retorna 200 al incrementar progreso de un logro existente', async () => {
        const admin = await loginAs(seed.users[0]);
        const createRes = await admin.post('/api/achievements').send(validAchievementBody).expect(200);
        const { id } = createRes.body.data;

        await admin
            .patch('/api/achievements/progress')
            .send({ userId: seed.users[0].eId, achievementId: id, increment: 5 })
            .expect(200)
            .expect((res) => {
                const parsed = SuccessResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });
    });
});
