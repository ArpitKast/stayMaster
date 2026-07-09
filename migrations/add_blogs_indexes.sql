-- Migration: Add performance indexes to the blogs table
-- Purpose: Support fast sorting by created_at and filtering by active status
-- on the /manager/blogs list endpoint.
--
-- Run once against the database. Safe to run on a live table
-- (InnoDB online DDL will not block reads).

ALTER TABLE `blogs`
  ADD INDEX `idx_blogs_active`         (`active`),
  ADD INDEX `idx_blogs_created_at`     (`created_at`),
  ADD INDEX `idx_blogs_active_created` (`active`, `created_at`);
