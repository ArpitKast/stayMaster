-- Performance indexes for my-trips and booking-related queries
-- These fix full table scans that cause slow loading and timeout errors.

-- bookings: user_id for WHERE (most critical), property_id for JOIN,
--           createDatetime for ORDER BY, composite for the common pattern
ALTER TABLE `bookings`
  ADD KEY `idx_bookings_user_id`           (`user_id`),
  ADD KEY `idx_bookings_guest_id`          (`guest_id`),
  ADD KEY `idx_bookings_property_id`       (`property_id`),
  ADD KEY `idx_bookings_createDatetime`    (`createDatetime`),
  ADD KEY `idx_bookings_user_createdt`     (`user_id`, `createDatetime`);

-- property_media: composite covers the LEFT JOIN condition
--   "pm.property_id = p.id AND pm.media_type_id = 4"
ALTER TABLE `property_media`
  ADD KEY `idx_property_media_prop_type`   (`property_id`, `media_type_id`);

-- booking_rentalInfo: booking_id for IN-clause batch fetch
ALTER TABLE `booking_rentalInfo`
  ADD KEY `idx_rentalinfo_booking_id`      (`booking_id`);

-- booking_tariffs: booking_id for IN-clause batch fetch
ALTER TABLE `booking_tariffs`
  ADD KEY `idx_tariffs_booking_id`         (`booking_id`);

-- guest_details: already has idx_booking_id; add composite for
--   "WHERE booking_id = ? AND is_lead = 1" used in lead-guest lookup
ALTER TABLE `guest_details`
  ADD KEY `idx_guest_details_bk_lead`      (`booking_id`, `is_lead`);
