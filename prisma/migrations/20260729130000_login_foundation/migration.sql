-- Fundação de autenticação, autorização, sessão persistente e auditoria.
CREATE TABLE `roles` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `roles_code_key` (`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `permissions_code_key` (`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` CHAR(36) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key` (`email`),
  INDEX `users_role_id_idx` (`role_id`),
  INDEX `users_active_idx` (`active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
  `role_id` CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  INDEX `role_permissions_permission_id_idx` (`permission_id`),
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_permission_overrides` (
  `user_id` CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  `allowed` BOOLEAN NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `user_permission_overrides_permission_id_idx` (`permission_id`),
  PRIMARY KEY (`user_id`, `permission_id`),
  CONSTRAINT `user_permission_overrides_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_permission_overrides_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` CHAR(64) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `ip_hash` CHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `sessions_user_id_expires_at_idx` (`user_id`, `expires_at`),
  INDEX `sessions_expires_at_revoked_at_idx` (`expires_at`, `revoked_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `login_throttles` (
  `key` CHAR(64) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `window_started_at` DATETIME(3) NOT NULL,
  `blocked_until` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `login_throttles_updated_at_idx` (`updated_at`),
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `actor_user_id` CHAR(36) NULL,
  `action` VARCHAR(80) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` VARCHAR(100) NULL,
  `metadata` JSON NULL,
  `request_id` VARCHAR(80) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `audit_logs_actor_user_id_created_at_idx` (`actor_user_id`, `created_at`),
  INDEX `audit_logs_action_created_at_idx` (`action`, `created_at`),
  INDEX `audit_logs_request_id_idx` (`request_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
