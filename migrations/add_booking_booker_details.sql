-- Migration to add booker contact columns to bookings table
-- Adds booker_name and booker_phone for capturing non-staying booker details
ALTER TABLE bookings ADD COLUMN booker_name VARCHAR(255) DEFAULT '' AFTER group_type;
ALTER TABLE bookings ADD COLUMN booker_phone VARCHAR(20) DEFAULT '' AFTER booker_name;
