import { Worker, Job } from "bullmq";
import { PARKING_QUEUE_NAME, NoShowJobData, bullmqConnection } from "./parking-queue.js";
import { parkingEvents } from "../events/parking-events.emitter.js";

// El worker recibe el repo vía factory para no acoplar a la instancia global de DB
export type NoShowWorkerDeps = {
    markNoShowForReservation: (reservationId: number) => Promise<
        { marked: true; reservation: import("../../modules/parking-slots/parking-slots.schema.js").ParkingReservation } |
        { marked: false; reason: string }
    >;
};

export function createParkingWorker(deps: NoShowWorkerDeps): Worker {
    const worker = new Worker<NoShowJobData>(
        PARKING_QUEUE_NAME,
        async (job: Job<NoShowJobData>) => {
            const { reservationId } = job.data;
            console.log(`[parking-worker] Procesando no-show job para reservación ${reservationId}`);

            const result = await deps.markNoShowForReservation(reservationId);

            if (result.marked) {
                console.log(`[parking-worker] Reservación ${reservationId} marcada como NO_SHOW`);
                parkingEvents.emit("reservation.no_show", result.reservation);
            } else {
                console.log(`[parking-worker] Reservación ${reservationId} omitida: ${result.reason}`);
            }
        },
        {
            connection: bullmqConnection,
            // Un concurrency razonable para no saturar la DB
            concurrency: 5,
        }
    );

    worker.on("failed", (job, err) => {
        console.error(`[parking-worker] Job ${job?.id} falló:`, err.message);
    });

    worker.on("error", (err) => {
        console.error("[parking-worker] Error en el worker:", err.message);
    });

    return worker;
}
