import { Queue } from "bullmq";
import { env } from "../../config/env.js";

const { redis: { host, port, password } } = env;

// BullMQ necesita su propia conexión IORedis (no comparte con el redis client de la app)
const connection = { host, port, password };

export type NoShowJobData = {
    reservationId: number;
};

export type CheckoutJobData = {
    reservationId: number;
};

export type ParkingJobData = NoShowJobData | CheckoutJobData;

// Nombre canónico de la queue — úsalo en Queue y Worker para que coincidan
export const PARKING_QUEUE_NAME = "parking";

// Re-exportado para que revival.ts y otros módulos usen la misma fuente de verdad
export const CHECKIN_TOLERANCE_MINUTES_EXPORT = 30;

export const parkingQueue = new Queue<ParkingJobData>(PARKING_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    },
});

export { connection as bullmqConnection };
