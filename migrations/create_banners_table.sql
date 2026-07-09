-- Home page banners table
CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NOT NULL,
  link VARCHAR(500) NULL,
  `order` INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banner_active (active),
  INDEX idx_banner_order (`order`)
);
