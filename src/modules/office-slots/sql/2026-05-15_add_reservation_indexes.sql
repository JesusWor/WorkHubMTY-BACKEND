-- Additive indexes for reservation overlap and participant lookups.
-- Safe to run on existing data.

CREATE INDEX idx_reservations_overlap
  ON reservations (reservable_id, start_time, end_time, can_overlap);

CREATE INDEX idx_events_overlap
  ON events (reservable_id, start_time, end_time);

CREATE INDEX idx_reservation_participants_owner
  ON reservation_participants (user_id, ownership_priority, reservations_id);
