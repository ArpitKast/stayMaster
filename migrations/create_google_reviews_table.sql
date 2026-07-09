CREATE TABLE IF NOT EXISTS google_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id VARCHAR(255) NOT NULL UNIQUE,
    author_name VARCHAR(255),
    author_url TEXT,
    author_photo_url TEXT,
    rating INT,
    text TEXT,
    relative_time VARCHAR(100),
    publish_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
