-- Migration to add has_id_document to guest_details table

ALTER TABLE guest_details ADD COLUMN has_id_document TINYINT(1) DEFAULT 1;
