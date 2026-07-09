-- Master Migration for Guest Normalization
-- 1. Add guest_id (GUEST-XXXX) to guest_details
-- 2. Link booking_guests_info to guest_details
-- 3. Remove redundant data

-- PART 1: Update guest_details
ALTER TABLE guest_details ADD COLUMN guest_id VARCHAR(20) UNIQUE AFTER id;

-- PART 2: Update booking_guests_info
ALTER TABLE booking_guests_info ADD COLUMN guest_details_id INT AFTER booking_id;
ALTER TABLE booking_guests_info ADD CONSTRAINT fk_bgi_guest_details FOREIGN KEY (guest_details_id) REFERENCES guest_details(id) ON DELETE CASCADE;

-- Note: We skip the DROP COLUMN part for now to allow for safe data migration logic in code.
-- Redundant columns to be dropped later: 
-- booking_guests_info: guest_name, guest_email, guest_phone, gender
-- guest_details: booking_id
