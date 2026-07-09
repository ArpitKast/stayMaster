-- Create blog_categories table
CREATE TABLE IF NOT EXISTS `blog_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create blog_tags table
CREATE TABLE IF NOT EXISTS `blog_tags` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill blog_categories from existing blogs.category values
INSERT INTO `blog_categories` (`name`, `slug`, `active`)
SELECT DISTINCT
  TRIM(`category`) AS `name`,
  LOWER(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(TRIM(`category`), '&', ' and '),
          '/',
          '-'
        ),
        ' ',
        '-'
      ),
      '--',
      '-'
    )
  ) AS `slug`,
  1 AS `active`
FROM `blogs`
WHERE `category` IS NOT NULL
  AND TRIM(`category`) <> ''
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`);
