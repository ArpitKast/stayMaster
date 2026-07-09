-- Listing card text (plain, ~3 lines). Keeps list queries fast — no need to read `content`.
-- Run once on the database. Safe to re-run only if the column does not exist yet.

ALTER TABLE `blogs`
  ADD COLUMN `listing_excerpt` VARCHAR(320) NULL DEFAULT NULL AFTER `keywords`;

-- One-time backfill for existing posts (reads `content` once at migration time, not on every page load).
-- Requires MySQL 8+. Comment out if you prefer to backfill only when posts are re-saved.
UPDATE `blogs`
SET `listing_excerpt` = LEFT(REGEXP_REPLACE(`content`, '<[^>]+>', ''), 280)
WHERE (`listing_excerpt` IS NULL OR `listing_excerpt` = '')
  AND `content` IS NOT NULL
  AND CHAR_LENGTH(TRIM(`content`)) > 0;
