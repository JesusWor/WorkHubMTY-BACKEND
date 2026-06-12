import { describe, it, expect } from 'vitest';
import {
    FriendshipSchema,
    FriendRequestSchema,
    CreateFriendRequestSchema,
    AcceptFriendRequestSchema,
    SourceEnum,
    RequestStatusEnum,
} from '../../../src/modules/friendship/friendship.schema';

describe('SourceEnum / RequestStatusEnum', () => {
    it('acepta valores válidos de SourceEnum', () => {
        expect(SourceEnum.safeParse('ADMIN').success).toBe(true);
        expect(SourceEnum.safeParse('REQUEST').success).toBe(true);
        expect(SourceEnum.safeParse('OTHER').success).toBe(false);
    });

    it('acepta valores válidos de RequestStatusEnum', () => {
        expect(RequestStatusEnum.safeParse('PENDING').success).toBe(true);
        expect(RequestStatusEnum.safeParse('ACCEPTED').success).toBe(true);
        expect(RequestStatusEnum.safeParse('REJECTED').success).toBe(true);
        expect(RequestStatusEnum.safeParse('CANCELLED').success).toBe(true);
        expect(RequestStatusEnum.safeParse('INVALID').success).toBe(false);
    });
});

describe('FriendshipSchema', () => {
    it('acepta una amistad válida', () => {
        const result = FriendshipSchema.safeParse({
            userLow: 'USR00001',
            userHigh: 'USR00002',
            source: 'REQUEST',
            createdAt: '2024-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza sin source', () => {
        const result = FriendshipSchema.safeParse({
            userLow: 'USR00001',
            userHigh: 'USR00002',
            createdAt: '2024-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(false);
    });
});

describe('FriendRequestSchema', () => {
    it('acepta un friend request válido', () => {
        const result = FriendRequestSchema.safeParse({
            id: 1,
            fromUser: 'USR00001',
            toUserIds: ['USR00002'],
            status: 'PENDING',
            createdAt: '2024-01-01T00:00:00.000Z',
            resolvedAt: null,
        });
        expect(result.success).toBe(true);
    });

    it('acepta resolvedAt no nulo', () => {
        const result = FriendRequestSchema.safeParse({
            id: 2,
            fromUser: 'USR00001',
            toUserIds: ['USR00002'],
            status: 'ACCEPTED',
            createdAt: '2024-01-01T00:00:00.000Z',
            resolvedAt: '2024-01-02T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });
});

describe('CreateFriendRequestSchema', () => {
    it('acepta toUserIds con múltiples usuarios', () => {
        const result = CreateFriendRequestSchema.safeParse({
            toUserIds: ['USR00002', 'USR00003'],
        });
        expect(result.success).toBe(true);
    });

    it('acepta mensaje opcional', () => {
        const result = CreateFriendRequestSchema.safeParse({
            toUserIds: ['USR00002'],
            message: 'Hola!',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza sin toUserIds', () => {
        const result = CreateFriendRequestSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

describe('AcceptFriendRequestSchema', () => {
    it('acepta fromUser válido', () => {
        expect(AcceptFriendRequestSchema.safeParse({ fromUser: 'USR00001' }).success).toBe(true);
    });

    it('rechaza sin fromUser', () => {
        expect(AcceptFriendRequestSchema.safeParse({}).success).toBe(false);
    });
});
