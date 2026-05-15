import { OfficeSlotsRepo } from "./office-slots.repo.js";
import {
    OfficeSlot,
    CreateOfficeSlotBody,
    UpdateOfficeSlotBody,
    BlockSlotBody,
    AvailableOfficeSlotsQuery,
    SlotAvailabilityResult,
    FriendOccupancy,
    CreateReservationBatchBody,
    ReservationDetail,
    ReservationParticipant,
    WorkGroup,
    UserSummary,
    GuestSummary,
    ParticipantStatus,
    UserReservationSummary,
    FriendReservationsSummary,
    Event,
    CreateEventBody,
    GetEventsQuery,
} from "./office-slots.schema.js";
import { NotFoundError, UnprocessableError } from "../../shared/errors/AppError.js";
import { FriendshipService } from "../friendship/friendship.service.js";
import { UserService } from "../user/user.service.js";

export type OfficeSlotsService = {
    getAvailableSlots: (query: AvailableOfficeSlotsQuery) => Promise<SlotAvailabilityResult[]>;
    getAllSlots: (filters: { floor_id?: number }) => Promise<any[]>;
    getSlotById: (id: number) => Promise<OfficeSlot>;
    createSlot: (data: CreateOfficeSlotBody) => Promise<OfficeSlot>;
    updateSlot: (id: number, data: UpdateOfficeSlotBody) => Promise<OfficeSlot>;
    deleteSlot: (id: number) => Promise<{ message: string }>;
    setBlockStatus: (id: number, body: BlockSlotBody) => Promise<OfficeSlot>;
    getWorkGroups: () => Promise<WorkGroup[]>;
    getUsers: () => Promise<UserSummary[]>;
    getGuests: () => Promise<GuestSummary[]>;
    getReservationDetail: (id: number) => Promise<ReservationDetail>;
    createReservationBatch: (data: CreateReservationBatchBody, currentUserId?: string) => Promise<ReservationDetail[]>;
    updateParticipantStatus: (participantId: number, status: ParticipantStatus, reinvite?: boolean) => Promise<ReservationParticipant>;
    getMyReservations: (userId: string) => Promise<UserReservationSummary>;
    getMyFriendsReservations: (userId: string) => Promise<FriendReservationsSummary>;
    // ─── Events ───────────────────────────────────────────────────────────────────
    getEvents: (query: GetEventsQuery) => Promise<Event[]>;
    getEventById: (id: number) => Promise<Event>;
    createEvent: (data: CreateEventBody) => Promise<Event>;
};

