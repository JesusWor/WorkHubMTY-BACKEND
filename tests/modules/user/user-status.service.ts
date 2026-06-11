import { redis } from "../../infra/redis/redis.js";

const IDLE_WINDOW = 2 * 60 * 1000; // 2 minutes in ms
const STATUS_TTL = 60 * 60; // 1 hour in seconds (cleanup if server crashes)

export type UserStatus = "online" | "idle" | "offline";

type StatusEntry = {
    status: UserStatus;
    connectionCount: number;
};

const redisKey = (eId: string) => `user:status:${eId}`;

const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function getEntry(eId: string): Promise<StatusEntry> {
    const raw = await redis.get(redisKey(eId));
    if (!raw) return { status: "offline", connectionCount: 0 };
    return JSON.parse(raw) as StatusEntry;
}

async function setEntry(eId: string, entry: StatusEntry): Promise<void> {
    await redis.set(redisKey(eId), JSON.stringify(entry), { EX: STATUS_TTL });
}

function clearIdleTimer(eId: string): void {
    const timer = idleTimers.get(eId);
    if (timer) {
        clearTimeout(timer);
        idleTimers.delete(eId);
    }
}

function startIdleTimer(eId: string): void {
    clearIdleTimer(eId);
    const timer = setTimeout(async () => {
        const entry = await getEntry(eId);
        if (entry.connectionCount > 0) {
            await setEntry(eId, { ...entry, status: "idle" });
        }
        idleTimers.delete(eId);
    }, IDLE_WINDOW);
    idleTimers.set(eId, timer);
}

export type UserStatusService = {
    onConnect: (eId: string) => Promise<void>;
    onDisconnect: (eId: string) => Promise<void>;
    onPing: (eId: string) => Promise<void>;
    getStatus: (eId: string) => Promise<UserStatus>;
    getStatuses: (eIds: string[]) => Promise<Map<string, UserStatus>>;
};

export function makeUserStatusService(): UserStatusService {

    const onConnect = async (eId: string): Promise<void> => {
        const entry = await getEntry(eId);
        const updated: StatusEntry = {
            status: "online",
            connectionCount: entry.connectionCount + 1,
        };
        await setEntry(eId, updated);
        startIdleTimer(eId);
    };

    const onDisconnect = async (eId: string): Promise<void> => {
        const entry = await getEntry(eId);
        const newCount = Math.max(0, entry.connectionCount - 1);

        if (newCount === 0) {
            clearIdleTimer(eId);
            await setEntry(eId, { status: "offline", connectionCount: 0 });
        } else {
            // Still has other connections open — keep online and reset idle timer
            await setEntry(eId, { status: "online", connectionCount: newCount });
            startIdleTimer(eId);
        }
    };

    const onPing = async (eId: string): Promise<void> => {
        const entry = await getEntry(eId);
        if (entry.connectionCount > 0) {
            await setEntry(eId, { ...entry, status: "online" });
            startIdleTimer(eId);
        }
    };

    const getStatus = async (eId: string): Promise<UserStatus> => {
        const entry = await getEntry(eId);
        return entry.status;
    };

    const getStatuses = async (eIds: string[]): Promise<Map<string, UserStatus>> => {
        const result = new Map<string, UserStatus>();
        if (!eIds.length) return result;

        const keys = eIds.map(redisKey);
        const values = await redis.mGet(keys);

        eIds.forEach((eId, i) => {
            const raw = values[i];
            const entry: StatusEntry = raw ? JSON.parse(raw) : { status: "offline", connectionCount: 0 };
            result.set(eId, entry.status);
        });

        return result;
    };

    return { onConnect, onDisconnect, onPing, getStatus, getStatuses };
}
