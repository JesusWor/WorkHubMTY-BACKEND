import { createClient } from "redis";
import { env } from "../../config/env.js";

const { redis: { host, port, password } } = env;

export const redis = createClient({
    socket: {
        host: host,
        port: port,
    },
    password: password,
});
const pub = redis.duplicate()
const sub = redis.duplicate()
await redis.connect()
await pub.connect()
await sub.connect()

redis.on("error", (err) => {
    console.error("Redis error:", err);
});