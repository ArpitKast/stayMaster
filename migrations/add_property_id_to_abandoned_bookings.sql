-- Add property_id column and change the unique key to (user_id, property_id)
-- so each user can have one abandoned booking per property.

ALTER TABLE abandoned_bookings
  ADD COLUMN IF NOT EXISTS property_id INT UNSIGNED NOT NULL DEFAULT 0 AFTER user_id;

-- Drop the old single-user unique key
ALTER TABLE abandoned_bookings
  DROP INDEX IF EXISTS uniq_user_id;

-- Add composite unique key
ALTER TABLE abandoned_bookings
  ADD UNIQUE KEY IF NOT EXISTS uniq_user_property (user_id, property_id);
