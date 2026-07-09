-- Save full Zoop eSign JSON responses to bookings table
-- esign_init_response  : full JSON from POST /contract/esign/v5/init
-- esign_webhook_response : full JSON payload received from Zoop webhook

SET @col := 'esign_init_response';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0,
    'ALTER TABLE bookings ADD COLUMN esign_init_response JSON DEFAULT NULL',
    'SELECT SUBSTRING("Column esign_init_response already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'esign_webhook_response';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0,
    'ALTER TABLE bookings ADD COLUMN esign_webhook_response JSON DEFAULT NULL',
    'SELECT SUBSTRING("Column esign_webhook_response already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
