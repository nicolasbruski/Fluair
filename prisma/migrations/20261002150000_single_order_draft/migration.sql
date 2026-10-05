-- Um unico pedido em andamento salvo por usuario. A troca de cliente substitui esse slot.
CREATE TABLE `order_drafts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `payload` JSON NOT NULL,
  `revision` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `order_drafts_user_id_key` (`user_id`),
  INDEX `order_drafts_customer_id_idx` (`customer_id`),
  INDEX `order_drafts_updated_at_idx` (`updated_at`),
  CONSTRAINT `order_drafts_revision_check` CHECK (`revision` > 0),
  CONSTRAINT `order_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `order_drafts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
