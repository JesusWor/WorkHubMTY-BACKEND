import { OfficeSlotsRepo } from './office-slots.repo.js';
import { FriendshipService } from '../friendship/friendship.service.js';
import {
    Reservable,
    Reservation,
    Participant,
    ParticipantPublic,
    ReservationWithParticipants,
    ReservationAttendanceStatus,
    ParticipantAttendanceStatus,
    CreateReservable,
    UpdateReservable,
    CreateReservationBatch,
    BlockBatch,
    ListReservationsQuery,
    ListReservationsPage,
    RESERVATION_TRANSITIONS,
    NON_CANCELABLE_STATUSES,
    PARTICIPANT_USER_TRANSITIONS,
    AvailableReservablesQuery,
    ReservationSummary,
    GetReservationsForSlotFilters,
} from './office-slots.schema.js';
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/AppError.js';
import { JwtPayload } from '../../shared/schemas/auth.schema.js';
import { Roles, SUPERVISOR_ROLES } from '../../shared/types/role.type.js';
import { Queue } from 'bullmq';
import { OfficeNoShowJobData, OfficeCheckoutJobData } from '../../infra/queue/office-queue.js';
import { OfficeEventsEmitter } from '../../infra/events/office-events.emitter.js';
import { TeamsService } from '../teams/teams.service.js';

const CHECKIN_TOLERANCE_MINUTES = 30;

// Queue helpers

function noShowJobId(reservationId: number): string {
    return `office-noshow-${reservationId}`;
}

function checkoutJobId(reservationId: number): string {
    return `office-checkout-${reservationId}`;
}

function noShowDelay(startTime: Date): number {
    const triggerAt = startTime.getTime() + CHECKIN_TOLERANCE_MINUTES * 60_000;
    return Math.max(0, triggerAt - Date.now());
}

function checkoutDelay(endTime: Date): number {
    return Math.max(0, endTime.getTime() - Date.now());
}

// State machine assertions

function assertValidReservationTransition(
    current: ReservationAttendanceStatus,
    next: ReservationAttendanceStatus,
): void {
    const allowed = RESERVATION_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
        throw new ConflictError(`Transición de reservación inválida: ${current} → ${next}`);
    }
}

function assertValidParticipantTransition(
    current: ParticipantAttendanceStatus,
    next: ParticipantAttendanceStatus,
): void {
    const allowed = PARTICIPANT_USER_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
        throw new ConflictError(`Transición de participante inválida: ${current} → ${next}`);
    }
}

const PARTICIPANT_TERMINAL_STATUSES: ParticipantAttendanceStatus[] = [
    'CHECKED_OUT',
    'NO_SHOW',
    'NOT_ACCEPTED',
    'REJECTED',
    'CANCELED',
];

// Friendship masking

function maskParticipant(p: Participant, isFriend: boolean): ParticipantPublic {
    if (isFriend) return p;
    return {
        id: p.id,
        reservations_id: p.reservations_id,
        user_id: null,
        ownership_priority: null,
        attendance_status: null,
        created_at: p.created_at,
        updated_at: p.updated_at,
    };
}

function maskParticipants(
    participants: Participant[],
    callerEId: string,
    friendSet: Set<string>,
): ParticipantPublic[] {
    return participants.map((p) => (friendSet.has(p.user_id) ? p : maskParticipant(p, false)));
}

export type OfficeSlotsServiceDeps = {
    repo: OfficeSlotsRepo;
    friendshipService: FriendshipService;
    teamsService: TeamsService;
    queue: Queue<OfficeNoShowJobData | OfficeCheckoutJobData>;
    emitter: OfficeEventsEmitter;
};

