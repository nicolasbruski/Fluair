CREATE TABLE `price_profiles` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `active_matrix_version_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `price_profiles_code_key` (`code`),
  UNIQUE INDEX `price_profiles_active_matrix_version_id_key` (`active_matrix_version_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_matrix_versions` (
  `id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `file_hash` CHAR(64) NOT NULL,
  `source_file` LONGBLOB NOT NULL,
  `item_count` INTEGER NOT NULL,
  `imported_by_user_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `price_matrix_versions_profile_id_version_key` (`profile_id`, `version`),
  UNIQUE INDEX `price_matrix_versions_profile_id_file_hash_key` (`profile_id`, `file_hash`),
  INDEX `price_matrix_versions_profile_id_created_at_idx` (`profile_id`, `created_at`),
  INDEX `price_matrix_versions_imported_by_user_id_idx` (`imported_by_user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_matrix_items` (
  `id` CHAR(36) NOT NULL,
  `matrix_version_id` CHAR(36) NOT NULL,
  `product_code` VARCHAR(32) NOT NULL,
  `minimum_price` DECIMAL(15,4) NOT NULL,
  `normal_price` DECIMAL(15,4) NOT NULL,
  `source_row` INTEGER NOT NULL,
  `raw_data` JSON NULL,
  UNIQUE INDEX `price_matrix_items_matrix_version_id_product_code_key` (`matrix_version_id`, `product_code`),
  INDEX `price_matrix_items_product_code_idx` (`product_code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `unit` VARCHAR(30) NOT NULL,
  `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `products_code_key` (`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kits` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `kits_code_key` (`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kit_price_lists` (
  `id` CHAR(36) NOT NULL,
  `kit_id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `kit_price_lists_kit_id_profile_id_key` (`kit_id`, `profile_id`),
  INDEX `kit_price_lists_profile_id_idx` (`profile_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `calculation_versions` (
  `id` CHAR(36) NOT NULL,
  `price_list_id` CHAR(36) NOT NULL,
  `matrix_version_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `current` BOOLEAN NOT NULL DEFAULT true,
  `kit_description` VARCHAR(255) NOT NULL,
  `source_file_name` VARCHAR(255) NOT NULL,
  `source_file_size` INTEGER NOT NULL,
  `source_file_hash` CHAR(64) NOT NULL,
  `minimum_total` DECIMAL(15,4) NOT NULL,
  `normal_total` DECIMAL(15,4) NOT NULL,
  `item_count` INTEGER NOT NULL,
  `missing_price_count` INTEGER NOT NULL,
  `origin` VARCHAR(40) NOT NULL,
  `created_by_user_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `calculation_versions_price_list_id_version_key` (`price_list_id`, `version`),
  INDEX `calculation_versions_price_list_id_current_idx` (`price_list_id`, `current`),
  INDEX `calculation_versions_matrix_version_id_idx` (`matrix_version_id`),
  INDEX `calculation_versions_created_by_user_id_created_at_idx` (`created_by_user_id`, `created_at`),
  INDEX `calculation_versions_source_file_hash_idx` (`source_file_hash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `calculation_items` (
  `id` CHAR(36) NOT NULL,
  `calculation_version_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `line_number` INTEGER NOT NULL,
  `operation` VARCHAR(30) NOT NULL,
  `condition` VARCHAR(30) NOT NULL,
  `product_code` VARCHAR(32) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(15,4) NOT NULL,
  `unit` VARCHAR(30) NOT NULL,
  `minimum_unit_price` DECIMAL(15,4) NOT NULL,
  `normal_unit_price` DECIMAL(15,4) NOT NULL,
  `minimum_total` DECIMAL(15,4) NOT NULL,
  `normal_total` DECIMAL(15,4) NOT NULL,
  `has_price` BOOLEAN NOT NULL,
  UNIQUE INDEX `calculation_items_calculation_version_id_line_number_key` (`calculation_version_id`, `line_number`),
  INDEX `calculation_items_product_id_idx` (`product_id`),
  INDEX `calculation_items_product_code_idx` (`product_code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `calculation_customers` (
  `calculation_version_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `linked_by_user_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `calculation_customers_customer_id_idx` (`customer_id`),
  INDEX `calculation_customers_linked_by_user_id_idx` (`linked_by_user_id`),
  PRIMARY KEY (`calculation_version_id`, `customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `price_matrix_versions` ADD CONSTRAINT `price_matrix_versions_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `price_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `price_matrix_versions` ADD CONSTRAINT `price_matrix_versions_imported_by_user_id_fkey` FOREIGN KEY (`imported_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `price_profiles` ADD CONSTRAINT `price_profiles_active_matrix_version_id_fkey` FOREIGN KEY (`active_matrix_version_id`) REFERENCES `price_matrix_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `price_matrix_items` ADD CONSTRAINT `price_matrix_items_matrix_version_id_fkey` FOREIGN KEY (`matrix_version_id`) REFERENCES `price_matrix_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `kit_price_lists` ADD CONSTRAINT `kit_price_lists_kit_id_fkey` FOREIGN KEY (`kit_id`) REFERENCES `kits`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `kit_price_lists` ADD CONSTRAINT `kit_price_lists_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `price_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calculation_versions` ADD CONSTRAINT `calculation_versions_price_list_id_fkey` FOREIGN KEY (`price_list_id`) REFERENCES `kit_price_lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calculation_versions` ADD CONSTRAINT `calculation_versions_matrix_version_id_fkey` FOREIGN KEY (`matrix_version_id`) REFERENCES `price_matrix_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calculation_versions` ADD CONSTRAINT `calculation_versions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calculation_items` ADD CONSTRAINT `calculation_items_calculation_version_id_fkey` FOREIGN KEY (`calculation_version_id`) REFERENCES `calculation_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `calculation_items` ADD CONSTRAINT `calculation_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calculation_customers` ADD CONSTRAINT `calculation_customers_calculation_version_id_fkey` FOREIGN KEY (`calculation_version_id`) REFERENCES `calculation_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `calculation_customers` ADD CONSTRAINT `calculation_customers_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calculation_customers` ADD CONSTRAINT `calculation_customers_linked_by_user_id_fkey` FOREIGN KEY (`linked_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
