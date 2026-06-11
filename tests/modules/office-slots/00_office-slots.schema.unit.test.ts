import { describe, it, expect } from 'vitest';
import {
  ReservableSchema,
  CreateReservableSchema,
  UpdateReservableSchema,
  ReservationSchema,
  ParticipantSchema,
  ReservationWithParticipantsSchema,
  TimestampPairSchema,
  CreateReservationBatchSchema,
  BlockBatchSchema,
  ListReservationsQuerySchema,
  AvailableReservablesQuerySchema,
  ReservationIdBodySchema,
  inferReservationLifecycle,
} from '../../../src/modules/office-slots/office-slots.schema.js';

const reservable = {
  id: 1,
  name: 'Sala Norte',
  capacity: 8,
  floor: 'Piso 1',
  status: 'available',
  is_blocked: false,
};

const reservation = {
  id: 1,
  reservable_id: 1,
  category: 'RESERVATION',
  start_time: '2026-06-08T10:00:00.000Z',
  end_time: '2026-06-08T11:00:00.000Z',
  description: '',
  attendance_status: 'NOT_ARRIVED',
  lifecycle_status: 'ACTIVE',
  created_at: '2026-06-08T09:00:00.000Z',
  updated_at: '2026-06-08T09:00:00.000Z',
};

const participant = {
  id: 1,
  reservations_id: 1,
  user_id: 'USR00001',
  ownership_priority: 0,
  attendance_status: 'NOT_ARRIVED',
  created_at: '2026-06-08T09:00:00.000Z',
  updated_at: '2026-06-08T09:00:00.000Z',
};

describe('Reservable schemas', () => {
  it('acepta reservable y create/update', () => {
    expect(ReservableSchema.safeParse(reservable).success).toBe(true);
    expect(CreateReservableSchema.safeParse({
      name: 'Sala Norte',
      capacity: 8,
      status: 'available',
      is_blocked: false,
      floor_id: 1,
    }).success).toBe(true);
    expect(UpdateReservableSchema.safeParse({ capacity: 10, blockExpiresAt: '2026-06-09T00:00:00.000Z' }).success).toBe(true);
  });

  it('falla con capacity invalida', () => {
    expect(ReservableSchema.safeParse({ ...reservable, capacity: 0 }).success).toBe(false);
  });
});

describe('Reservation and participant schemas', () => {
  it('acepta reservacion, participante y detalle completo', () => {
    expect(ReservationSchema.safeParse(reservation).success).toBe(true);
    expect(ParticipantSchema.safeParse(participant).success).toBe(true);
    expect(ReservationWithParticipantsSchema.safeParse({
      ...reservation,
      reservable,
      participants: [participant],
    }).success).toBe(true);
  });

  it('infiere lifecycle por attendance', () => {
    expect(inferReservationLifecycle('NOT_ARRIVED')).toBe('ACTIVE');
    expect(inferReservationLifecycle('CANCELED')).toBe('CANCELED');
    expect(inferReservationLifecycle('CHECKED_OUT')).toBe('FINALIZED');
  });
});

describe('Batch and query schemas', () => {
  const timestamp = {
    start_time: '2026-06-08T10:00:00.000Z',
    end_time: '2026-06-08T11:00:00.000Z',
  };

  it('valida timestamp y batch de reservacion', () => {
    expect(TimestampPairSchema.safeParse(timestamp).success).toBe(true);
    expect(CreateReservationBatchSchema.safeParse({
      reservable_id: 1,
      timestamps: [timestamp],
      participants: ['USR00002'],
      teamIds: [],
    }).success).toBe(true);
  });

  it('rechaza timestamps repetidos y rangos invalidos', () => {
    expect(TimestampPairSchema.safeParse({ start_time: timestamp.end_time, end_time: timestamp.start_time }).success).toBe(false);
    expect(CreateReservationBatchSchema.safeParse({
      reservable_id: 1,
      timestamps: [timestamp, timestamp],
    }).success).toBe(false);
  });

  it('valida block batch y list query', () => {
    expect(BlockBatchSchema.safeParse({ reservable_id: 1, timestamps: [timestamp] }).success).toBe(true);
    expect(ListReservationsQuerySchema.safeParse({ reservable_id: '1', limit: '25', cursor: null }).success).toBe(true);
  });

  it('valida filtros de disponibilidad y body de consulta por slot', () => {
    expect(AvailableReservablesQuerySchema.safeParse({
      floorId: '1',
      minCapacity: '2',
      startTime: timestamp.start_time,
      endTime: timestamp.end_time,
    }).success).toBe(true);

    expect(ReservationIdBodySchema.safeParse({ dates: ['2026-06-08'] }).success).toBe(true);
    expect(ReservationIdBodySchema.safeParse(timestamp).success).toBe(true);
    expect(ReservationIdBodySchema.safeParse({}).success).toBe(false);
  });
});
