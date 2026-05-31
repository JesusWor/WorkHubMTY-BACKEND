import { Worker, Job } from "bullmq";
import {
    PARKING_QUEUE_NAME,
    NoShowJobData,
    CheckoutJobData,
    ParkingJobData,
    bullmqConnection,
} from "./parking-queue.js";
import { parkingEvents } from "../events/parking-events.emitter.js";
import { ParkingReservation } from "../../modules/parking-slots/parking-slots.schema.js";

export type ParkingWorkerDeps = {
    markNoShowForReservation: (reservationId: number) => Promise<
        | { marked: true; reservation: ParkingReservation }
        | { marked: false; reason: string }
    >;
    markCheckoutForReservation: (reservationId: number) => Promise<
        | { action: "checked_out" | "no_show_fallback"; reservation: ParkingReservation }
        | { action: "skipped"; reason: string }
    >;
};

export function createParkingWorker(deps: ParkingWorkerDeps): Worker {
    const worker = new Worker<ParkingJobData>(
        PARKING_QUEUE_NAME,
        async (job: Job<ParkingJobData>) => {
            switch (job.name) {
                case "no-show":
                    return handleNoShow(job as Job<NoShowJobData>, deps);
                case "auto-checkout":
                    return handleAutoCheckout(job as Job<CheckoutJobData>, deps);
                default:
                    console.warn(`[parking-worker] Job desconocido ignorado: ${job.name}`);
            }
        },
        {
            connection: bullmqConnection,
            concurrency: 5,
        }
    );

    worker.on("failed", (job, err) => {
        console.error(`[parking-worker] Job ${job?.id} (${job?.name}) falló:`, err.message);
    });

    worker.on("error", (err) => {
        console.error("[parking-worker] Error en el worker:", err.message);
    });

    return worker;
}

async function handleNoShow(
    job: Job<NoShowJobData>,
    deps: ParkingWorkerDeps
): Promise<void> {
    const { reservationId } = job.data;
    console.log(`[parking-worker] Procesando no-show job para reservación ${reservationId}`);

    const result = await deps.markNoShowForReservation(reservationId);

    if (result.marked) {
        console.log(`[parking-worker] Reservación ${reservationId} marcada como NO_SHOW`);
        parkingEvents.emit("reservation.no_show", result.reservation);
    } else {
        console.log(`[parking-worker] Reservación ${reservationId} omitida: ${result.reason}`);
    }
}

async function handleAutoCheckout(
    job: Job<CheckoutJobData>,
    deps: ParkingWorkerDeps
): Promise<void> {
    const { reservationId } = job.data;
    console.log(`[parking-worker] Procesando auto-checkout job para reservación ${reservationId}`);

    const result = await deps.markCheckoutForReservation(reservationId);

    switch (result.action) {
        case "checked_out":
            console.log(`[parking-worker] Reservación ${reservationId} marcada como CHECKED_OUT (auto)`);
            parkingEvents.emit("reservation.attendance_updated", result.reservation);
            break;
        case "no_show_fallback":
            console.warn(
                `[parking-worker] Reservación ${reservationId} marcada NO_SHOW por fallback defensivo ` +
                `en auto-checkout. El job de no-show pudo haber fallado o el servidor reinició.`
            );
            parkingEvents.emit("reservation.no_show", result.reservation);
            break;
        case "skipped":
            console.log(`[parking-worker] Reservación ${reservationId} omitida en auto-checkout: ${result.reason}`);
            break;
    }
}