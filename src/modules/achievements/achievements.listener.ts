import type { AchievementsService } from "../../modules/achievements/achievements.service.js";
import type { TypedEventEmitter } from "../../infra/events/typed-event-emitter.js";
import { type ParkingEventMap, parkingEvents } from "../../infra/events/parking-events.emitter.js";
import { type UserEventMap, userEvents } from "../../infra/events/user-events.emitter.js";
import { type TeamEventMap, teamEvents } from "../../infra/events/team-events.emitter.js";


export type GlobalEventMap = ParkingEventMap & UserEventMap & TeamEventMap;

export const emitterForEvent: {
    [K in keyof GlobalEventMap]: TypedEventEmitter<Pick<GlobalEventMap, K>>;
} = {
    "reservation.created": parkingEvents,
    "reservation.canceled": parkingEvents,
    "reservation.attendance_updated": parkingEvents,
    "reservation.no_show": parkingEvents,
    "lot.created": parkingEvents,
    "lot.updated": parkingEvents,
    "lot.deleted": parkingEvents,
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
        event: "reservation.created",
        achievementId: 3,
        description: "CEO de reservaciones",
        handler: async (ctx, reservation) => {
            await ctx.addProgress(reservation.user_id, ctx.achievementId, 1);
        },
    }),
    defineRule({
        event: "reservation.no_show",
        achievementId: 4,
        description: "No me olvides",
        handler: async (ctx, reservation) => {
            await ctx.addProgress(reservation.user_id, ctx.achievementId, 1);
        },
    }),
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
