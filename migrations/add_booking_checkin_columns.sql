-- Migration to add check-in columns to bookings table
-- Refactored to use individual statements for idempotency within the runAllMigrations script
ALTER TABLE bookings ADD COLUMN declaration TINYINT(1) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN esign_request_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE bookings ADD COLUMN esign_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN stayed_before VARCHAR(10) DEFAULT '';
ALTER TABLE bookings ADD COLUMN purpose_of_visit VARCHAR(255) DEFAULT '';
ALTER TABLE bookings ADD COLUMN group_type VARCHAR(100) DEFAULT '';
