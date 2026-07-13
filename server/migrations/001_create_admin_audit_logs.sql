-- Migration: 001_create_admin_audit_logs.sql
-- Description: Create the admin_audit_logs table to track administrative operations
-- Created: 2026-06-22

CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `operator_id` BIGINT UNSIGNED NOT NULL,
    `operator_name` VARCHAR(128) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `target_type` VARCHAR(32) NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `idx_operator_id` (`operator_id`),
    INDEX `idx_target_type` (`target_type`),
    INDEX `idx_target_id` (`target_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
