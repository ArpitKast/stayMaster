-- Migration: add events and corporate offsite flags for property management

ALTER TABLE properties
  ADD COLUMN for_events TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this managed property is available for events' AFTER featured_property,
  ADD COLUMN for_corporate_offsite TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this managed property is available for corporate offsite' AFTER for_events;
