import { ParkingSlotsRepo } from "./parking-slots.repo";
import { ParkingReservation, ParkingReservationCount } from "./parking-slots.schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors/AppError";
import { JwtPayload } from "../../shared/schemas/auth.schema";
import { Roles } from "../../middleware";

export type ParkingSlotsService = {
    getAll: () => Promise<ParkingReservation[]>;
    getAvailabilityBetween: (startTime: string, endTime: string) => Promise<ParkingReservationCount[]>;
    autoReserveBetween: (userId: string, startTime: string, endTime: string) => Promise<ParkingReservation | null>;
    reassignParkingReservation: (id: number, newParkingLotId: number) => Promise<ParkingReservation | null>;

    remove: (id: number, user: JwtPayload) => Promise<boolean>;
};

export function makeParkingSlotsService(repo: ParkingSlotsRepo): ParkingSlotsService {

    const getAll = async (): Promise<ParkingReservation[]> => {
        return repo.getAll();
    };

    const getAvailabilityBetween = async (
        startTime: string,
        endTime: string
    ): Promise<ParkingReservationCount[]> => {
        if (endTime <= startTime) {
            throw new BadRequestError("end_time debe ser posterior a start_time");
        }
        return repo.getAvailabilityBetween(startTime, endTime);
    };

    const autoReserveBetween = async (
        userId: string,
        startTime: string,
        endTime: string
    ): Promise<ParkingReservation | null> => {
        if (endTime <= startTime) {
            throw new BadRequestError("end_time debe ser posterior a start_time");
        }

        // Check if user already has a reservation in this time range
        const alreadyReserved = await repo.hasActiveReservation(userId, startTime, endTime);
        if (alreadyReserved) {
            throw new ConflictError("Ya tienes una reservación de estacionamiento en ese horario");
        }

        // Find available parking lot (capacity > reservedCount)
        const availability = await repo.getAvailabilityBetween(startTime, endTime);
        const available = availability.find(lot => lot.reservedCount < lot.capacity);

        if (!available) {
            throw new ConflictError("No hay lugares de estacionamiento disponibles para ese horario");
        }

        const reservation = await repo.reserveBetween(available.id, userId, startTime, endTime);
        if (!reservation) {
            throw new ConflictError("No fue posible crear la reservación, intenta de nuevo");
        }

        return reservation;
    };

    const reassignParkingReservation = async (
        id: number,
        newParkingLotId: number
    ): Promise<ParkingReservation | null> => {
        const existing = await repo.getById(id);
        if (!existing) {
            throw new NotFoundError(`La reservación con id ${id} no existe`);
        }

        // Verify target parking lot has availability for the same time window.
        // Pass excludeReservationId so the current reservation is not counted
        // against the target lot (relevant if reassigning to a nearly-full lot).
        const availability = await repo.getAvailabilityBetween(
            existing.start_time,
            existing.end_time,
            id
        );

        const targetLot = availability.find(lot => lot.id === newParkingLotId);
        if (!targetLot) {
            throw new NotFoundError(`El cajón de estacionamiento ${newParkingLotId} no existe`);
        }

        // When reassigning, the current reservation frees a spot in the original lot
        // so we check capacity strictly (reservedCount < capacity allows same count for target)
        if (targetLot.reservedCount >= targetLot.capacity) {
            throw new ConflictError(`El cajón ${newParkingLotId} no tiene capacidad disponible en ese horario`);
        }

        const updated = await repo.reassignParkingReservation(id, newParkingLotId);
        if (!updated) {
            throw new NotFoundError(`La reservación con id ${id} no existe`);
        }

        return updated;
    };

    const remove = async (id: number, user: JwtPayload): Promise<boolean> => {
        const isAdmin = user.role === Roles.ADMIN;

        let reservation;
        if (isAdmin) {
            reservation = await repo.getById(id);
        } else {
            reservation = await repo.getByIdAndUser(id, user.eId);
        }

        if (!reservation) {
            throw new NotFoundError(`La reservación con id ${id} no existe o no te pertenece`);
        }

        return repo.remove(id);
    };

    return {
        getAll,
        getAvailabilityBetween,
        autoReserveBetween,
        reassignParkingReservation,
        remove,
    };
}