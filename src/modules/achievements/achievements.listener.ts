import type { AchievementsService } from "../../modules/achievements/achievements.service.js";
import type { TypedEventEmitter } from "../../infra/events/typed-event-emitter.js";
import { type OfficeEventMap, officeEvents } from "../../infra/events/office-events.emitter.js";
import { type ParkingEventMap, parkingEvents } from "../../infra/events/parking-events.emitter.js";
import { type UserEventMap, userEvents } from "../../infra/events/user-events.emitter.js";
import { type TeamEventMap, teamEvents } from "../../infra/events/team-events.emitter.js";

import { CHECKIN_TOLERANCE_MINUTES } from "../parking-slots/parking-slots.service.js";
const MINUTES_TO_MS = 60 * 1000;

export type GlobalEventMap = OfficeEventMap & ParkingEventMap & UserEventMap & TeamEventMap;

export const emitterForEvent: {
    [K in keyof GlobalEventMap]: TypedEventEmitter<Pick<GlobalEventMap, K>>;
} = {
    "office.reservation.created": officeEvents,
    "office.reservation.canceled": officeEvents,
    "office.reservation.checkedin": officeEvents,
    "office.reservation.attendance_updated": officeEvents,
    "office.reservation.noshow": officeEvents,
    "office.reservation.checkedout": officeEvents,
    "office.participant.updated": officeEvents,
    "office.slot.created": officeEvents,
    "office.slot.updated": officeEvents,
    "office.slot.deleted": officeEvents,

    "parking.reservation.created": parkingEvents,
    "parking.reservation.canceled": parkingEvents,
    "parking.reservation.attendance_updated": parkingEvents,
    "parking.reservation.noshow": parkingEvents,
    "parking.lot.created": parkingEvents,
    "parking.lot.updated": parkingEvents,
    "parking.lot.deleted": parkingEvents,

    "user.created": userEvents,
    "user.updated": userEvents,
    "user.deleted": userEvents,
    "guest.created": userEvents,
    "guest.updated": userEvents,
    "guest.deleted": userEvents,
    "friendship.created": userEvents,
    "friendship.removed": userEvents,
    "friendRequest.sent": userEvents,
    "friendRequest.accepted": userEvents,
    "friendRequest.canceled": userEvents,
    "friendRequest.rejected": userEvents,
    "team.created": teamEvents,
    "team.updated": teamEvents,
    "team.deleted": teamEvents,
    "team.memberAdded": teamEvents,
    "team.memberRemoved": teamEvents,
};

type EventKey = Extract<keyof GlobalEventMap, string>;

export type AchievementRuleContext = {
    achievementId: number;
    addProgress: Pick<AchievementsService, "addProgress">["addProgress"];
};

export type AchievementRule<K extends EventKey = EventKey> = {
    event: K;
    achievementId: number;
    description: string;
    handler: (
        ctx: AchievementRuleContext,
        ...args: GlobalEventMap[K]
    ) => void | Promise<void>;
};

function defineRule<K extends EventKey>(rule: AchievementRule<K>): AchievementRule<K> {
    return rule;
}

// Preserva los K concretos por elemento sin intentar unificarlos
function defineRules<const T extends readonly AchievementRule<any>[]>(rules: T): T {
    return rules;
}

