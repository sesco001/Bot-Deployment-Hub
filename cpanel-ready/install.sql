-- MaKames Digital Business Center - MySQL Schema
-- Run this in your cPanel phpMyAdmin or MySQL console
-- Create these tables in your database before uploading the PHP files

CREATE TABLE IF NOT EXISTS `users` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `username`            VARCHAR(100) NOT NULL UNIQUE,
  `email`               VARCHAR(255) NOT NULL UNIQUE,
  `password_hash`       VARCHAR(255) NOT NULL,
  `referral_code`       VARCHAR(20)  NOT NULL UNIQUE,
  `referred_by`         INT DEFAULT NULL,
  `free_deploy_days_left` INT NOT NULL DEFAULT 0,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wallets` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL UNIQUE,
  `balance_md`  INT NOT NULL DEFAULT 0,
  `balance_kes` INT NOT NULL DEFAULT 0,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `type`        ENUM('topup','deduction','refund','bonus') NOT NULL,
  `amount_md`   INT NOT NULL,
  `description` TEXT NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bot_deployments` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`           INT NOT NULL,
  `bot_type_id`       VARCHAR(50) NOT NULL,
  `bot_name`          VARCHAR(100) NOT NULL,
  `status`            ENUM('running','stopped','error','pending') NOT NULL DEFAULT 'pending',
  `api_key`           TEXT DEFAULT NULL,
  `config`            TEXT DEFAULT NULL,
  `is_free_deployment` TINYINT(1) NOT NULL DEFAULT 0,
  `deployed_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`        DATETIME DEFAULT NULL,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `referrals` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `referrer_id`      INT NOT NULL,
  `referred_user_id` INT NOT NULL UNIQUE,
  `joined_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (`referrer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
