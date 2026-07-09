-- Migration: Add Property Manager role
-- Run this once to add the manager role to the settings table

-- Add manager role entry (role id 271 matches constants.js ROLE_MANAGER)
INSERT IGNORE INTO settings (id, setting, value, display) VALUES (271, 'role', 'manager', 'Property Manager');

-- Ensure the users table can store role 271
-- (No schema change needed – role column is already INT)

-- Add property_manager_user_id column to properties if not already present
-- This links a property to its assigned manager user (in addition to existing text fields)
ALTER TABLE properties
  ADD COLUMN property_manager_user_id INT NULL COMMENT 'FK to users.id - assigned property manager' AFTER property_manager_email;

-- Optional: add index for fast lookup of manager's properties
CREATE INDEX IF NOT EXISTS idx_properties_manager ON properties (property_manager_user_id);