export const achievementRules = defineRules([
    defineRule({
        event: "friendship.created",
        achievementId: 1,
        description: "Red personal",
        handler: async (ctx, friendship) => {
            await Promise.all([
                ctx.addProgress(friendship.userLow, ctx.achievementId, 1),
                ctx.addProgress(friendship.userHigh, ctx.achievementId, 1),
            ]);
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 2,
        description: "¡Presente!",
        handler: async (ctx, payload) => {
            if (payload.reservation.attendance_status === "CHECKED_IN") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "CHECKED_IN") {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
    defineRule({
        event: "office.reservation.created",
        achievementId: 3,
        description: "CEO de reservaciones",
        handler: async (ctx, payload) => {
            const owner = payload.participants.find((p) => p.ownership_priority === 0);
            if (owner) {
                await ctx.addProgress(owner.user_id, ctx.achievementId, 1);
            }
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 4,
        description: "No me olvides",
        handler: async (ctx, payload) => {
            if (payload.reservation.attendance_status === "NO_SHOW") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "NO_SHOW") {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
    defineRule({
        event: "office.reservation.created",
        achievementId: 5,
        description: "La casa invita",
        handler: async (ctx, payload) => {
            const owner = payload.participants.find((p) => p.ownership_priority === 0);
            if (owner) {
                await ctx.addProgress(owner.user_id, ctx.achievementId, payload.participants.length);
            }
        },
    }),
    defineRule({
        event: "parking.reservation.attendance_updated",
        achievementId: 6,
        description: "Quemando llanta",
        handler: async (ctx, reservation) => {
            if (reservation.attendance_status === "CHECKED_IN"
                && (reservation.start_time.getTime() + CHECKIN_TOLERANCE_MINUTES * MINUTES_TO_MS - 5 * MINUTES_TO_MS) < reservation.updated_at.getTime()
                && reservation.updated_at.getTime() < (reservation.start_time.getTime() + CHECKIN_TOLERANCE_MINUTES * MINUTES_TO_MS)
            ) {
                await ctx.addProgress(reservation.user_id, ctx.achievementId, 1);
            }
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 7,
        description: "Deja abajo",
        handler: async (ctx, payload) => {
            if (payload.reservation.lifecycle_status === "FINALIZED") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "REJECTED") {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 8,
        description: "Madrugador",
        handler: async (ctx, payload) => {
            if (payload.reservation.lifecycle_status === "FINALIZED") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "CHECKED_IN" && payload.reservation.start_time.getHours() <= 9) {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 9,
        description: "Indeciso",
        handler: async (ctx, payload) => {
            if (payload.reservation.lifecycle_status === "FINALIZED") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "CANCELED") {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 10,
        description: "Extrovertido",
        handler: async (ctx, payload) => {
            if (payload.reservation.attendance_status === "CHECKED_OUT") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "CHECKED_IN" && payload.participants.length > 5) {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
    defineRule({
        event: "office.reservation.attendance_updated",
        achievementId: 11,
        description: "Lobo solitario",
        handler: async (ctx, payload) => {
            if (payload.reservation.attendance_status === "CHECKED_OUT") {
                payload.participants.forEach(async (p) => {
                    if (p.attendance_status === "CHECKED_IN" && payload.participants.length === 1) {
                        await ctx.addProgress(p.user_id, ctx.achievementId, 1);
                    }
                });
            }
        },
    }),
]);

export async function validateAchievementRules(
    rules: readonly Pick<AchievementRule, "achievementId">[],
    achievementsService: Pick<AchievementsService, "getById">,
    errorLabel = "listener"
): Promise<void> {
    const uniqueIds = [...new Set(rules.map((r) => r.achievementId))];
    const missingIds: number[] = [];

    for (const id of uniqueIds) {
        const achievement = await achievementsService.getById(id);
        if (!achievement) missingIds.push(id);
    }

    if (missingIds.length > 0) {
        throw new Error(
            `Missing achievements required by ${errorLabel}: ${missingIds.join(", ")}`
        );
    }
}

export async function validateAchievementsListenerRules(
    achievementsService: Pick<AchievementsService, "getById">
): Promise<void> {
    await validateAchievementRules(achievementRules, achievementsService, "achievement listener");
}

// K fijo en la firma → emitterForEvent[rule.event] no es union → .on() es callable
function registerRule<K extends EventKey>(
    rule: AchievementRule<K>,
    achievementsService: Pick<AchievementsService, "addProgress">
): void {
    const emitter = emitterForEvent[rule.event];
    const event = rule.event as Extract<K, string>;

    emitter.on(event, (...args) => {
        void Promise.resolve(
            rule.handler(
                {
                    achievementId: rule.achievementId,
                    addProgress: achievementsService.addProgress,
                },
                ...args
            )
        ).catch((err) => {
            console.error(`[achievements] Rule "${rule.description}" failed:`, err);
        });
    });
}

// Distributive helper: procesa cada elemento de la tuple con su K concreto
function registerRules<T extends readonly AchievementRule<any>[]>(
    rules: T,
    achievementsService: Pick<AchievementsService, "addProgress">
): void {
    for (const rule of rules) {
        registerRule(rule as AchievementRule<any>, achievementsService);
    }
}

export function initAchievementsListeners(
    achievementsService: Pick<AchievementsService, "addProgress">
): void {
    registerRules(achievementRules, achievementsService);
}
