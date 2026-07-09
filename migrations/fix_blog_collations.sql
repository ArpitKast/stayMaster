-- Fix collation mismatch for blog-related tables
-- Standardizing on utf8mb4_unicode_ci to match the rest of the project

ALTER TABLE `blogs` 
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `blog_categories` 
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `blog_tags` 
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
