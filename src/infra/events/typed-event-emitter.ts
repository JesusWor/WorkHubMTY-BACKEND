import { EventEmitter } from "node:events";

export type EventMap = Record<string, unknown[]>;

export type EventKey<T extends EventMap> = Extract<keyof T, string>;
export type EventArgs<T extends EventMap, K extends EventKey<T>> = T[K];

export class TypedEventEmitter<T extends EventMap> extends EventEmitter {
    override emit<K extends EventKey<T>>(
        event: K,
        ...args: T[K]
    ): boolean {
        return super.emit(event, ...args);
    }

    override on<K extends EventKey<T>>(
        event: K,
        listener: (...args: T[K]) => void
    ): this {
        return super.on(event, listener as (...args: any[]) => void);
    }

    override once<K extends EventKey<T>>(
        event: K,
        listener: (...args: T[K]) => void
    ): this {
        return super.once(event, listener as (...args: any[]) => void);
    }

    override off<K extends EventKey<T>>(
        event: K,
        listener: (...args: T[K]) => void
    ): this {
        return super.off(event, listener as (...args: any[]) => void);
    }
}
