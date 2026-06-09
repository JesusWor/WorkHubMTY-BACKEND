import { officeEvents } from "../../infra/events/office-events.emitter.js";
import type { UserStatsRepo, UserStats } from "./user-stats.repo.js";
import cron from 'node-cron';

/** Days of consecutive absence before the streak resets. */
const ASSISTANCE_WINDOW = 2;

const AP_DAILY_MULTIPLIER = 0.9; // -10% AP daily decay

export type UserStatsService = {
    getByUserId(userId: string): Promise<UserStats | null>;
    initListeners(): void;
    initScheduler(): void;
};

export function makeUserStatsService(repo: UserStatsRepo): UserStatsService {

    const getByUserId = async (userId: string): Promise<UserStats | null> => {
        return repo.getByUserId(userId);
    };

    const initListeners = (): void => {
        officeEvents.on("office.reservation.checkedout", ({ reservation, participants }) => {
            const checkedOut = participants.filter(
                (p) => p.attendance_status === "CHECKED_OUT",
            );

            for (const participant of checkedOut) {
                const minutesWorked =
                    (participant.updated_at.getTime() - reservation.start_time.getTime()) /
                    60_000;

                if (minutesWorked <= 0) continue;

                void repo
                    .upsertOnCheckout(participant.user_id, minutesWorked)
                    .catch((err) => {
                        console.error(
                            `[user-stats] upsertOnCheckout failed for user ${participant.user_id}:`,
                            err,
                        );
                    });
            }
        });
    };

    const initScheduler = (): void => {
        cron.schedule("0 0 * * 1-5", () => {
            void (async () => {
                try {
                    await repo.runDailyStreakTick(ASSISTANCE_WINDOW);
                    await repo.applyDailyApDecay(AP_DAILY_MULTIPLIER);
                    console.log("[user-stats] Daily tick completed.");
                } catch (err) {
                    console.error("[user-stats] Daily tick failed:", err);
                }
            })();
        });

        console.log("[user-stats] Scheduler registered (0 0 * * 1-5).");

    };

    return { getByUserId, initListeners, initScheduler };
}
