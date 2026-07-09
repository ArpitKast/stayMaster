-- Device tokens linked to users (hosts)
CREATE TABLE IF NOT EXISTS device_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device_token VARCHAR(255) NOT NULL,
  platform VARCHAR(50) DEFAULT 'host_app',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_device (user_id, device_token),
  INDEX idx_device_token (device_token),
  INDEX idx_device_user (user_id)
);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(191) NOT NULL,
  body TEXT,
  data JSON NULL,
  status VARCHAR(20) DEFAULT 'sent',
  fcm_response TEXT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at DATETIME NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notification_user (user_id),
  INDEX idx_notification_read (user_id, is_read),
  INDEX idx_notification_created (created_at)
);
