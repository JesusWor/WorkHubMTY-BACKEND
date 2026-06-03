import { officeQueue, OFFICE_CHECKIN_TOLERANCE_MINUTES } from "./office-queue.js";
import { OfficeSlotsRepo } from "../../modules/office-slots/office-slots.repo.js";

export async function reviveOfficeJobs(repo: OfficeSlotsRepo): Promise<void> {
    await Promise.all([
        reviveNoShowJobs(repo),
        reviveCheckoutJobs(repo),
    ]);
}

async function reviveNoShowJobs(repo: OfficeSlotsRepo): Promise<void> {
    const pending = await repo.getPendingNoShowReservations(OFFICE_CHECKIN_TOLERANCE_MINUTES);

    if (pending.length === 0) {
        console.log("[office-revival] No hay jobs de no-show pendientes por re-encolar");
        return;
    }

    console.log(`[office-revival] Re-encolando ${pending.length} jobs de no-show...`);

    await Promise.all(
        pending.map(({ id, start_time }) => {
            const triggerAt = new Date(start_time).getTime() + OFFICE_CHECKIN_TOLERANCE_MINUTES * 60_000;
            const delay = Math.max(0, triggerAt - Date.now());

            return officeQueue.add(
                "no-show",
                { reservationId: id },
                {
                    delay,
                    jobId: `office-noshow-${id}`,
                }
            );
        })
    );

    console.log(`[office-revival] ${pending.length} jobs de no-show re-encolados`);
}

async function reviveCheckoutJobs(repo: OfficeSlotsRepo): Promise<void> {
    const pending = await repo.getPendingCheckoutReservations();

    if (pending.length === 0) {
        console.log("[office-revival] No hay jobs de auto-checkout pendientes por re-encolar");
        return;
    }

    console.log(`[office-revival] Re-encolando ${pending.length} jobs de auto-checkout...`);

    await Promise.all(
        pending.map(({ id, end_time }) => {
            const delay = Math.max(0, new Date(end_time).getTime() - Date.now());

            return officeQueue.add(
                "auto-checkout",
                { reservationId: id },
                {
                    delay,
                    jobId: `office-checkout-${id}`,
                }
            );
        })
    );

    console.log(`[office-revival] ${pending.length} jobs de auto-checkout re-encolados`);
}
