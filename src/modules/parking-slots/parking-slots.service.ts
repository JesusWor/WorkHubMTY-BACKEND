import { ParkingSlotsRepo } from "./parking-slots.repo.js";
import { FriendshipService } from "../friendship/friendship.service.js";
import {
    ParkingReservation,
    ParkingLot,
    AttendanceStatus,
    ListReservationsQuery,
    ReservationBucketsQuery,
    ReservationBucket,
    ReservationDetailResponse,
    CreateParkingLot,
    UpdateParkingLot,
} from "./parking-slots.schema.js";
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../../shared/errors/AppError.js";
import { JwtPayload } from "../../shared/schemas/auth.schema.js";
import { Roles } from "../../middleware/index.js";
import { Queue } from "bullmq";
import { NoShowJobData } from "../../infra/queue/parking-queue.js";
import { ParkingEventsEmitter } from "../../infra/events/parking-events.emitter.js";

const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 horas
const CHECKIN_TOLERANCE_MINUTES = 30;
const ATTENDANCE_TRANSITIONS: Record<AttendanceStatus, AttendanceStatus[]> = {
    NOT_ARRIVED: ["CHECKED_IN", "NO_SHOW"],
    CHECKED_IN: ["CHECKED_OUT"],
    CHECKED_OUT: [],
    NO_SHOW: [],
};

/**
 * No se puede cancelar una reserva en estos estados (evita corrupción histórica).
 */
const POST_OPERATIVE_STATUSES: AttendanceStatus[] = ["CHECKED_IN", "CHECKED_OUT"];

function assertValidAttendanceTransition(
    current: AttendanceStatus,
    next: AttendanceStatus
): void {
    const allowed = ATTENDANCE_TRANSITIONS[current];
    if (!allowed.includes(next)) {
        throw new ConflictError(
            `Transición de attendance inválida: ${current} → ${next}`
        );
    }
}

async function computeProjection(
    repo: ParkingSlotsRepo,
    reservation: ParkingReservation,
    lots: ParkingLot[]
): Promise<ReservationDetailResponse["projection"]> {
    const overlaps = await repo.getOverlaps(
        reservation.id,
        reservation.start_time,
        reservation.end_time
    );

    // Lista FIFO: overlaps + reserva propia, ordenados por created_at ASC
    const allInFifo = [
        ...overlaps,
        {
            id: reservation.id,
            user_id: reservation.user_id,
            created_at: reservation.created_at,
            allocation_state: reservation.allocation_state,
            lifecycle_status: reservation.lifecycle_status,
            attendance_status: reservation.attendance_status,
        },
    ].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const fifoPosition = allInFifo.findIndex((r) => r.id === reservation.id);

    // Mapear posición FIFO contra lots (priority ASC, id ASC como tiebreaker)
    const sortedLots = [...lots].sort((a, b) => a.priority - b.priority || a.id - b.id);

    let cursor = 0;
    let assignedLot: ParkingLot | null = null;
    let slotIndex: number | null = null;

    for (const lot of sortedLots) {
        if (fifoPosition < cursor + lot.capacity) {
            assignedLot = lot;
            slotIndex = fifoPosition - cursor; // 0-based dentro del lot
            break;
        }
        cursor += lot.capacity;
    }

    return {
        parking_lot: assignedLot,
        slot_index: slotIndex,
        fifo_position: fifoPosition,
    };
}

// ─── Helpers de queue ─────────────────────────────────────────────────────────

function noShowJobId(reservationId: number): string {
    return `no-show:${reservationId}`;
}

