-- Migration: Add token_invalid_after column to users table
-- Purpose: Enables server-side JWT invalidation on logout.
-- When a user logs out, this column is set to the current Unix timestamp.
-- The validateToken middleware rejects any JWT whose iat (issued-at) is older than this value.

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_invalid_after');
SET @sqlstmt := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN token_invalid_after BIGINT DEFAULT 0 COMMENT ''Unix timestamp; tokens issued before this value are rejected (used for logout invalidation)''', 'SELECT ''Column token_invalid_after already exists''');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
