import { describe, it, expect } from "vitest";
import { ListUsersQuerySchema } from "../../../src/modules/user/user.schema";

describe("ListUsersQuerySchema", () => {
    it("acepta filtros basicos", () => {
        const result = ListUsersQuerySchema.safeParse({
            name: "equipo de ventas",
            exclude: "friends,sent_requests",
            excludeId: "USR00001,USR00002",
            limit: "20",
            cursor: "eyJzY29yZSI6MSwibmFtZSI6IngiLCJlSWQiOiJ5In0=",
        });

        expect(result.success).toBe(true);
        expect(result.data?.exclude).toEqual(["friends", "sent_requests"]);
        expect(result.data?.excludeId).toEqual(["USR00001", "USR00002"]);
    });

    it("rechaza exclusiones invalidas", () => {
        const result = ListUsersQuerySchema.safeParse({
            exclude: "friends,unknown",
        });

        expect(result.success).toBe(false);
    });
});
