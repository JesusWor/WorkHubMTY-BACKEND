import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { ErrorResponseSchema } from '../../utils/zod.util';
import { shouldSkipDbIntegration } from '../../utils/test-env';

const skipDbIntegration = shouldSkipDbIntegration();
const describeIfDb = skipDbIntegration ? describe.skip : describe;
let app: any;
let db: any;
let seed: any;

if (!skipDbIntegration) {
    const setup = await import('../../setup');
    const testContainer = await import('../../../src/app/testContainer.js');
    seed = setup.seed;
    ({ app, db } = testContainer.createTestApp());
    setup.useSeedSetup({ tables: ['roles', 'users', 'parking_lots', 'parking_reservations'] });
}

const CursorResponseSchema = z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(z.object({ id: z.number() })),
    cursor: z.object({
        nextCursor: z.string().nullable(),
        hasNext: z.boolean(),
    }),
});

async function loginAs(user: { eId: string; password: string }) {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ eId: user.eId, password: user.password }).expect(200);
    return agent;
}

async function createReservation(agent: any, payload: Record<string, unknown>) {
    return agent
        .post('/api/parking/reservations')
        .send(payload)
        .expect(201);
}

describeIfDb('GET /api/parking/reservations', () => {
    it('retorna 401 si no esta autenticado', async () => {
        await request(app)
            .get('/api/parking/reservations')
            .expect(401);
    });

    it('retorna 403 si el usuario no es admin', async () => {
        const agent = await loginAs(seed.users[1]);
        await agent.get('/api/parking/reservations').query({ limit: 2 }).expect(403);
    });

    it('pagina con cursor encoded y no repite elementos', async () => {
        const admin = await loginAs(seed.users[0]);

        await createReservation(admin, {
            user_id: seed.users[1].eId,
            start_time: '2025-06-01T08:00:00.000Z',
            end_time: '2025-06-01T10:00:00.000Z',
        });
        await createReservation(admin, {
            user_id: seed.users[1].eId,
            start_time: '2025-06-02T08:00:00.000Z',
            end_time: '2025-06-02T10:00:00.000Z',
        });
        await createReservation(admin, {
            user_id: seed.users[1].eId,
            start_time: '2025-06-03T08:00:00.000Z',
            end_time: '2025-06-03T10:00:00.000Z',
        });

        const firstPage = await admin
            .get('/api/parking/reservations')
            .query({ limit: 2 })
            .expect(200)
            .expect((res) => {
                const parsed = CursorResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });

        const firstBody = firstPage.body as z.infer<typeof CursorResponseSchema>;
        expect(firstBody.data).toHaveLength(2);
        expect(firstBody.cursor.hasNext).toBe(true);
        expect(firstBody.cursor.nextCursor).not.toBeNull();

        const secondPage = await admin
            .get('/api/parking/reservations')
            .query({ limit: 2, cursor: firstBody.cursor.nextCursor })
            .expect(200)
            .expect((res) => {
                const parsed = CursorResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });

        const secondBody = secondPage.body as z.infer<typeof CursorResponseSchema>;
        expect(secondBody.data.length).toBeGreaterThan(0);
        expect(secondBody.data[0].id).not.toBe(firstBody.data[1].id);
        expect(secondBody.cursor.hasNext).toBe(false);
        expect(secondBody.cursor.nextCursor).toBeNull();
    });

    it('retorna 400 si limit es menor a 1', async () => {
        const admin = await loginAs(seed.users[0]);
        await admin
            .get('/api/parking/reservations')
            .query({ limit: 0 })
            .expect(400)
            .expect((res) => {
                const parsed = ErrorResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });
    });

    it('retorna 400 si limit es mayor a 100', async () => {
        const admin = await loginAs(seed.users[0]);
        await admin
            .get('/api/parking/reservations')
            .query({ limit: 101 })
            .expect(400);
    });

    it('retorna 400 si el cursor es invalido', async () => {
        const admin = await loginAs(seed.users[0]);
        await admin
            .get('/api/parking/reservations')
            .query({ limit: 2, cursor: 'not-a-cursor' })
            .expect(400)
            .expect((res) => {
                const parsed = ErrorResponseSchema.safeParse(res.body);
                if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format()));
            });
    });
});

afterAll(async () => {
    if (!db) return;
    await db.close();
});
