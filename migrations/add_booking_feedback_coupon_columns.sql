ALTER TABLE `bookings`
ADD COLUMN `feedback_coupon_code` varchar(50) DEFAULT NULL AFTER `lastOperation`,
ADD COLUMN `feedback_coupon_discount` int DEFAULT NULL AFTER `feedback_coupon_code`,
ADD COLUMN `feedback_coupon_generated_at` datetime DEFAULT NULL AFTER `feedback_coupon_discount`;
