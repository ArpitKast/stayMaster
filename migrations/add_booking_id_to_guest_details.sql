-- Migration to add booking_id to guest_details table and update user_id constraints
-- Connects to bookings table via booking_id

-- 1. Update user_id constraints only if column exists
SET @user_id_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'user_id');

-- Modify column if it exists
SET @sqlstmt := IF(@user_id_exists > 0, 'ALTER TABLE guest_details MODIFY COLUMN user_id INT NULL', 'SELECT "Column user_id does not exist, skipping modify"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop index if it exists
SET @idx_user_id_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND INDEX_NAME = 'user_id');
SET @sqlstmt := IF(@idx_user_id_exists > 0, 'ALTER TABLE guest_details DROP INDEX user_id', 'SELECT "Index user_id does not exist, skipping drop"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 2. Add booking_id if it doesn't exist
SET @booking_id_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'booking_id');

-- Add column if it doesn't exist
SET @sqlstmt := IF(@booking_id_exists = 0, 'ALTER TABLE guest_details ADD COLUMN booking_id INT NULL', 'SELECT "Column booking_id already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if it doesn't exist
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND CONSTRAINT_NAME = 'fk_guest_details_booking' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sqlstmt := IF(@fk_exists = 0, 'ALTER TABLE guest_details ADD CONSTRAINT fk_guest_details_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE', 'SELECT "FK fk_guest_details_booking already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add index if it doesn't exist
SET @idx_booking_id_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND INDEX_NAME = 'idx_booking_id');
SET @sqlstmt := IF(@idx_booking_id_exists = 0, 'ALTER TABLE guest_details ADD INDEX idx_booking_id (booking_id)', 'SELECT "Index idx_booking_id already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
