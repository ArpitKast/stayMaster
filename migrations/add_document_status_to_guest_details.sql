-- Migration: add_document_status_to_guest_details
-- Adds id_proof_type, id_proof_number, document_status, and document_rejection_reason
-- to the guest_details table for India hotel policy compliance and document approval workflow.

-- id_proof_type
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'id_proof_type');
SET @sqlstmt := IF(@col_exists = 0,
  'ALTER TABLE guest_details ADD COLUMN id_proof_type VARCHAR(50) DEFAULT NULL COMMENT ''aadhar | passport | driving_license | voter_id | pan_card | oci_foreign'' AFTER id_file',
  'SELECT ''Column id_proof_type already exists''');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- id_proof_number
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'id_proof_number');
SET @sqlstmt := IF(@col_exists = 0,
  'ALTER TABLE guest_details ADD COLUMN id_proof_number VARCHAR(100) DEFAULT NULL COMMENT ''ID proof number entered by guest'' AFTER id_proof_type',
  'SELECT ''Column id_proof_number already exists''');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- document_status
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'document_status');
SET @sqlstmt := IF(@col_exists = 0,
  'ALTER TABLE guest_details ADD COLUMN document_status VARCHAR(20) NOT NULL DEFAULT ''pending'' COMMENT ''pending | approved | rejected'' AFTER id_proof_number',
  'SELECT ''Column document_status already exists''');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- document_rejection_reason
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_details' AND COLUMN_NAME = 'document_rejection_reason');
SET @sqlstmt := IF(@col_exists = 0,
  'ALTER TABLE guest_details ADD COLUMN document_rejection_reason TEXT DEFAULT NULL COMMENT ''Reason provided when document is rejected'' AFTER document_status',
  'SELECT ''Column document_rejection_reason already exists''');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
