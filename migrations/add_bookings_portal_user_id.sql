-- Portal account (users.id) tied to main-site booking + payment. Distinct from guest_id (precheckin / lead guest).

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'user_id'
);

SET @sqlstmt := IF(
  @col_exists = 0,
  'ALTER TABLE `bookings` ADD COLUMN `user_id` INT NULL DEFAULT NULL COMMENT ''Portal user (OTP payment account)'' AFTER `guest_id`',
  'SELECT ''bookings.user_id already exists'' AS skip_msg'
);
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'idx_bookings_user_id'
);
SET @sqlidx := IF(
  @idx_exists = 0 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'user_id') > 0,
  'CREATE INDEX `idx_bookings_user_id` ON `bookings` (`user_id`)',
  'SELECT ''idx_bookings_user_id already exists or column missing'' AS skip_msg'
);
PREPARE stmtidx FROM @sqlidx;
EXECUTE stmtidx;
DEALLOCATE PREPARE stmtidx;
