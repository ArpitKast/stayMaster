-- Scalnex blog webhook: external id dedupe + webhook audit log

SET @col := 'external_source';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blogs' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0,
    'ALTER TABLE blogs ADD COLUMN external_source VARCHAR(50) NULL DEFAULT NULL',
    'SELECT SUBSTRING("Column external_source already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'external_id';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blogs' AND COLUMN_NAME = @col);
SET @sqlstmt := IF(@exists = 0,
    'ALTER TABLE blogs ADD COLUMN external_id VARCHAR(255) NULL DEFAULT NULL',
    'SELECT SUBSTRING("Column external_id already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blogs' AND INDEX_NAME = 'idx_blogs_external');
SET @sqlstmt := IF(@idx_exists = 0,
    'ALTER TABLE blogs ADD UNIQUE INDEX idx_blogs_external (external_source, external_id)',
    'SELECT SUBSTRING("Index idx_blogs_external already exists", 1, 0)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS scalnex_webhook_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(100) NULL,
  external_id VARCHAR(255) NULL,
  payload JSON,
  status ENUM('received','created','updated','failed') DEFAULT 'received',
  blog_id INT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
