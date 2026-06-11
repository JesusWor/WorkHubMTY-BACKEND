import { describe, it, expect, vi } from 'vitest';
import { makeOfficeSlotsService } from '../../../src/modules/office-slots/office-slots.service.js';
import { OfficeSlotsRepo } from '../../../src/modules/office-slots/office-slots.repo.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError.js';
import { Roles } from '../../../src/shared/types/role.type.js';

const caller = { eId: 'USR00001', role: Roles.USER };
const admin = { eId: 'ADM00001', role: Roles.ADMIN };

const reservable = { id: 1, name: 'Sala Norte', capacity: 8, floor: 'Piso 1', status: 'available', is_blocked: false };
const reservation = {
  id: 1,
  reservable_id: 1,
  category: 'RESERVATION',
  start_time: new Date('2026-06-08T10:00:00.000Z'),
  end_time: new Date('2026-06-08T11:00:00.000Z'),
  description: '',
  attendance_status: 'NOT_ARRIVED',
  lifecycle_status: 'ACTIVE',
  created_at: new Date(),
  updated_at: new Date(),
};
const participant = { id: 1, reservations_id: 1, user_id: 'USR00001', ownership_priority: 0, attendance_status: 'NOT_ARRIVED', created_at: new Date(), updated_at: new Date() };
const detail = { ...reservation, reservable, participants: [participant] };

function makeRepo(overrides: Partial<OfficeSlotsRepo> = {}): OfficeSlotsRepo {
  return {
    getAllReservables: vi.fn().mockResolvedValue([reservable]),
    getAvailableReservables: vi.fn().mockResolvedValue([reservable]),
    getReservableById: vi.fn().mockResolvedValue(reservable),
    createReservable: vi.fn().mockResolvedValue(reservable),
    updateReservable: vi.fn().mockResolvedValue(reservable),
    deleteReservable: vi.fn().mockResolvedValue(true),
    getReservationSummariesBySlot: vi.fn().mockResolvedValue([]),
    getReservationDetailsBySlot: vi.fn().mockResolvedValue([]),
    getReservationById: vi.fn().mockResolvedValue(reservation),
    getReservationWithParticipants: vi.fn().mockResolvedValue(detail),
    listReservations: vi.fn().mockResolvedValue({ items: [detail], nextCursor: null }),
    getReservationsByUser: vi.fn().mockResolvedValue([detail]),
    createReservationBatch: vi.fn().mockResolvedValue([detail]),
    cancelReservation: vi.fn().mockResolvedValue({ ...reservation, attendance_status: 'CANCELED' }),
    updateReservationAttendance: vi.fn().mockResolvedValue({ ...reservation, attendance_status: 'CHECKED_IN' }),
    getParticipantById: vi.fn().mockResolvedValue(participant),
    getParticipantByReservationAndUser: vi.fn().mockResolvedValue(participant),
    getParticipantsByReservation: vi.fn().mockResolvedValue([participant]),
    updateParticipantAttendance: vi.fn().mockResolvedValue({ ...participant, attendance_status: 'CHECKED_IN' }),
    markNoShowForReservation: vi.fn(),
    markCheckoutForReservation: vi.fn(),
    getPendingNoShowReservations: vi.fn(),
    getPendingCheckoutReservations: vi.fn(),
    ...overrides,
  } as OfficeSlotsRepo;
}

function makeService(repo = makeRepo(), overrides = {}) {
  return makeOfficeSlotsService({
    repo,
    friendshipService: { getFriendIds: vi.fn().mockResolvedValue(['USR00002']) } as any,
    teamsService: { getTeamMembers: vi.fn().mockResolvedValue([{ eId: 'USR00003' }]) } as any,
    queue: { add: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) } as any,
    emitter: { emit: vi.fn() } as any,
    ...overrides,
  });
}

describe('OfficeSlotsService reservables', () => {
  it('lista, crea, actualiza y elimina reservables', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await expect(service.getAllReservables()).resolves.toEqual([reservable]);
    await expect(service.createReservable({ name: 'Sala Norte', capacity: 8, floor_id: 1, status: 'available', is_blocked: false })).resolves.toEqual(reservable);
    await expect(service.updateReservable(1, { capacity: 9 })).resolves.toEqual(reservable);
    await expect(service.deleteReservable(1)).resolves.toBeUndefined();
  });

  it('lanza NotFoundError si reservable no existe', async () => {
    await expect(makeService(makeRepo({ getReservableById: vi.fn().mockResolvedValue(null) })).getReservableById(99))
      .rejects.toThrow(NotFoundError);
  });
});

describe('OfficeSlotsService reservations', () => {
  it('lista reservaciones usando amigos del caller', async () => {
    const repo = makeRepo();
    const friendshipService = { getFriendIds: vi.fn().mockResolvedValue(['USR00002']) };
    const service = makeService(repo, { friendshipService });

    await service.listReservations({ cursor: null }, caller);
    expect(friendshipService.getFriendIds).toHaveBeenCalledWith('USR00001');
    expect(repo.listReservations).toHaveBeenCalledWith({ cursor: null }, 'USR00001', ['USR00002']);
  });

  it('enmascara participantes no amigos en detalle', async () => {
    const repo = makeRepo({ getReservationWithParticipants: vi.fn().mockResolvedValue({
      ...detail,
      participants: [{ ...participant, user_id: 'USR99999' }],
    }) });
    const service = makeService(repo, { friendshipService: { getFriendIds: vi.fn().mockResolvedValue([]) } });

    const result = await service.getReservationDetail(1, caller);
    expect(result.participants[0].user_id).toBeNull();
  });

  it('crea batch mezclando participantes y team members', async () => {
    const repo = makeRepo();
    const teamsService = { getTeamMembers: vi.fn().mockResolvedValue([{ eId: 'USR00003' }]) };
    const service = makeService(repo, { teamsService });
    const timestamps = [{ start_time: new Date('2026-06-08T10:00:00.000Z'), end_time: new Date('2026-06-08T11:00:00.000Z') }];

    await expect(service.createReservationBatch({ reservable_id: 1, category: 'RESERVATION', description: '', timestamps, participants: ['USR00002'], teamIds: ['TEAM1'] }, caller))
      .resolves.toEqual([detail]);
    expect(repo.createReservationBatch).toHaveBeenCalledWith('USR00001', 1, 'RESERVATION', '', timestamps, ['USR00002', 'USR00003']);
  });

  it('solo owner activo o admin puede cancelar reservacion normal', async () => {
    const service = makeService(makeRepo({ getReservationWithParticipants: vi.fn().mockResolvedValue({ ...detail, participants: [{ ...participant, user_id: 'OTHER' }] }) }));

    await expect(service.cancelReservation(1, caller)).rejects.toThrow(ForbiddenError);
    await expect(service.cancelReservation(1, admin)).resolves.toEqual(expect.objectContaining({ attendance_status: 'CANCELED' }));
  });

  it('actualiza checkin de participante', async () => {
    const service = makeService();

    await expect(service.participantCheckin(1, caller)).resolves.toEqual({
      reservation: expect.objectContaining({ id: 1 }),
      participant: expect.objectContaining({ attendance_status: 'CHECKED_IN' }),
    });
  });

  it('lanza ConflictError en transicion invalida de participante', async () => {
    const service = makeService(makeRepo({ getParticipantByReservationAndUser: vi.fn().mockResolvedValue({ ...participant, attendance_status: 'CHECKED_OUT' }) }));
    await expect(service.participantCheckin(1, caller)).rejects.toThrow(ConflictError);
  });
});
