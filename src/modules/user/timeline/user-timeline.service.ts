import { OfficeSlotsService } from "../../office-slots/office-slots.service.js";
import { ParkingSlotsService } from "../../parking-slots/parking-slots.service.js";
import { EventsService } from "../../guest-events/guest-events.service.js";
import { FriendshipService } from "../../friendship/friendship.service.js";
import { ReservationWithParticipants } from "../../office-slots/office-slots.schema.js";
import { ReservationDetailResponse } from "../../parking-slots/parking-slots.schema.js";
import { EventWithCreator } from "../../guest-events/guest-events.schema.js";
import { JwtPayload } from "../../../middleware/index.js";
import { UserTimelineQuery } from "./user-timeline.schema.js";
import { BadRequestError } from "../../../shared/errors/AppError.js";

export type UserTimelineEntry = {
    eId: string;
    officeReservations?: ReservationWithParticipants[];
    parkingReservations?: ReservationDetailResponse[];
    events?: EventWithCreator[];
};

export type UserTimelineResponse = {
    from: string;
    to: string;
    user: UserTimelineEntry;
    friends?: UserTimelineEntry[];
};

export type UserTimelineServiceDeps = {
    officeSlots: OfficeSlotsService;
    parkingSlots: ParkingSlotsService;
    events: EventsService;
    friendship: FriendshipService;
};

export type UserTimelineService = {
    getTimeline: (
        eId: string,
        caller: JwtPayload,
        query: UserTimelineQuery
    ) => Promise<UserTimelineResponse>;
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

function resolveToDate(to?: string): string {
    return to ?? toISODate(new Date());
}

function validateDateOrder(from: string, to: string): void {
    if (new Date(from) > new Date(to)) {
        throw new BadRequestError("'from' must be earlier than or equal to 'to'");
    }
}

const toDatetimeStart = (date: string) => `${date}T00:00:00.000Z`;
const toDatetimeEnd   = (date: string) => `${date}T23:59:59.999Z`;

export function makeUserTimelineService(deps: UserTimelineServiceDeps): UserTimelineService {
    const { officeSlots, parkingSlots, events, friendship } = deps;

    async function buildEntry(
        eId: string,
        caller: JwtPayload,
        query: UserTimelineQuery,
        sharedEvents?: EventWithCreator[]
    ): Promise<UserTimelineEntry> {
        const entry: UserTimelineEntry = { eId };

        const tasks: Promise<void>[] = [];

        if (query.includeOfficeReservations) {
            tasks.push(
                officeSlots
                    .getUserReservationsView(eId, caller)
                    .then(({ reservations }) => {
                        const categories = query.officeCategories;
                        entry.officeReservations = categories && categories.length > 0
                            ? reservations.filter((r) => categories.includes(r.category as any))
                            : reservations;
                    })
            );
        }

        if (query.includeParkingReservations) {
            tasks.push(
                parkingSlots
                    .getUserReservations(eId)
                    .then((reservations) => {
                        entry.parkingReservations = reservations;
                    })
            );
        }

        if (query.includeEvents) {
            entry.events = sharedEvents ?? [];
        }

        await Promise.all(tasks);
        return entry;
    }

    const getTimeline = async (
        eId: string,
        caller: JwtPayload,
        query: UserTimelineQuery
    ): Promise<UserTimelineResponse> => {
        const to = resolveToDate(query.to);
        validateDateOrder(query.from, to);

        let sharedEvents: EventWithCreator[] | undefined;
        if (query.includeEvents) {
            const page = await events.listEvents({
                from: toDatetimeStart(query.from),
                to:   toDatetimeEnd(to),
                limit: 100,
            });
            sharedEvents = page.items;
        }

        const userEntry = await buildEntry(eId, caller, query, sharedEvents);

        const response: UserTimelineResponse = {
            from: query.from,
            to,
            user: userEntry,
        };

        const shouldIncludePeers = query.includeFriends || query.includeEIds.length > 0;

        if (shouldIncludePeers) {
            const friendIds = await friendship.getFriendIds(eId);
            const friendSet = new Set(friendIds);

            const peerSet = new Set<string>();

            if (query.includeFriends) {
                for (const fId of friendIds) peerSet.add(fId);
            }

            for (const id of query.includeEIds) {
                if (id !== eId && friendSet.has(id)) peerSet.add(id);
            }

            if (peerSet.size > 0) {
                response.friends = await Promise.all(
                    [...peerSet].map((friendEId) =>
                        buildEntry(friendEId, caller, query, sharedEvents)
                    )
                );
            } else {
                response.friends = [];
            }
        }

        return response;
    };

    return { getTimeline };
}
