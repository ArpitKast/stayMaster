-- De-duplicate existing rows: keep only the latest row per user_id, delete the rest.
DELETE ab1
FROM abandoned_bookings ab1
INNER JOIN abandoned_bookings ab2
  ON ab1.user_id = ab2.user_id AND ab1.id < ab2.id;

-- Add unique constraint so INSERT … ON DUPLICATE KEY UPDATE works atomically.
ALTER TABLE abandoned_bookings
  ADD UNIQUE KEY IF NOT EXISTS uniq_user_id (user_id);
