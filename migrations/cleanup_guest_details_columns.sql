-- Migration to remove redundant stay-specific columns from guest_details
-- These columns have been consolidated into the 'bookings' table

SET @col := 'esign_request_id'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists > 0, 'ALTER TABLE guest_details DROP COLUMN esign_request_id', 'SELECT SUBSTRING("Column esign_request_id already dropped", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'esign_status'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists > 0, 'ALTER TABLE guest_details DROP COLUMN esign_status', 'SELECT SUBSTRING("Column esign_status already dropped", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'declaration'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists > 0, 'ALTER TABLE guest_details DROP COLUMN declaration', 'SELECT SUBSTRING("Column declaration already dropped", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'purpose_of_visit'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists > 0, 'ALTER TABLE guest_details DROP COLUMN purpose_of_visit', 'SELECT SUBSTRING("Column purpose_of_visit already dropped", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'group_type'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists > 0, 'ALTER TABLE guest_details DROP COLUMN group_type', 'SELECT SUBSTRING("Column group_type already dropped", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
