import { Worker, Job } from "bullmq";
import {
    OFFICE_QUEUE_NAME,
    OfficeNoShowJobData,
    OfficeCheckoutJobData,
    officeBullmqConnection,
} from "./office-queue.js";
import { officeEvents } from "../events/office-events.emitter.js";
import type { Reservation, Participant } from "../../modules/office-slots/office-slots.schema.js";
import type { Reservable } from "../../modules/office-slots/office-slots.schema.js";

type JobData = OfficeNoShowJobData | OfficeCheckoutJobData;

export type OfficeWorkerDeps = {
    markNoShowForReservation: (reservationId: number) => Promise<
        | { marked: true;  reservation: Reservation; participants: Participant[] }
        | { marked: false; reason: string }
    >;
    markCheckoutForReservation: (reservationId: number) => Promise<
        | { action: "checked_out" | "no_show_fallback"; reservation: Reservation; participants: Participant[] }
        | { action: "skipped"; reason: string }
    >;
    getReservableById: (id: number) => Promise<Reservable | null>;
};

export function createOfficeWorker(deps: OfficeWorkerDeps): Worker {
    const worker = new Worker<JobData>(
        OFFICE_QUEUE_NAME,
        async (job: Job<JobData>) => {
            switch (job.name) {
                case "no-show":
                    return handleNoShow(job as Job<OfficeNoShowJobData>, deps);
                case "auto-checkout":
                    return handleAutoCheckout(job as Job<OfficeCheckoutJobData>, deps);
                default:
                    console.warn(`[office-worker] Job desconocido ignorado: ${job.name}`);
            }
        },
        {
            connection: officeBullmqConnection,
            concurrency: 5,
        }
    );

    worker.on("failed", (job, err) => {
        console.error(`[office-worker] Job ${job?.id} (${job?.name}) falló:`, err.message);
    });

    worker.on("error", (err) => {
        console.error("[office-worker] Error en el worker:", err.message);
    });

    return worker;
}

async function handleNoShow(
    job: Job<OfficeNoShowJobData>,
    deps: OfficeWorkerDeps
): Promise<void> {
    const { reservationId } = job.data;
    console.log(`[office-worker] Procesando no-show para reservación ${reservationId}`);

    const result = await deps.markNoShowForReservation(reservationId);

    if (!result.marked) {
        console.log(`[office-worker] Reservación ${reservationId} omitida: ${result.reason}`);
        return;
    }

    console.log(`[office-worker] Reservación ${reservationId} marcada como NO_SHOW`);

    const reservable = await deps.getReservableById(result.reservation.reservable_id);
    if (!reservable) {
        console.warn(`[office-worker] No se encontró el slot para reservación ${reservationId}`);
        return;
    }

    officeEvents.emit("reservation.noshow", {
        reservation:  result.reservation,
        participants: result.participants,
        reservable,
    });
}

async function handleAutoCheckout(
    job: Job<OfficeCheckoutJobData>,
    deps: OfficeWorkerDeps
): Promise<void> {
    const { reservationId } = job.data;
    console.log(`[office-worker] Procesando auto-checkout para reservación ${reservationId}`);

    const result = await deps.markCheckoutForReservation(reservationId);

    if (result.action === "skipped") {
        console.log(`[office-worker] Reservación ${reservationId} omitida en auto-checkout: ${result.reason}`);
        return;
    }

    const reservable = await deps.getReservableById(result.reservation.reservable_id);
    if (!reservable) {
        console.warn(`[office-worker] No se encontró el slot para reservación ${reservationId}`);
        return;
    }

    switch (result.action) {
        case "checked_out":
            console.log(`[office-worker] Reservación ${reservationId} marcada como CHECKED_OUT (auto)`);
            officeEvents.emit("reservation.checkedout", {
                reservation:  result.reservation,
                participants: result.participants,
                reservable,
            });
            break;

        case "no_show_fallback":
            console.warn(
                `[office-worker] Reservación ${reservationId} marcada NO_SHOW por fallback defensivo. ` +
                `El job de no-show pudo haber fallado o el servidor reinició.`
            );
            officeEvents.emit("reservation.noshow", {
                reservation:  result.reservation,
                participants: result.participants,
                reservable,
            });
            break;
    }
}