export type OfficeSlotsService = {
    // Reservables
    getAllReservables: () => Promise<Reservable[]>;
    getAvailableReservables: (query: AvailableReservablesQuery) => Promise<Reservable[]>;
    getReservableById: (id: number, detail?: boolean) => Promise<Reservable>;
    createReservable: (data: CreateReservable) => Promise<Reservable>;
    updateReservable: (id: number, data: UpdateReservable) => Promise<Reservable>;
    deleteReservable: (id: number) => Promise<void>;

    getReservationsForSlot: (
        slotId: number,
        filters: GetReservationsForSlotFilters,
        detail?: boolean,
    ) => Promise<Reservation[] | ReservationSummary[]>;

    // Blocks
    createBlockBatch: (data: BlockBatch) => Promise<ReservationWithParticipants[]>;
    cancelBlock: (id: number) => Promise<void>;

    // Reservations
    listReservations: (
        query: ListReservationsQuery,
        caller: JwtPayload,
    ) => Promise<ListReservationsPage>;
    getReservationDetail: (id: number, caller: JwtPayload) => Promise<ReservationWithParticipants>;
    getMyReservations: (caller: JwtPayload) => Promise<ReservationWithParticipants[]>;
    getUserReservations: (
        userId: string,
        caller: JwtPayload,
    ) => Promise<ReservationWithParticipants[]>;

    createReservationBatch: (
        data: CreateReservationBatch,
        caller: JwtPayload,
    ) => Promise<ReservationWithParticipants[]>;
    cancelReservation: (id: number, caller: JwtPayload) => Promise<Reservation>;
    participantCheckin: (
        reservationId: number,
        caller: JwtPayload,
    ) => Promise<{ reservation: Reservation; participant: Participant }>;
    participantCheckout: (
        reservationId: number,
        caller: JwtPayload,
    ) => Promise<{ reservation: Reservation; participant: Participant }>;

    // Admin patch directo (ADMIN / ACCESS_ATTENDANT)
    patchReservationAttendance: (
        id: number,
        next: ReservationAttendanceStatus,
        caller: JwtPayload,
    ) => Promise<Reservation>;

    patchParticipantAttendance: (
        reservationId: number,
        participantId: number,
        next: ParticipantAttendanceStatus,
        caller: JwtPayload,
    ) => Promise<Participant>;

    // User view
    getUserReservationsView: (
        targetUserId: string,
        caller: JwtPayload,
    ) => Promise<{
        user_id: string;
        reservations: ReservationWithParticipants[];
    }>;
};

