import { Db } from "../../infra/db/db.js";
import { UserAuth, User, RefreshSession, InsertSessionDto } from "./auth.schema.js";

export type AuthRepo = {
    getById: (eId: string) => Promise<UserAuth | null>;
    getMe: (eId: string) => Promise<User | null>;

    insertSession: (dto: InsertSessionDto) => Promise<number>;
    findSessionByHash: (tokenHash: string) => Promise<RefreshSession | null>;
    revokeSession: (id: number) => Promise<void>;
    revokeAllUserSessions: (userId: string) => Promise<void>;
    updateLastUsed: (id: number) => Promise<void>;
    hashExists: (tokenHash: string) => Promise<boolean>;
};

export function makeAuthRepo(db: Db): AuthRepo {
    const getById = async (eId: string): Promise<UserAuth | null> => {
        const { rows } = await db.query(
            `SELECT
                e_id as eId,
                u.name as name,
                password_hash as passwordHash,
                r.name as roleName
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE
                e_id = ?`,
            [eId]
        );
        return rows.length > 0 ? (rows[0] as UserAuth) : null;
    };

    const getMe = async (eId: string): Promise<User | null> => {
        const { rows } = await db.query(
            `SELECT
                e_id as eId,
                u.name as name,
                r.name as role
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE e_id = ?`,
            [eId]
        );
        return rows.length > 0 ? (rows[0] as User) : null;
    };

    const insertSession = async (dto: InsertSessionDto): Promise<number> => {
        const { rows } = await db.query(
            `INSERT INTO refresh_sessions
            (user_id, token_hash, expires_at, rotated_from, user_agent, ip)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [dto.userId, dto.tokenHash, dto.expiresAt, dto.rotatedFrom, dto.userAgent, dto.ip]
        );
        return (rows as any).insertId as number;
    };

    const findSessionByHash = async (tokenHash: string): Promise<RefreshSession | null> => {
        const { rows } = await db.query(
            `SELECT
                id,
                user_id       AS userId,
                token_hash    AS tokenHash,
                expires_at    AS expiresAt,
                created_at    AS createdAt,
                rotated_from  AS rotatedFrom,
                revoked_at    AS revokedAt,
                last_used_at  AS lastUsedAt,
                user_agent    AS userAgent,
                ip
             FROM refresh_sessions
             WHERE token_hash = ?`,
            [tokenHash]
        );
        return rows.length > 0 ? (rows[0] as RefreshSession) : null;
    };

    const revokeSession = async (id: number): Promise<void> => {
        await db.query(
            `UPDATE refresh_sessions SET revoked_at = NOW() WHERE id = ?`,
            [id]
        );
    };

    // Called on reuse detection — invalidates the entire user's session family.
    const revokeAllUserSessions = async (userId: string): Promise<void> => {
        await db.query(
            `UPDATE refresh_sessions
             SET revoked_at = NOW()
             WHERE user_id = ? AND revoked_at IS NULL`,
            [userId]
        );
    };

    const updateLastUsed = async (id: number): Promise<void> => {
        await db.query(
            `UPDATE refresh_sessions SET last_used_at = NOW() WHERE id = ?`,
            [id]
        );
    };

    // Used during token generation to guarantee no hash collision before insert.
    const hashExists = async (tokenHash: string): Promise<boolean> => {
        const { rows } = await db.query(
            `SELECT 1 FROM refresh_sessions WHERE token_hash = ? LIMIT 1`,
            [tokenHash]
        );
        return rows.length > 0;
    };

    return {
        getById,
        getMe,
        insertSession,
        findSessionByHash,
        revokeSession,
        revokeAllUserSessions,
        updateLastUsed,
        hashExists,
    };
}