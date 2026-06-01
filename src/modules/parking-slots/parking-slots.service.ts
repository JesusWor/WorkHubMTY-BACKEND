import { ParkingSlotsRepo } from "./parking-slots.repo.js";
import { FriendshipService } from "../friendship/friendship.service.js";
import {
    ParkingReservation,
    ParkingLot,
    AttendanceStatus,
    ListReservationsQuery,
    ListReservationsPage,
    ReservationBucketsQuery,
    ReservationBucket,
    ReservationDetailResponse,
    CreateParkingLot,
    UpdateParkingLot,
    ReservationBucketsResponse,
} from "./parking-slots.schema.js";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../../shared/errors/AppError.js";
import { JwtPayload } from "../../shared/schemas/auth.schema.js";
import { Roles } from "../../middleware/index.js";
import { Queue } from "bullmq";
import { NoShowJobData, CheckoutJobData } from "../../infra/queue/parking-queue.js";
import { ParkingEventsEmitter } from "../../infra/events/parking-events.emitter.js";

const CHECKIN_TOLERANCE_MINUTES = 30;

const ATTENDANCE_TRANSITIONS: Record<AttendanceStatus, AttendanceStatus[]> = {
    NOT_ARRIVED: ["CHECKED_IN", "NO_SHOW"],
    CHECKED_IN: ["CHECKED_OUT"],
    CHECKED_OUT: [],
    NO_SHOW: [],
    CANCELED: [],
};

const NON_CANCELABLE_STATUSES: AttendanceStatus[] = ["CHECKED_IN", "CHECKED_OUT", "NO_SHOW"];

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
            attendance_status: reservation.attendance_status,
            lifecycle_status: reservation.lifecycle_status,
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
    return `noshow-${reservationId}`;
}

function checkoutJobId(reservationId: number): string {
    return `checkout-${reservationId}`;
}

function noShowDelay(startTime: Date): number {
    const triggerAt = startTime.getTime() + CHECKIN_TOLERANCE_MINUTES * 60_000;
    return Math.max(0, triggerAt - Date.now());
}

function checkoutDelay(endTime: Date): number {
    return Math.max(0, endTime.getTime() - Date.now());
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParkingSlotsServiceDeps = {
    repo: ParkingSlotsRepo;
    friendshipService: FriendshipService;
    queue: Queue<NoShowJobData | CheckoutJobData>;
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
    listReservations: (query: ListReservationsQuery) => Promise<ListReservationsPage>;
    getUserReservations: (userId: string) => Promise<ReservationDetailResponse[]>;
    getReservationDetail: (id: number, requesterId?: string) => Promise<ReservationDetailResponse>;
    getBuckets: (query: ReservationBucketsQuery) => Promise<ReservationBucketsResponse>;

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

    function assertValidReservationsLimit(limit: number): void {
        if (limit < 1 || limit > 100) {
            throw new BadRequestError("limit debe estar entre 1 y 100");
        }
    }

    const listReservations = async (
        query: ListReservationsQuery
    ): Promise<ListReservationsPage> => {
        if (query.limit !== undefined) {
            assertValidReservationsLimit(query.limit);
        }
        return repo.listReservations(query);
    };

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
    ): Promise<ReservationBucketsResponse> => {
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
        const capacity = await repo.getAllLots().then((lots) => lots.reduce((sum, lot) => sum + lot.capacity, 0));

        return { capacity, buckets };
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

        try {
            await queue.add(
                "no-show",
                { reservationId: reservation.id },
                {
                    delay: noShowDelay(reservation.start_time),
                    jobId: noShowJobId(reservation.id),
                }
            );
            console.log(`[queue] no-show encolado para reservación ${reservation.id}`);
        } catch (err) {
            console.error("[queue] Error al encolar no-show:", (err as Error).message);
        }

        try {
            await queue.add(
                "auto-checkout",
                { reservationId: reservation.id },
                {
                    delay: checkoutDelay(reservation.end_time),
                    jobId: checkoutJobId(reservation.id),
                }
            );
            console.log(`[queue] auto-checkout encolado para reservación ${reservation.id}`);
        } catch (err) {
            console.error("[queue] Error al encolar auto-checkout:", (err as Error).message);
        }

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

        if (reservation.attendance_status === "CANCELED") {
            throw new ConflictError(
                "No se puede modificar la asistencia de una reservación cancelada"
            );
        }

        assertValidAttendanceTransition(reservation.attendance_status, next);

        const updated = await repo.updateAttendanceStatus(id, next);
        if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);

        if (next === "CHECKED_IN") {
            await queue.remove(noShowJobId(id));
        }

        if (next === "CHECKED_OUT" || next === "NO_SHOW") {
            await queue.remove(noShowJobId(id));
            await queue.remove(checkoutJobId(id));
        }

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

        if (reservation.attendance_status === "CANCELED") {
            throw new ConflictError("La reservación ya está cancelada");
        }

        if (NON_CANCELABLE_STATUSES.includes(reservation.attendance_status)) {
            throw new ConflictError(
                `No se puede cancelar una reservación con estado '${reservation.attendance_status}'. ` +
                `La reservación ya fue consumida operativamente.`
            );
        }

        const updated = await repo.cancelReservation(id);
        if (!updated) throw new NotFoundError(`La reservación ${id} no existe`);

        await queue.remove(noShowJobId(id));
        await queue.remove(checkoutJobId(id));

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