export function makeOfficeSlotsService(deps: OfficeSlotsServiceDeps): OfficeSlotsService {
    const { repo, friendshipService, queue, emitter } = deps;

    async function getFriendSet(callerEId: string): Promise<Set<string>> {
        const ids = await friendshipService.getFriendIds(callerEId);
        return new Set([callerEId, ...ids]);
    }

    async function applyFriendMask(
        res: ReservationWithParticipants,
        friendSet: Set<string>,
    ): Promise<ReservationWithParticipants> {
        return {
            ...res,
            participants: maskParticipants(
                res.participants as Participant[],
                res.id.toString(),
                friendSet,
            ),
        };
    }

    // Reservables

    const getAllReservables = async (): Promise<Reservable[]> => {
        return repo.getAllReservables();
    };

    const getAvailableReservables = async (
        query: AvailableReservablesQuery,
    ): Promise<Reservable[]> => {
        return repo.getAvailableReservables(query);
    };

    const getReservableById = async (id: number, detail?: boolean): Promise<Reservable> => {
        const slot = await repo.getReservableById(id, detail);
        if (!slot) throw new NotFoundError(`El slot ${id} no existe`);
        return slot;
    };

    const createReservable = async (data: CreateReservable): Promise<Reservable> => {
        const slot = await repo.createReservable(data);
        if (!slot) throw new ConflictError('No fue posible crear el slot');
        emitter.emit('office.slot.created', slot);
        return slot;
    };

    const updateReservable = async (id: number, data: UpdateReservable): Promise<Reservable> => {
        const { blockExpiresAt, ...dbData } = data;
        const slot = await repo.updateReservable(id, dbData);
        if (!slot) throw new NotFoundError(`El slot ${id} no existe`);
        emitter.emit('office.slot.updated', slot);
        return slot;
    };

    const deleteReservable = async (id: number): Promise<void> => {
        const deleted = await repo.deleteReservable(id);
        if (!deleted) throw new NotFoundError(`El slot ${id} no existe`);
        emitter.emit('office.slot.deleted', id);
    };
    const getReservationsForSlot = async (
        slotId: number,
        filters: GetReservationsForSlotFilters,
        detail = false,
    ) => {
        if (detail) {
            return repo.getReservationDetailsBySlot(slotId, filters);
        }

        return repo.getReservationSummariesBySlot(slotId, filters);
    };

    // Reservations

    const listReservations = async (
        query: ListReservationsQuery,
        caller: JwtPayload,
    ): Promise<ListReservationsPage> => {
        const friendIds = await friendshipService.getFriendIds(caller.eId);
        return repo.listReservations(query, caller.eId, friendIds);
    };

    const getReservationDetail = async (
        id: number,
        caller: JwtPayload,
    ): Promise<ReservationWithParticipants> => {
        const res = await repo.getReservationWithParticipants(id);
        if (!res) throw new NotFoundError(`La reservación ${id} no existe`);

        const friendSet = await getFriendSet(caller.eId);
        return {
            ...res,
            participants: maskParticipants(
                res.participants as Participant[],
                caller.eId,
                friendSet,
            ),
        };
    };

    const getMyReservations = async (
        caller: JwtPayload,
    ): Promise<ReservationWithParticipants[]> => {
        return repo.getReservationsByUser(caller.eId);
    };

    const getUserReservations = async (
        userId: string,
        caller: JwtPayload,
    ): Promise<ReservationWithParticipants[]> => {
        const reservations = await repo.getReservationsByUser(userId);
        const friendSet = await getFriendSet(caller.eId);
        return Promise.all(reservations.map((r) => applyFriendMask(r, friendSet)));
    };

    const createReservationBatch = async (
        data: CreateReservationBatch,
        caller: JwtPayload,
    ): Promise<ReservationWithParticipants[]> => {
        const slot = await repo.getReservableById(data.reservable_id);
        if (!slot) throw new NotFoundError(`El slot ${data.reservable_id} no existe`);
        const teamMemberIds = (
            await Promise.all(data.teamIds.map((id) => deps.teamsService.getTeamMembers(id)))
        ).flat().map(member => member.eId);

        const combined = new Set([...data.participants, ...teamMemberIds]);
        const uniqueMembers = Array.from(combined);

        const created = await repo.createReservationBatch(
            caller.eId,
            data.reservable_id,
            data.category,
            data.description,
            data.timestamps,
            uniqueMembers,
        );

        if (!created.length) throw new ConflictError('No fue posible crear ninguna reservación');

        for (const res of created) {
            try {
                await queue.add(
                    'no-show',
                    { reservationId: res.id },
                    { delay: noShowDelay(res.start_time), jobId: noShowJobId(res.id) },
                );
                await queue.add(
                    'auto-checkout',
                    { reservationId: res.id },
                    { delay: checkoutDelay(res.end_time), jobId: checkoutJobId(res.id) },
                );
            } catch (err) {
                console.error(
                    `[office-queue] Error encolando jobs para reservación ${res.id}:`,
                    (err as Error).message,
                );
            }

            emitter.emit('office.reservation.created', {
                reservation: res,
                participants: res.participants as Participant[],
                reservable: slot,
            });
        }

        return created;
    };

    const cancelReservation = async (id: number, caller: JwtPayload): Promise<Reservation> => {
        const isAdmin = caller.role === Roles.ADMIN;
        const isSupervisor = (SUPERVISOR_ROLES as readonly string[]).includes(caller.role);
        const res = await repo.getReservationWithParticipants(id);
        if (!res) throw new NotFoundError(`La reservación ${id} no existe`);

        // Los bloqueos pueden ser cancelados por cualquier supervisor
        if ((res.category as string) === 'BLOCKED') {
            if (!isSupervisor)
                throw new ForbiddenError('Solo un supervisor puede cancelar un bloqueo');
        } else if (!isAdmin) {
            // El "owner activo" es el participante con menor ownership_priority
            const activeOwner = (res.participants as Participant[])
                .filter((p) => !PARTICIPANT_TERMINAL_STATUSES.includes(p.attendance_status))
                .sort((a, b) => a.ownership_priority - b.ownership_priority)[0];

            if (!activeOwner || activeOwner.user_id !== caller.eId) {
                throw new ForbiddenError('Solo el dueño activo de la reservación puede cancelarla');
            }
        }

        if (res.attendance_status === 'CANCELED') {
            throw new ConflictError('La reservación ya está cancelada');
        }

        if (NON_CANCELABLE_STATUSES.includes(res.attendance_status)) {
            throw new ConflictError(
                `No se puede cancelar una reservación con estado '${res.attendance_status}'`,
            );
        }

        const updated = await repo.cancelReservation(id);
        if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);

        await queue.remove(noShowJobId(id)).catch(() => {});
        await queue.remove(checkoutJobId(id)).catch(() => {});

        emitter.emit('office.reservation.canceled', {
            reservation: updated,
            participants: res.participants as Participant[],
            reservable: res.reservable,
        });

        return updated;
    };

    const participantCheckin = async (
        reservationId: number,
        caller: JwtPayload,
    ): Promise<{ reservation: Reservation; participant: Participant }> => {
        const res = await repo.getReservationById(reservationId);
        if (!res) throw new NotFoundError(`La reservación ${reservationId} no existe`);

        if (res.attendance_status === 'CANCELED') {
            throw new ConflictError('La reservación está cancelada');
        }
        if (res.attendance_status === 'CHECKED_OUT' || res.attendance_status === 'NO_SHOW') {
            throw new ConflictError('La reservación ya finalizó');
        }

        const participant = await repo.getParticipantByReservationAndUser(
            reservationId,
            caller.eId,
        );
        if (!participant) {
            throw new NotFoundError('No eres participante de esta reservación');
        }

        assertValidParticipantTransition(participant.attendance_status, 'CHECKED_IN');

        const updatedParticipant = await repo.updateParticipantAttendance(
            participant.id,
            'CHECKED_IN',
        );
        if (!updatedParticipant)
            throw new ConflictError('No fue posible actualizar el participante');

        let updatedReservation = res;
        if (res.attendance_status === 'NOT_ARRIVED') {
            const updated = await repo.updateReservationAttendance(reservationId, 'CHECKED_IN');
            if (updated) {
                updatedReservation = updated;
                await queue.remove(noShowJobId(reservationId)).catch(() => {});
            }
        }

        const allParticipants = await repo.getParticipantsByReservation(reservationId);
        const slot = (await repo.getReservableById(res.reservable_id))!;

        emitter.emit('office.reservation.checkedin', {
            reservation: updatedReservation,
            participants: allParticipants,
            reservable: slot,
        });

        return { reservation: updatedReservation, participant: updatedParticipant };
    };

    const participantCheckout = async (
        reservationId: number,
        caller: JwtPayload,
    ): Promise<{ reservation: Reservation; participant: Participant }> => {
        const res = await repo.getReservationById(reservationId);
        if (!res) throw new NotFoundError(`La reservación ${reservationId} no existe`);

        const participant = await repo.getParticipantByReservationAndUser(
            reservationId,
            caller.eId,
        );
        if (!participant) {
            throw new NotFoundError('No eres participante de esta reservación');
        }

        assertValidParticipantTransition(participant.attendance_status, 'CHECKED_OUT');

        const updatedParticipant = await repo.updateParticipantAttendance(
            participant.id,
            'CHECKED_OUT',
        );
        if (!updatedParticipant)
            throw new ConflictError('No fue posible actualizar el participante');

        return { reservation: res, participant: updatedParticipant };
    };

    //  Admin patch directo
    const patchReservationAttendance = async (
        id: number,
        next: ReservationAttendanceStatus,
        caller: JwtPayload,
    ): Promise<Reservation> => {
        const isAdminOrAttendant =
            caller.role === Roles.ADMIN || caller.role === Roles.ACCESS_ATTENDANT;

        const res = isAdminOrAttendant ? await repo.getReservationById(id) : null;

        if (!res) {
            if (!isAdminOrAttendant)
                throw new ForbiddenError('No tienes permiso para esta operación');
            throw new NotFoundError(`La reservación ${id} no existe`);
        }

        assertValidReservationTransition(res.attendance_status, next);

        const updated = await repo.updateReservationAttendance(id, next);
        if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);

        if (next === 'CHECKED_IN') {
            await queue.remove(noShowJobId(id)).catch(() => {});
        }
        if (next === 'CHECKED_OUT' || next === 'NO_SHOW') {
            await queue.remove(noShowJobId(id)).catch(() => {});
            await queue.remove(checkoutJobId(id)).catch(() => {});
        }

        const allParticipants = await repo.getParticipantsByReservation(id);
        const slot = (await repo.getReservableById(res.reservable_id))!;

        emitter.emit('office.reservation.attendance_updated', {
            reservation: updated,
            participants: allParticipants,
            reservable: slot,
        });

        return updated;
    };

    const patchParticipantAttendance = async (
        reservationId: number,
        participantId: number,
        next: ParticipantAttendanceStatus,
        caller: JwtPayload,
    ): Promise<Participant> => {
        const res = await repo.getReservationById(reservationId);
        if (!res) throw new NotFoundError(`La reservación ${reservationId} no existe`);

        if (res.attendance_status === 'CANCELED') {
            throw new ConflictError('La reservación está cancelada');
        }

        const participant = await repo.getParticipantById(participantId);
        if (!participant || participant.reservations_id !== reservationId) {
            throw new NotFoundError('Participante no encontrado en esta reservación');
        }

        // Solo el participante o admin puede cambiar su estado
        const isAdmin = caller.role === Roles.ADMIN;
        if (!isAdmin && participant.user_id !== caller.eId) {
            throw new ForbiddenError('Solo puedes modificar tu propio estado de participación');
        }

        assertValidParticipantTransition(participant.attendance_status, next);

        const updated = await repo.updateParticipantAttendance(participantId, next);
        if (!updated) throw new NotFoundError('No fue posible actualizar el participante');

        const allParticipants = await repo.getParticipantsByReservation(reservationId);
        const slot = (await repo.getReservableById(res.reservable_id))!;

        emitter.emit('office.participant.updated', {
            reservation: res,
            participants: allParticipants,
            reservable: slot,
        });

        return updated;
    };

    // Vista por usuario

    const getUserReservationsView = async (
        targetUserId: string,
        caller: JwtPayload,
    ): Promise<{ user_id: string; reservations: ReservationWithParticipants[] }> => {
        const reservations = await repo.getReservationsByUser(targetUserId);
        const friendSet = await getFriendSet(caller.eId);

        const masked = await Promise.all(reservations.map((r) => applyFriendMask(r, friendSet)));

        return { user_id: targetUserId, reservations: masked };
    };

    // Block

    const createBlockBatch = async (data: BlockBatch): Promise<ReservationWithParticipants[]> => {
        const slot = await repo.getReservableById(data.reservable_id);
        if (!slot) throw new NotFoundError(`El slot ${data.reservable_id} no existe`);

        const created = await repo.createReservationBatch(
            'system',
            data.reservable_id,
            'BLOCKED',
            data.description,
            data.timestamps,
            [],
        );

        if (!created.length)
            throw new ConflictError(
                'No fue posible crear ningún bloqueo (todos los timestamps empalman con reservas existentes)',
            );

        return created;
    };

    const cancelBlock = async (id: number): Promise<void> => {
        const res = await repo.getReservationWithParticipants(id);
        if (!res) throw new NotFoundError(`El bloqueo ${id} no existe`);
        if ((res.category as string) !== 'BLOCKED')
            throw new BadRequestError(`La reservación ${id} no es un bloqueo`);
        if (res.attendance_status === 'CANCELED')
            throw new ConflictError('El bloqueo ya está cancelado');

        const updated = await repo.cancelReservation(id);
        if (!updated) throw new NotFoundError(`El bloqueo ${id} no existe`);

        emitter.emit('office.reservation.canceled', {
            reservation: updated,
            participants: res.participants as Participant[],
            reservable: res.reservable,
        });
    };

    return {
        getAllReservables,
        getAvailableReservables,
        getReservableById,
        createReservable,
        updateReservable,
        deleteReservable,

        getReservationsForSlot,

        createBlockBatch,
        cancelBlock,

        listReservations,
        getReservationDetail,
        getMyReservations,
        getUserReservations,

        createReservationBatch,
        cancelReservation,

        participantCheckin,
        participantCheckout,

        patchReservationAttendance,
        patchParticipantAttendance,

        getUserReservationsView,
    };
}
