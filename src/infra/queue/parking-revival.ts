import { parkingQueue, CHECKIN_TOLERANCE_MINUTES_EXPORT } from "./parking-queue.js";
import { ParkingSlotsRepo } from "../../modules/parking-slots/parking-slots.repo.js";

export async function reviveParkingJobs(repo: ParkingSlotsRepo): Promise<void> {
    await Promise.all([
        reviveNoShowJobs(repo),
        reviveCheckoutJobs(repo),
    ]);
}

async function reviveNoShowJobs(repo: ParkingSlotsRepo): Promise<void> {
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
                }
            );
        })
    );

    console.log(`[revival] ${pending.length} jobs de no-show re-encolados`);
}

async function reviveCheckoutJobs(repo: ParkingSlotsRepo): Promise<void> {
    const pending = await repo.getPendingCheckoutReservations();

    if (pending.length === 0) {
        console.log("[revival] No hay jobs de auto-checkout pendientes por re-encolar");
        return;
    }

    console.log(`[revival] Re-encolando ${pending.length} jobs de auto-checkout...`);

    await Promise.all(
        pending.map(({ id, end_time }) => {
            const delay = Math.max(0, new Date(end_time).getTime() - Date.now());

            return parkingQueue.add(
                "auto-checkout",
                { reservationId: id },
                {
                    delay,
                    jobId: `checkout-${id}`,
                }
            );
        })
    );

    console.log(`[revival] ${pending.length} jobs de auto-checkout re-encolados`);
}