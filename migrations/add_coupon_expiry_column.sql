ALTER TABLE `bookings`
ADD COLUMN `feedback_coupon_expiry` datetime DEFAULT NULL AFTER `feedback_coupon_generated_at`;
