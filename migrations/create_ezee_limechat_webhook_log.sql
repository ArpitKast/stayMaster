-- Create table for logging Ezee -> Limechat webhook payloads
CREATE TABLE IF NOT EXISTS ezee_limechat_webhook_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation VARCHAR(100) DEFAULT NULL,
    log LONGTEXT,
    limechat_status INT DEFAULT NULL,
    limechat_success TINYINT(1) DEFAULT 0,
    limechat_response LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
