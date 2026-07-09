-- Migration: Add security deposit columns to bookings table
-- Description: Adds columns to track security deposit amount, payment status, and gateway references.
-- Using separate statements for idempotency in runAllMigrations script.

ALTER TABLE `bookings` ADD COLUMN `security_deposit` DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE `bookings` ADD COLUMN `security_deposit_paid` TINYINT(1) DEFAULT 0;
ALTER TABLE `bookings` ADD COLUMN `security_deposit_status` VARCHAR(50) DEFAULT 'unpaid';
ALTER TABLE `bookings` ADD COLUMN `security_deposit_reference` VARCHAR(255) DEFAULT NULL;
