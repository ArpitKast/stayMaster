-- Migration to cleanup redundant links in guest_details
-- Removal of booking_guest_id and user_id as we consolidate data directly using booking_id

-- 1. Remove the obsolete link to booking_guests table
-- Drop foreign key fk_guest_details_booking_guest
SET @exist := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND CONSTRAINT_NAME = 'fk_guest_details_booking_guest' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE guest_details DROP FOREIGN KEY fk_guest_details_booking_guest', 'SELECT "FK fk_guest_details_booking_guest not found"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop column booking_guest_id
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'booking_guest_id');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE guest_details DROP COLUMN booking_guest_id', 'SELECT "Column booking_guest_id not found"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 2. Remove user_id as requested (only use booking_id)
-- First drop the foreign key guest_details_ibfk_2 if it exists
SET @exist := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND CONSTRAINT_NAME = 'guest_details_ibfk_2' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE guest_details DROP FOREIGN KEY guest_details_ibfk_2', 'SELECT "FK guest_details_ibfk_2 not found"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop index idx_user_id
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND INDEX_NAME = 'idx_user_id');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE guest_details DROP INDEX idx_user_id', 'SELECT "Index idx_user_id not found"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop column user_id
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'user_id');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE guest_details DROP COLUMN user_id', 'SELECT "Column user_id not found"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 3. ENSURE the correct link to bookings table exists (as requested)
-- Ensure booking_id is NOT NULL
ALTER TABLE guest_details MODIFY COLUMN booking_id INT NOT NULL;

-- Try to add the constraint if it doesn't exist
SET @exist := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND CONSTRAINT_NAME = 'fk_guest_details_booking');
SET @sqlstmt := IF(@exist > 0, 'SELECT "FK already exists"', 'ALTER TABLE guest_details ADD CONSTRAINT fk_guest_details_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure index exists
SET @index_exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND INDEX_NAME = 'idx_booking_id');
SET @sqlstmt_idx := IF(@index_exist > 0, 'SELECT "Index already exists"', 'ALTER TABLE guest_details ADD INDEX idx_booking_id (booking_id)');
PREPARE stmt_idx FROM @sqlstmt_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
