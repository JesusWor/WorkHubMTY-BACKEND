import { parkingQueue, CHECKIN_TOLERANCE_MINUTES_EXPORT } from "./parking-queue.js";
import { ParkingSlotsRepo } from "../../modules/parking-slots/parking-slots.repo.js";

/**
 * Al reiniciar el servidor, re-encola los delayed jobs de no-show que pudieron
 * haberse perdido si el proceso cayó antes de poder encolarlos.
 *
 * BullMQ deduplica automáticamente por jobId, así que llamar esto es seguro
 * aunque el job ya exista en Redis — simplemente lo ignora.
 */
export async function reviveNoShowJobs(repo: ParkingSlotsRepo): Promise<void> {
    const pending = await repo.getPendingNoShowReservations(CHECKIN_TOLERANCE_MINUTES_EXPORT);

    if (pending.length === 0) {
        console.log("[revival] No hay jobs de no-show pendientes por re-encolar");
        return;
    }

    console.log(`[revival] Re-encolando ${pending.length} jobs de no-show...`);

    await Promise.all(
        pending.map(({ id, start_time }) => {
            const triggerAt = new Date(start_time).getTime() + CHECKIN_TOLERANCE_MINUTES_EXPORT * 60_000;
            const delay = Math.max(0, triggerAt - Date.now());

            return parkingQueue.add(
                "no-show",
                { reservationId: id },
                {
                    delay,
                    jobId: `noshow-${id}`,
                    // BullMQ ignora el add si el jobId ya existe en la queue
                }
            );
        })
    );

    console.log(`[revival] ${pending.length} jobs de no-show re-encolados`);
}
