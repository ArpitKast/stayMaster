-- -----------------------------------------------------------------------------
-- Migration: Add Cancellation Request Columns to Bookings Table
-- Description: Adds columns to track user-submitted cancellation requests
-- -----------------------------------------------------------------------------

-- 1) cancellation_requested
SET @dbname = DATABASE();
SET @tablename = 'bookings';
SET @columnname = 'cancellation_requested';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN cancellation_requested TINYINT(1) DEFAULT 0;'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2) cancellation_reason
SET @columnname = 'cancellation_reason';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT DEFAULT NULL;'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3) cancellation_requested_at
SET @columnname = 'cancellation_requested_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN cancellation_requested_at DATETIME DEFAULT NULL;'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
