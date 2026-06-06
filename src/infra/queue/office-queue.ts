import { Queue } from "bullmq";
import { env } from "../../config/env.js";

const { redis: { host, port, password } } = env;

const connection = { host, port, password };

export type OfficeNoShowJobData = {
    reservationId: number;
};

export type OfficeCheckoutJobData = {
    reservationId: number;
};
export type OfficeUnblockJobData = {
    reservableId: number;
};


export type OfficeJobData = OfficeNoShowJobData | OfficeCheckoutJobData | OfficeUnblockJobData;

export const OFFICE_QUEUE_NAME = "office";

export const OFFICE_CHECKIN_TOLERANCE_MINUTES = 30;

export const officeQueue = new Queue<OfficeJobData>(OFFICE_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    },
});

export { connection as officeBullmqConnection };
