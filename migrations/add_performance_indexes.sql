-- ============================================================
-- StayMaster Performance Indexes Migration
-- Generated: 2026-05-31
-- Run with: mysql -u <user> -p <database> < add_performance_indexes.sql
-- All statements use IF NOT EXISTS / CREATE INDEX ... USING BTREE
-- Safe to run multiple times (IF NOT EXISTS prevents errors)
-- ============================================================

-- Use ALGORITHM=INPLACE where possible to avoid full table locks
-- On a busy production table, run during off-peak or use pt-online-schema-change

-- ============================================================
-- bookings (central table — most queries hit this)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_start
    ON bookings(start);

CREATE INDEX IF NOT EXISTS idx_bookings_end
    ON bookings(end);

CREATE INDEX IF NOT EXISTS idx_bookings_start_end
    ON bookings(start, end);

CREATE INDEX IF NOT EXISTS idx_bookings_property_id
    ON bookings(property_id);

CREATE INDEX IF NOT EXISTS idx_bookings_guest_id
    ON bookings(guest_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id
    ON bookings(user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_uniqueid
    ON bookings(uniqueId);

CREATE INDEX IF NOT EXISTS idx_bookings_status
    ON bookings(currentStatus);

CREATE INDEX IF NOT EXISTS idx_bookings_createDatetime
    ON bookings(createDatetime);

CREATE INDEX IF NOT EXISTS idx_bookings_user_createdt
    ON bookings(user_id, createDatetime);

-- Composite for calendar availability queries: WHERE property_id=? AND start<=? AND end>=?
CREATE INDEX IF NOT EXISTS idx_bookings_prop_start_end
    ON bookings(property_id, start, end);

CREATE INDEX IF NOT EXISTS idx_bookings_subBookingId
    ON bookings(subBookingId);

-- ============================================================
-- booking_tariffs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tariffs_booking_id
    ON booking_tariffs(booking_id);

-- ============================================================
-- booking_rentalInfo
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rentalinfo_booking_id
    ON booking_rentalInfo(booking_id);

CREATE INDEX IF NOT EXISTS idx_rentalinfo_effectivedate
    ON booking_rentalInfo(effectiveDate);

CREATE INDEX IF NOT EXISTS idx_rentalinfo_bk_effdate
    ON booking_rentalInfo(booking_id, effectiveDate);

-- ============================================================
-- guest_details
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_guest_details_booking_id
    ON guest_details(booking_id);

CREATE INDEX IF NOT EXISTS idx_guest_details_bk_lead
    ON guest_details(booking_id, is_lead);

-- ============================================================
-- users
-- ============================================================
-- Email lookups happen on every login and booking sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_phone
    ON users(phone);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

-- ============================================================
-- properties
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_properties_channel_id
    ON properties(channel_id);

CREATE INDEX IF NOT EXISTS idx_properties_slug
    ON properties(slug);

CREATE INDEX IF NOT EXISTS idx_properties_destination
    ON properties(destination);

CREATE INDEX IF NOT EXISTS idx_properties_featured
    ON properties(featured_property);

CREATE INDEX IF NOT EXISTS idx_properties_display_order
    ON properties(display_order);

-- Manager lookup — OR conditions across these columns without indexes = full scan
CREATE INDEX IF NOT EXISTS idx_properties_res_exec
    ON properties(reservation_executive);

CREATE INDEX IF NOT EXISTS idx_properties_hosp_mgr
    ON properties(hospitality_manager);

CREATE INDEX IF NOT EXISTS idx_properties_rev_mgr
    ON properties(revenue_manager);

CREATE INDEX IF NOT EXISTS idx_properties_gen_mgr
    ON properties(general_manager);

CREATE INDEX IF NOT EXISTS idx_properties_pm_user_id
    ON properties(property_manager_user_id);

-- ============================================================
-- property_media
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_property_media_prop_type
    ON property_media(property_id, media_type_id);

-- ============================================================
-- property_amenities
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prop_amenities_prop_id
    ON property_amenities(property_id);

CREATE INDEX IF NOT EXISTS idx_prop_amenities_amenity_id
    ON property_amenities(amenity_id);

-- ============================================================
-- property_collections
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prop_collections_prop_id
    ON property_collections(property_id);

CREATE INDEX IF NOT EXISTS idx_prop_collections_coll_id
    ON property_collections(collection_id);

-- ============================================================
-- property_hosts
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prop_hosts_prop_id
    ON property_hosts(property_id);

CREATE INDEX IF NOT EXISTS idx_prop_hosts_host_id
    ON property_hosts(host_id);

-- ============================================================
-- bookings_log (sync-critical table)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_log_imported
    ON bookings_log(imported);

CREATE INDEX IF NOT EXISTS idx_bookings_log_uniqueid
    ON bookings_log(UniqueID);

-- ============================================================
-- temp_RentalInfo (used heavily during Ezee data import)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_temp_rentalinfo_room_date
    ON temp_RentalInfo(RoomTypeCode, EffectiveDate);

CREATE INDEX IF NOT EXISTS idx_temp_rentalinfo_effdate
    ON temp_RentalInfo(EffectiveDate);

CREATE INDEX IF NOT EXISTS idx_temp_rentalinfo_uniqueid
    ON temp_RentalInfo(UniqueID);

-- ============================================================
-- temp_check
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_temp_check_imported
    ON temp_check(imported);

CREATE INDEX IF NOT EXISTS idx_temp_check_uniqueid
    ON temp_check(UniqueID);

-- ============================================================
-- live_bookings (already has some indexes — add missing ones)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_live_bookings_roomshort
    ON live_bookings(RoomShortCode);

CREATE INDEX IF NOT EXISTS idx_live_bookings_source
    ON live_bookings(Source);

-- ============================================================
-- notifications
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id);

-- Composite covers both unread count and mark-all-read
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read
    ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_user_createdat
    ON notifications(user_id, created_at);

-- ============================================================
-- device_tokens
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
    ON device_tokens(user_id);

-- ============================================================
-- leads
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_lead_source
    ON leads(lead_source);

CREATE INDEX IF NOT EXISTS idx_leads_created_at
    ON leads(created_at);

-- ============================================================
-- settings
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_settings_setting
    ON settings(setting);

CREATE INDEX IF NOT EXISTS idx_settings_setting_category
    ON settings(setting, category);

-- ============================================================
-- collections
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_collections_slug
    ON collections(slug);

CREATE INDEX IF NOT EXISTS idx_collections_active
    ON collections(active);
