-- Migration to add missing columns to guest_details and bookings
-- This ensures persistent profile data and stay-specific GST data are both supported

-- 1. Add columns to guest_details (Persistent Profile for Lead Guest)
-- Define a helper pattern to add columns if they don't exist
-- For simplicity and reliability in standard MySQL script:
SET @col := 'declaration'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN declaration TINYINT(1) DEFAULT 0', 'SELECT SUBSTRING("Column declaration already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'gst_bill'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN gst_bill TINYINT(1) DEFAULT 0', 'SELECT SUBSTRING("Column gst_bill already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'gst_number'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN gst_number VARCHAR(255)', 'SELECT SUBSTRING("Column gst_number already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'business_name'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN business_name VARCHAR(255)', 'SELECT SUBSTRING("Column business_name already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'stayed_before'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN stayed_before VARCHAR(20)', 'SELECT SUBSTRING("Column stayed_before already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'purpose_of_visit'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN purpose_of_visit VARCHAR(255)', 'SELECT SUBSTRING("Column purpose_of_visit already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'group_type'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE guest_details ADD COLUMN group_type VARCHAR(255)', 'SELECT SUBSTRING("Column group_type already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 2. Add GST columns to bookings (Stay-specific data for invoicing)
SET @col := 'gst_bill'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE bookings ADD COLUMN gst_bill TINYINT(1) DEFAULT 0', 'SELECT SUBSTRING("Column gst_bill already exists on bookings", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'gst_number'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE bookings ADD COLUMN gst_number VARCHAR(255)', 'SELECT SUBSTRING("Column gst_number already exists on bookings", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'business_name'; SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0, 'ALTER TABLE bookings ADD COLUMN business_name VARCHAR(255)', 'SELECT SUBSTRING("Column business_name already exists on bookings", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
