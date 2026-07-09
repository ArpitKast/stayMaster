-- Migration to create guest_details table
-- Connects to users table via user_id

CREATE TABLE IF NOT EXISTS guest_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    mobile VARCHAR(50) DEFAULT '',
    gender VARCHAR(20) DEFAULT '',
    dob DATE NULL,
    age INT DEFAULT 0,
    guest_type VARCHAR(50) DEFAULT 'family', -- family, friend, colleague, other
    id_proof_type VARCHAR(50) DEFAULT '', -- aadhar, passport, driving_license, voter_id
    id_proof_number VARCHAR(100) DEFAULT '',
    is_lead TINYINT(1) DEFAULT 0, -- 1 if this is the lead guest
    city VARCHAR(100) DEFAULT '',
    state VARCHAR(100) DEFAULT '',
    country VARCHAR(100) DEFAULT '',
    address TEXT DEFAULT '',
    zip VARCHAR(20) DEFAULT '',
    id_file VARCHAR(500) DEFAULT '',
    declaration TINYINT(1) DEFAULT 0,
    gst_bill TINYINT(1) DEFAULT 0,
    gst_number VARCHAR(50) DEFAULT '',
    business_name VARCHAR(255) DEFAULT '',
    stayed_before VARCHAR(10) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX idx_booking_id (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
