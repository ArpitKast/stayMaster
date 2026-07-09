-- New migration for storing detailed guest feedback
CREATE TABLE IF NOT EXISTS stay_feedbacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    overall_rating INT NOT NULL,
    cleanliness INT DEFAULT 0,
    comfort INT DEFAULT 0,
    location INT DEFAULT 0,
    amenities INT DEFAULT 0,
    service INT DEFAULT 0,
    caretaker INT DEFAULT 0,
    property_manager INT DEFAULT 0,
    comment TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
