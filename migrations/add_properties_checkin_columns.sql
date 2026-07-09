-- Migration: add columns used by the pre-checkin frontend to the properties table
-- Run once against your MySQL database.

ALTER TABLE properties
  ADD COLUMN google_rating DECIMAL(2,1) NULL COMMENT 'Google Maps star rating (e.g. 4.8)';

ALTER TABLE properties
  ADD COLUMN google_review_count INT UNSIGNED NULL COMMENT 'Number of Google reviews';

ALTER TABLE properties
  ADD COLUMN property_manager_name VARCHAR(255) NULL COMMENT 'Name of on-site property manager';

ALTER TABLE properties
  ADD COLUMN property_manager_phone VARCHAR(20) NULL COMMENT 'Contact phone for property manager';

ALTER TABLE properties
  ADD COLUMN property_manager_email VARCHAR(255) NULL COMMENT 'Contact email for property manager';

ALTER TABLE properties
  ADD COLUMN maintenance_number VARCHAR(20) NULL COMMENT 'Emergency / maintenance contact number';

ALTER TABLE properties
  ADD COLUMN nearby_places JSON NULL COMMENT 'JSON array of nearby places [{name,image,category,rating,description,distance,drive,tags}]';
