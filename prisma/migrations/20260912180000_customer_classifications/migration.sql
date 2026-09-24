-- Estruturas normalizadas de classe e segmento. O campo textual customers.segment
-- permanece disponível durante a transição.
CREATE TABLE `customer_classes` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customer_classes_code_key` (`code`),
  INDEX `customer_classes_active_name_idx` (`active`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_segments` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customer_segments_code_key` (`code`),
  INDEX `customer_segments_active_name_idx` (`active`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customers`
  ADD COLUMN `customer_class_id` CHAR(36) NULL,
  ADD COLUMN `customer_segment_id` CHAR(36) NULL,
  ADD INDEX `customers_customer_class_id_idx` (`customer_class_id`),
  ADD INDEX `customers_customer_segment_id_idx` (`customer_segment_id`),
  ADD CONSTRAINT `customers_customer_class_id_fkey`
    FOREIGN KEY (`customer_class_id`) REFERENCES `customer_classes`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customers_customer_segment_id_fkey`
    FOREIGN KEY (`customer_segment_id`) REFERENCES `customer_segments`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
