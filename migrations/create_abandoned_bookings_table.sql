-- Migration: create_abandoned_bookings_table
-- Stores partial booking data for users who started but did not complete checkout.
-- The main `bookings` table is only written to on successful payment.

CREATE TABLE IF NOT EXISTS abandoned_bookings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    session_id      VARCHAR(128) DEFAULT NULL,
    booking_data    JSON NOT NULL,
    last_completed_step VARCHAR(64) NOT NULL DEFAULT 'login',
    status          ENUM('abandoned', 'resumed', 'completed') NOT NULL DEFAULT 'abandoned',
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id   (user_id),
    INDEX idx_status    (status),
    INDEX idx_session   (session_id),
    INDEX idx_activity  (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
