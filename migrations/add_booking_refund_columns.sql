-- Migration: Add refund management columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_notes TEXT DEFAULT NULL;
