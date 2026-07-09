CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country_code VARCHAR(10) NOT NULL DEFAULT '+91',
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_leads_phone_digits CHECK (phone REGEXP '^[0-9]+$'),
  INDEX idx_leads_created (created_at),
  INDEX idx_leads_email (email)
);
