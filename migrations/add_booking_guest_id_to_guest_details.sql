-- Migration to add booking_guest_id to guest_details table
-- To uniquely identify guests within a booking when user_id is null

-- 1. Add booking_guest_id if it doesn't exist
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'booking_guest_id');
SET @sqlstmt := IF(@col_exists = 0, 'ALTER TABLE guest_details ADD COLUMN booking_guest_id INT NULL DEFAULT NULL', 'SELECT "Column booking_guest_id already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add foreign key constraint if it doesn't exist
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND CONSTRAINT_NAME = 'fk_guest_details_booking_guest' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sqlstmt := IF(@fk_exists = 0, 'ALTER TABLE guest_details ADD CONSTRAINT fk_guest_details_booking_guest FOREIGN KEY (booking_guest_id) REFERENCES booking_guests(id) ON DELETE CASCADE', 'SELECT "FK fk_guest_details_booking_guest already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add index if it doesn't exist
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND INDEX_NAME = 'idx_booking_guest_id');
SET @sqlstmt := IF(@idx_exists = 0, 'ALTER TABLE guest_details ADD INDEX idx_booking_guest_id (booking_guest_id)', 'SELECT "Index idx_booking_guest_id already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
