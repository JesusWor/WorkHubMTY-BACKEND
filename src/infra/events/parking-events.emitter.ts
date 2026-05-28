import { EventEmitter } from "node:events";
import { ParkingReservation, ParkingLot } from "../../modules/parking-slots/parking-slots.schema.js";

// ─── Event map ────────────────────────────────────────────────────────────────

export type ParkingEventMap = {
    "reservation.created": [reservation: ParkingReservation];
    "reservation.canceled": [reservation: ParkingReservation];
    "reservation.attendance_updated": [reservation: ParkingReservation];
    "reservation.no_show": [reservation: ParkingReservation];
    "lot.created": [lot: ParkingLot];
    "lot.updated": [lot: ParkingLot];
    "lot.deleted": [lotId: number];
};

export type ParkingEventName = keyof ParkingEventMap;

// ─── Typed wrapper ────────────────────────────────────────────────────────────

class ParkingEventsEmitter extends EventEmitter {
    emit<K extends ParkingEventName>(event: K, ...args: ParkingEventMap[K]): boolean {
        return super.emit(event, ...args);
    }

    on<K extends ParkingEventName>(event: K, listener: (...args: ParkingEventMap[K]) => void): this {
        return super.on(event, listener as (...args: any[]) => void);
    }

    once<K extends ParkingEventName>(event: K, listener: (...args: ParkingEventMap[K]) => void): this {
        return super.once(event, listener as (...args: any[]) => void);
    }

    off<K extends ParkingEventName>(event: K, listener: (...args: ParkingEventMap[K]) => void): this {
        return super.off(event, listener as (...args: any[]) => void);
    }
}

// Singleton — toda la app comparte una instancia
export const parkingEvents = new ParkingEventsEmitter();

// Tipo exportado para DI en el service
export type { ParkingEventsEmitter };