function noShowDelay(startTime: Date): number {
    const triggerAt = startTime.getTime() + CHECKIN_TOLERANCE_MINUTES * 60_000;
    return Math.max(0, triggerAt - Date.now());
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParkingSlotsServiceDeps = {
    repo: ParkingSlotsRepo;
    friendshipService: FriendshipService;
    queue: Queue<NoShowJobData>;
    emitter: ParkingEventsEmitter;
};

export type ParkingSlotsService = {
    // Parking Lots
    getAllLots: () => Promise<ParkingLot[]>;
    getLotById: (id: number) => Promise<ParkingLot>;
    createLot: (data: CreateParkingLot) => Promise<ParkingLot>;
    updateLot: (id: number, data: UpdateParkingLot) => Promise<ParkingLot>;
    deleteLot: (id: number) => Promise<void>;

    // Reservations
    listReservations: (query: ListReservationsQuery) => Promise<ParkingReservation[]>;
    getUserReservations: (userId: string) => Promise<ReservationDetailResponse[]>;
    getReservationDetail: (id: number, requesterId?: string) => Promise<ReservationDetailResponse>;
    getBuckets: (query: ReservationBucketsQuery) => Promise<ReservationBucket[]>;

    createReservation: (
        requestingUser: JwtPayload,
        data: { user_id?: string; start_time: Date; end_time: Date }
    ) => Promise<ParkingReservation>;

    patchAttendance: (
        id: number,
        next: AttendanceStatus,
        requestingUser: JwtPayload
    ) => Promise<ParkingReservation>;

    cancelReservation: (id: number, requestingUser: JwtPayload) => Promise<ParkingReservation>;

    // Cron (mantenido por compatibilidad / uso admin)
    runNoShowSweep: () => Promise<number>;
};

export function makeParkingSlotsService({ repo, friendshipService, queue, emitter }: ParkingSlotsServiceDeps): ParkingSlotsService {

    // ── Parking Lots ──────────────────────────────────────────────────────────

    const getAllLots = async (): Promise<ParkingLot[]> => repo.getAllLots();

    const getLotById = async (id: number): Promise<ParkingLot> => {
        const lot = await repo.getLotById(id);
        if (!lot) throw new NotFoundError(`El cajón ${id} no existe`);
        return lot;
    };

    const createLot = async (data: CreateParkingLot): Promise<ParkingLot> => {
        const lot = await repo.createLot(data.name, data.capacity, data.priority);
        if (!lot) throw new ConflictError("No fue posible crear el cajón");
        emitter.emit("lot.created", lot);
        return lot;
    };

    const updateLot = async (id: number, data: UpdateParkingLot): Promise<ParkingLot> => {
        const lot = await repo.updateLot(id, data);
        if (!lot) throw new NotFoundError(`El cajón ${id} no existe`);
        emitter.emit("lot.updated", lot);
        return lot;
    };

    const deleteLot = async (id: number): Promise<void> => {
        const deleted = await repo.deleteLot(id);
        if (!deleted) throw new NotFoundError(`El cajón ${id} no existe`);
        emitter.emit("lot.deleted", id);
    };

    // ── Reservations ──────────────────────────────────────────────────────────

    const listReservations = async (
        query: ListReservationsQuery
    ): Promise<ParkingReservation[]> => repo.listReservations(query);

    const getUserReservations = async (userId: string): Promise<ReservationDetailResponse[]> => {
        const reservations = await repo.getReservationsByUser(userId);
        return Promise.all(
            reservations.map((r) => getReservationDetail(r.id, userId))
        );
    };

    const getReservationDetail = async (id: number, requesterId?: string): Promise<ReservationDetailResponse> => {
        const reservation = await repo.getReservationById(id);
        if (!reservation) throw new NotFoundError(`La reservación ${id} no existe`);

        if (requesterId && !(await friendshipService.areFriends(reservation.user_id, requesterId))) {
            throw new ForbiddenError("No tienes permiso para acceder a esta reservación");
        }

        const lots = await repo.getAllLots();
        const projection = await computeProjection(repo, reservation, lots);

        return { reservation, projection };
    };

    const getBuckets = async (
        query: ReservationBucketsQuery
    ): Promise<ReservationBucket[]> => {
        const stepMs = Number(query.step_minutes) * 60 * 1000;
        const buckets: ReservationBucket[] = [];

        let cursor = new Date(query.start_time);
        const end = new Date(query.end_time);

        while (cursor < end) {
            const bucketEnd = new Date(Math.min(cursor.getTime() + stepMs, end.getTime()));
            const count = await repo.getReservationCountInWindow(cursor, bucketEnd);
            buckets.push({ timestamp: new Date(cursor), reservation_count: count });
            cursor = bucketEnd;
        }

        return buckets;
    };

    const createReservation = async (
        requestingUser: JwtPayload,
        data: { user_id?: string; start_time: Date; end_time: Date }
    ): Promise<ParkingReservation> => {
        const isAdmin = requestingUser.role === Roles.ADMIN;
        let effectiveUserId = requestingUser.eId;

        if (data.user_id) {
            if (!isAdmin) {
                throw new ForbiddenError(
                    "Solo un admin puede crear reservaciones a nombre de otro usuario"
                );
            }
            effectiveUserId = data.user_id;
        }

        const alreadyReserved = await repo.hasActiveReservation(
            effectiveUserId,
            data.start_time,
            data.end_time
        );
        if (alreadyReserved) {
            throw new ConflictError(
                "Ya existe una reservación activa en ese horario para este usuario"
            );
        }

        const reservation = await repo.createReservation(
            effectiveUserId,
            data.start_time,
            data.end_time
        );
        if (!reservation) throw new ConflictError("No fue posible crear la reservación");

        // Encolar el delayed job de no-show
        await queue.add(
            "no-show",
            { reservationId: reservation.id },
            {
                delay: noShowDelay(reservation.start_time),
                jobId: noShowJobId(reservation.id),
            }
        );

        emitter.emit("reservation.created", reservation);
        return reservation;
    };

    const patchAttendance = async (
        id: number,
        next: AttendanceStatus,
        requestingUser: JwtPayload
    ): Promise<ParkingReservation> => {
        const isAdmin = requestingUser.role === Roles.ADMIN;

        const reservation = isAdmin
            ? await repo.getReservationById(id)
            : await repo.getReservationByIdAndUser(id, requestingUser.eId);

        if (!reservation) {
            throw new NotFoundError(`La reservación ${id} no existe o no te pertenece`);
        }

        if (reservation.lifecycle_status === "CANCELED") {
            throw new ConflictError(
                "No se puede modificar la asistencia de una reservación cancelada"
            );
        }

        assertValidAttendanceTransition(reservation.attendance_status, next);

        // CHECKED_IN siempre congela: el usuario ya ocupó el slot físicamente.
        // También cancela el job de no-show porque ya no aplica.
        if (next === "CHECKED_IN") {
            const updated = await repo.updateAttendanceStatus(id, next, true /* freeze */);
            if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);
            await queue.remove(noShowJobId(id));
            emitter.emit("reservation.attendance_updated", updated);
            return updated;
        }

        // NO_SHOW manual: congela si estamos dentro del gracePeriod
        if (next === "NO_SHOW") {
            const now = Date.now();
            const startMs = new Date(reservation.start_time).getTime();
            const withinGrace = now >= startMs - GRACE_PERIOD_MS;
            const updated = await repo.updateAttendanceStatus(id, next, withinGrace);
            if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);
            // El job ya no debe ejecutarse si el no-show fue manual
            await queue.remove(noShowJobId(id));
            emitter.emit("reservation.attendance_updated", updated);
            return updated;
        }

        // CHECKED_OUT: no cambia allocation_state (ya estaba FROZEN por CHECKED_IN)
        const updated = await repo.updateAttendanceStatus(id, next, false);
        if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);
        emitter.emit("reservation.attendance_updated", updated);
        return updated;
    };

    const cancelReservation = async (
        id: number,
        requestingUser: JwtPayload
    ): Promise<ParkingReservation> => {
        const isAdmin = requestingUser.role === Roles.ADMIN;

        const reservation = isAdmin
            ? await repo.getReservationById(id)
            : await repo.getReservationByIdAndUser(id, requestingUser.eId);

        if (!reservation) {
            throw new NotFoundError(`La reservación ${id} no existe o no te pertenece`);
        }

        if (reservation.lifecycle_status === "CANCELED") {
            throw new ConflictError("La reservación ya está cancelada");
        }

        // Bloquear cancelaciones post-operativas
        if (POST_OPERATIVE_STATUSES.includes(reservation.attendance_status)) {
            throw new ConflictError(
                `No se puede cancelar una reservación con estado de asistencia '${reservation.attendance_status}'. ` +
                `La reservación ya fue consumida operativamente.`
            );
        }

        const now = Date.now();
        const startMs = new Date(reservation.start_time).getTime();
        const withinGrace = now >= startMs - GRACE_PERIOD_MS;

        const updated = await repo.cancelReservation(id, withinGrace);
        if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);

        // Cancelar el job pendiente de no-show
        await queue.remove(noShowJobId(id));

        emitter.emit("reservation.canceled", updated);
        return updated;
    };

    const runNoShowSweep = async (): Promise<number> => {
        return repo.markNoShowExpired(CHECKIN_TOLERANCE_MINUTES);
    };

    return {
        getAllLots,
        getLotById,
        createLot,
        updateLot,
        deleteLot,

        listReservations,
        getUserReservations,
        getReservationDetail,
        getBuckets,

        createReservation,
        patchAttendance,
        cancelReservation,

        runNoShowSweep,
    };
}
