-- Staymaster Database Index Performance Optimization
-- Purpose: Speeds up Website frontend ("My Trips", settings check), Admin Panel (Manager checks, dashboard stacked chart aggregates), and synchronization cron jobs.
-- Removes redundant indexes to free disk space and optimize insert/update performance.

-- 1. Operational Indexes (Website Frontend & Webhooks)
ALTER TABLE `settings` ADD INDEX `idx_settings_setting` (`setting`);
ALTER TABLE `live_bookings` ADD INDEX `idx_live_bookings_mobile` (`Mobile`);
ALTER TABLE `live_bookings` ADD INDEX `idx_live_bookings_phone` (`Phone`);
ALTER TABLE `bookings` ADD INDEX `idx_bookings_esign_req_id` (`esign_request_id`);
ALTER TABLE `properties` ADD INDEX `idx_properties_channel_id` (`channel_id`);

-- 2. Property Manager Access & Dashboard Performance Indexes (Admin Panel)
ALTER TABLE `properties` ADD INDEX `idx_properties_reservation_exec` (`reservation_executive`);
ALTER TABLE `properties` ADD INDEX `idx_properties_hospitality_mgr` (`hospitality_manager`);
ALTER TABLE `properties` ADD INDEX `idx_properties_revenue_mgr` (`revenue_manager`);
ALTER TABLE `properties` ADD INDEX `idx_properties_general_mgr` (`general_manager`);

-- 3. Ezee PMS Sync & Temporary Table Performance Indexes
ALTER TABLE `temp_RentalInfo` ADD INDEX `idx_temp_rental_room_date` (`RoomTypeCode`, `EffectiveDate`);
ALTER TABLE `temp_RentalInfo` ADD INDEX `idx_temp_rental_unique_id` (`UniqueID`);
ALTER TABLE `temp_BookingTran` ADD INDEX `idx_temp_booking_tran_unique_id` (`UniqueID`);
ALTER TABLE `temp_BookByInfo` ADD INDEX `idx_temp_bookby_unique_id` (`UniqueID`);
ALTER TABLE `temp_paymentDetails` ADD INDEX `idx_temp_payment_unique_id` (`UniqueID`);
ALTER TABLE `temp_taxDetails` ADD INDEX `idx_temp_tax_unique_id` (`UniqueID`);
ALTER TABLE `temp_check` ADD INDEX `idx_temp_check_unique_id` (`UniqueID`);
ALTER TABLE `temp_check` ADD INDEX `idx_temp_check_imported_unique` (`imported`, `UniqueID`);
ALTER TABLE `bookings_log` ADD INDEX `idx_bookings_log_imported` (`imported`);
ALTER TABLE `live_bookings` ADD INDEX `idx_live_bookings_arrival_resno` (`ArrivalDate`, `ReservationNo`);

-- 4. Clean up Redundant/Duplicate Indexes
ALTER TABLE `guest_details` DROP INDEX `idx_guest_details_booking_id`;
ALTER TABLE `bookings` DROP INDEX `idx_bookings_user_id`;
ALTER TABLE `device_tokens` DROP INDEX `idx_device_user`;
ALTER TABLE `notifications` DROP INDEX `idx_notification_user`;
ALTER TABLE `otp` DROP INDEX `idx_otp_phone`;