export function makeOfficeSlotsService(repo: OfficeSlotsRepo, friendshipService?: FriendshipService, userService?: UserService): OfficeSlotsService {
    // FEATURE 1: OFFICE SLOTS (Espacios de trabajo)
    const toHourMinute = (iso: string): string => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toISOString().slice(11, 16);
    };

    const deriveStatus = (row: { is_blocked: any; is_available: any; current_reservations?: number; capacity: number }) => {
        if (Boolean(row.is_blocked)) {
            return { status: "occupied" as const, statusLabel: "Ocupado" };
        }
        if (!Boolean(row.is_available)) {
            return { status: "occupied" as const, statusLabel: "Ocupado" };
        }
        if ((row.current_reservations ?? 0) > 0 && (row.current_reservations ?? 0) < row.capacity) {
            return { status: "soon" as const, statusLabel: "Por comenzar" };
        }
        return { status: "available" as const, statusLabel: "Disponible" };
    };

    const getAvailableSlots = async (query: AvailableOfficeSlotsQuery): Promise<SlotAvailabilityResult[]> => {
        const { start_time, end_time, user_id, floor_id } = query;

        const rows = await repo.findAvailable(start_time, end_time, { floor_id });
        let friendShipMap: Record<number, FriendOccupancy[]> = {};

        if (user_id) {
            const slotIds = rows.map((r) => r.id as number);
            const occupancy = await repo.findFriendOccupancy(slotIds, user_id, start_time, end_time);
            for (const occ of occupancy) {
                const sid = (occ as any).slot_id as number;
                if (!friendShipMap[sid]) {
                    friendShipMap[sid] = [];
                }
                friendShipMap[sid].push(occ);
            }
        }

        return rows.map((r) => ({
            ...(deriveStatus(r)),
            id: r.id,
            name: r.name,
            code: r.name,
            capacity: r.capacity,
            floor_id: r.floor_id,
            floor_name: r.floor_name,
            is_blocked: Boolean(r.is_blocked),
            is_available: Boolean(r.is_available),
            timeline: [
                {
                    id: `search-${r.id}`,
                    start: toHourMinute(start_time),
                    end: toHourMinute(end_time),
                    status: Boolean(r.is_available) ? "free" : "occupied",
                },
            ],
            occupied_by_friends: friendShipMap[r.id] ?? [],
        }));
    };

    const getAllSlots = async (filters: { floor_id?: number }): Promise<any[]> => {
        return repo.findAll(filters);
    };

    const getSlotById = async (id: number): Promise<OfficeSlot> => {
        const slot = await repo.findById(id);
        if (!slot) throw new NotFoundError(`Slot ${id} no encontrado`);
        return slot;
    };

    const createSlot = async (data: CreateOfficeSlotBody): Promise<OfficeSlot> => {
        const floorOk = await repo.floorExists(data.floor_id);
        if (!floorOk) throw new UnprocessableError(`El piso ${data.floor_id} no existe`);
        const id = await repo.create(data);
        return (await repo.findById(id))!;
    };

    const updateSlot = async (id: number, data: UpdateOfficeSlotBody): Promise<OfficeSlot> => {
        await getSlotById(id);
        if (data.floor_id !== undefined) {
            const floorOk = await repo.floorExists(data.floor_id);
            if (!floorOk) throw new UnprocessableError(`El piso ${data.floor_id} no existe`);
        }
        await repo.update(id, data);
        return (await repo.findById(id))!;
    };

    const deleteSlot = async (id: number): Promise<{ message: string }> => {
        await getSlotById(id);
        await repo.remove(id);
        return { message: `Slot ${id} eliminado` };
    };

    const setBlockStatus = async (id: number, body: BlockSlotBody): Promise<OfficeSlot> => {
        await getSlotById(id);
        await repo.setBlocked(id, body.is_blocked);
        return (await repo.findById(id))!;
    };

    // FEATURE 2: WORK GROUPS (Grupos de trabajo)

    const getWorkGroups = async (): Promise<WorkGroup[]> => {
        return repo.findWorkGroups();
    };

    // FEATURE 3: RESERVATIONS (Reservaciones)

    const getReservationDetail = async (id: number): Promise<ReservationDetail> => {
        const reservation = await repo.findReservationById(id);
        if (!reservation) throw new NotFoundError(`Reservation ${id} no encontrada`);

        const reservationWorkGroups = await repo.findReservationWorkGroups([id]);
        const reservationParticipants = await repo.findParticipantsByReservationIds([id]);

        return {
            id: reservation.id,
            reservableId: reservation.reservable_id,
            startTime: reservation.start_time,
            endTime: reservation.end_time,
            description: reservation.description,
            canOverlap: Boolean(reservation.can_overlap),
            workGroups: reservationWorkGroups.map((wg) => ({
                id: wg.id,
                name: wg.name,
                description: wg.description,
            })),
            participants: reservationParticipants.map((participant) => ({
                id: participant.id,
                reservationId: participant.reservationId,
                userId: participant.userId,
                guestId: participant.guestId,
                ownershipPriority: participant.ownershipPriority,
                checkedIn: Boolean(participant.checkedIn),
                status: participant.status as ParticipantStatus,
                user: participant.userId ? {
                    id: participant.userId,
                    name: participant.user_name ?? "",
                    email: participant.user_email ?? "",
                    role: participant.user_role ?? "",
                } : null,
                guest: participant.guestId ? {
                    id: participant.guestId,
                    name: participant.guest_name ?? "",
                    email: participant.guest_email ?? "",
                } : null,
            })),
        };
    };

    const createReservationBatch = async (data: CreateReservationBatchBody, currentUserId?: string): Promise<ReservationDetail[]> => {
        const { reservableId, description, schedules, workGroupIds = [], userIds = [], guestIds = [], canOverlap } = data;

        const slot = await getSlotById(reservableId);
        if (!slot) throw new NotFoundError(`Reservable ${reservableId} no encontrado`);

        const scheduleErrors = schedules.map((schedule) => {
            if (schedule.end_time <= schedule.start_time) return `End must be after start for ${schedule.start_time}`;
            if (new Date(schedule.start_time).toDateString() !== new Date(schedule.end_time).toDateString()) return `Start and end must be same day for ${schedule.start_time}`;
            return null;
        }).filter(Boolean);
        if (scheduleErrors.length > 0) {
            throw new UnprocessableError(scheduleErrors.join("; "));
        }

        const groupMembers = workGroupIds.length > 0 ? await repo.findWorkGroupMembers(workGroupIds) : [];
        const allUserIds = [...userIds, ...groupMembers.map((member) => member.user_id)];
        const uniqueUserIds = Array.from(new Set(allUserIds));
        const uniqueGuestIds = Array.from(new Set(guestIds ?? []));

        const participants: Array<{ userId: string | null; guestId: number | null; ownershipPriority: number; status: ParticipantStatus }> = [];
        let priority = 0;

        if (currentUserId) {
            participants.push({ userId: currentUserId, guestId: null, ownershipPriority: priority++, status: "ACCEPTED" });
        }

        // ✅ CAMBIO: Marcar al registrador (currentUserId) como ACCEPTED, otros como PENDING
        for (const userId of uniqueUserIds) {
            if (userId === currentUserId) continue;
            participants.push({ userId, guestId: null, ownershipPriority: priority++, status: "PENDING" });
        }

        for (const guestId of uniqueGuestIds) {
            participants.push({ userId: null, guestId, ownershipPriority: priority++, status: "PENDING" });
        }

        if (participants.length === 0) {
            throw new UnprocessableError("Debe haber al menos un invitado o usuario en la reservación");
        }

        // ── Overlap validation & inserts (one per schedule) ──────────────────────
        // When canOverlap=false, we validate against:
        //   1. Other reservations with can_overlap=0 in the same window
        //   2. Any event in the same window (events always block)
        //
        // All reads happen before any writes so that we fail fast without partial
        // inserts. The writes themselves are not wrapped in an explicit BEGIN/COMMIT
        // because db.execute likely auto-commits; if your Db abstraction exposes
        // transactions, wrapping the write loop is recommended.

        if (!canOverlap) {
            for (const schedule of schedules) {
                const [conflictingReservations, conflictingEvents] = await Promise.all([
                    repo.findOverlappingReservations(reservableId, schedule.start_time, schedule.end_time),
                    repo.findOverlappingEvents(reservableId, schedule.start_time, schedule.end_time),
                ]);

                if (conflictingReservations.length > 0) {
                    throw new UnprocessableError(
                        `El espacio ya tiene reservaciones que se empalman en el horario ${schedule.start_time} – ${schedule.end_time}`
                    );
                }
                if (conflictingEvents.length > 0) {
                    throw new UnprocessableError(
                        `El espacio tiene un evento que se empalma en el horario ${schedule.start_time} – ${schedule.end_time}`
                    );
                }
            }
        }

        const reservationIds: number[] = [];
        for (const schedule of schedules) {
            const reservationId = await repo.createReservation(reservableId, schedule.start_time, schedule.end_time, canOverlap, description);
            reservationIds.push(reservationId);
            if (workGroupIds.length > 0) {
                await repo.addReservationWorkGroups(reservationId, workGroupIds);
            }
            for (const participant of participants) {
                await repo.addReservationParticipant(reservationId, participant.userId, participant.guestId, participant.ownershipPriority, participant.status);
            }
        }

        const details = await Promise.all(reservationIds.map((id) => getReservationDetail(id)));
        return details;
    };

    const updateParticipantStatus = async (participantId: number, status: ParticipantStatus, reinvite = false): Promise<ReservationParticipant> => {
        const participant = await repo.findParticipantById(participantId);
        if (!participant) throw new NotFoundError(`Participant ${participantId} no encontrado`);

        if (participant.status === "REJECTED" && status === "PENDING" && !reinvite) {
            throw new UnprocessableError("Solo se puede reenviar una invitación rechazada con reinvite=true");
        }

        const allowedTransitions: Record<string, string[]> = {
            PENDING: ["ACCEPTED", "REJECTED"],
            ACCEPTED: ["REJECTED"],
            REJECTED: ["PENDING"],
        };

        if (!allowedTransitions[participant.status].includes(status)) {
            throw new UnprocessableError(`Transición de estado inválida de ${participant.status} a ${status}`);
        }

        await repo.updateParticipantStatus(participantId, status);
        const updated = await repo.findParticipantById(participantId);
        if (!updated) throw new NotFoundError(`Participant ${participantId} no encontrado después de actualización`);

        return {
            id: updated.id,
            reservationId: updated.reservationId,
            userId: updated.userId,
            guestId: updated.guestId,
            ownershipPriority: updated.ownershipPriority,
            checkedIn: Boolean(updated.checkedIn),
            status: updated.status as ParticipantStatus,
            user: updated.userId ? {
                id: updated.userId,
                name: updated.user_name ?? "",
                email: updated.user_email ?? "",
                role: updated.user_role ?? "",
            } : null,
            guest: updated.guestId ? {
                id: updated.guestId,
                name: updated.guest_name ?? "",
                email: updated.guest_email ?? "",
            } : null,
        };
    };

    const getMyReservations = async (userId: string): Promise<UserReservationSummary> => {
        return repo.findMyReservationSummaries(userId);
    };

    const getMyFriendsReservations = async (userId: string): Promise<FriendReservationsSummary> => {
        if (!friendshipService) return [];
        const friendIds = await friendshipService.getFriendIds(userId);
        if (friendIds.length === 0) return [];
        return repo.findFriendsReservationSummaries(friendIds);
    };

    // FEATURE 4: EVENTS (Eventos)

    const getEvents = async (query: GetEventsQuery): Promise<Event[]> => {
        return repo.findEvents(query);
    };

    const getEventById = async (id: number): Promise<Event> => {
        const event = await repo.findEventById(id);
        if (!event) throw new NotFoundError(`Event ${id} no encontrado`);
        return event;
    };

    const createEvent = async (data: CreateEventBody): Promise<Event> => {
        // Validate reservable exists when provided
        if (data.reservable_id !== undefined) {
            const slot = await repo.findById(data.reservable_id);
            if (!slot) throw new NotFoundError(`Reservable ${data.reservable_id} no encontrado`);

            // Events always block the space — validate against existing reservations
            // (only those with can_overlap=0) and other events
            const [conflictingReservations, conflictingEvents] = await Promise.all([
                repo.findOverlappingReservations(data.reservable_id, data.start_time, data.end_time),
                repo.findOverlappingEvents(data.reservable_id, data.start_time, data.end_time),
            ]);

            if (conflictingReservations.length > 0) {
                throw new UnprocessableError(
                    `El espacio ya tiene reservaciones que se empalman con el evento en el horario ${data.start_time} – ${data.end_time}`
                );
            }
            if (conflictingEvents.length > 0) {
                throw new UnprocessableError(
                    `Ya existe un evento que se empalma en el horario ${data.start_time} – ${data.end_time}`
                );
            }
        }

        const id = await repo.createEvent(data);
        return (await repo.findEventById(id))!;
    };

    // METADATA ENDPOINTS (Metadata para clientes)

    const getUsers = async (): Promise<UserSummary[]> => {
        return repo.findUsers();
    };

    const getGuests = async (): Promise<GuestSummary[]> => {
        return repo.findGuests();
    };

    return {
        getAvailableSlots,
        getAllSlots,
        getSlotById,
        createSlot,
        updateSlot,
        deleteSlot,
        setBlockStatus,
        getWorkGroups,
        getUsers,
        getGuests,
        getReservationDetail,
        createReservationBatch,
        updateParticipantStatus,
        getMyReservations,
        getMyFriendsReservations,
        getEvents,
        getEventById,
        createEvent,
    };
}
