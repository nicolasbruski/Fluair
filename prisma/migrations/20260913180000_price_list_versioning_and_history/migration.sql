-- Expansão aditiva do versionamento geral. UUIDs e fotografias do legado são
-- copiados sem transformação; as tabelas e FKs antigas permanecem disponíveis.
CREATE TABLE `price_list_versions` (
  `id` CHAR(36) NOT NULL,
  `price_list_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `file_hash` CHAR(64) NOT NULL,
  `source_file` LONGBLOB NOT NULL,
  `item_count` INTEGER NOT NULL,
  `imported_by_user_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `price_list_versions_price_list_id_version_key` (`price_list_id`, `version`),
  UNIQUE INDEX `price_list_versions_price_list_id_file_hash_key` (`price_list_id`, `file_hash`),
  INDEX `price_list_versions_price_list_id_created_at_idx` (`price_list_id`, `created_at`),
  INDEX `price_list_versions_imported_by_user_id_idx` (`imported_by_user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_list_items` (
  `id` CHAR(36) NOT NULL,
  `price_list_version_id` CHAR(36) NOT NULL,
  `product_code` VARCHAR(32) NOT NULL,
  `description` VARCHAR(255) NULL,
  `minimum_price` DECIMAL(15,4) NULL,
  `normal_price` DECIMAL(15,4) NULL,
  `reference` VARCHAR(120) NULL,
  `unit_price` DECIMAL(15,4) NULL,
  `ipi_rate` DECIMAL(7,4) NULL,
  `ipi_included` BOOLEAN NULL,
  `source_row` INTEGER NOT NULL,
  `raw_data` JSON NULL,

  CONSTRAINT `price_list_items_price_shape_check`
    CHECK (
      (`minimum_price` IS NOT NULL AND `normal_price` IS NOT NULL AND `unit_price` IS NULL AND `ipi_rate` IS NULL AND `ipi_included` IS NULL)
      OR
      (`minimum_price` IS NULL AND `normal_price` IS NULL AND `unit_price` IS NOT NULL AND `ipi_included` = true)
    ),
  CONSTRAINT `price_list_items_nonnegative_prices_check`
    CHECK (
      (`minimum_price` IS NULL OR `minimum_price` >= 0)
      AND (`normal_price` IS NULL OR `normal_price` >= 0)
      AND (`unit_price` IS NULL OR `unit_price` >= 0)
      AND (`ipi_rate` IS NULL OR `ipi_rate` >= 0)
    ),
  UNIQUE INDEX `price_list_items_price_list_version_id_product_code_key` (`price_list_version_id`, `product_code`),
  INDEX `price_list_items_product_code_idx` (`product_code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kit_calculation_series` (
  `id` CHAR(36) NOT NULL,
  `kit_id` CHAR(36) NOT NULL,
  `price_list_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `kit_calculation_series_kit_id_price_list_id_key` (`kit_id`, `price_list_id`),
  INDEX `kit_calculation_series_price_list_id_idx` (`price_list_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `price_list_versions`
  ADD CONSTRAINT `price_list_versions_price_list_id_fkey`
    FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `price_list_versions_imported_by_user_id_fkey`
    FOREIGN KEY (`imported_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `price_list_items`
  ADD CONSTRAINT `price_list_items_price_list_version_id_fkey`
    FOREIGN KEY (`price_list_version_id`) REFERENCES `price_list_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `kit_calculation_series`
  ADD CONSTRAINT `kit_calculation_series_kit_id_fkey`
    FOREIGN KEY (`kit_id`) REFERENCES `kits`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `kit_calculation_series_price_list_id_fkey`
    FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada perfil legado se torna uma lista de componentes com o mesmo UUID.
INSERT INTO `price_lists` (
  `id`, `code`, `name`, `type`, `active`, `minimum_order_quantity`,
  `maximum_order_quantity`, `active_version_id`, `created_at`, `updated_at`
)
SELECT
  `id`, `code`, `name`, 'KIT_COMPONENT', true, NULL, NULL, NULL, `created_at`, `updated_at`
FROM `price_profiles`;

INSERT INTO `price_list_versions` (
  `id`, `price_list_id`, `version`, `file_name`, `mime_type`, `file_size`,
  `file_hash`, `source_file`, `item_count`, `imported_by_user_id`, `created_at`
)
SELECT
  `id`, `profile_id`, `version`, `file_name`, `mime_type`, `file_size`,
  `file_hash`, `source_file`, `item_count`, `imported_by_user_id`, `created_at`
FROM `price_matrix_versions`;

INSERT INTO `price_list_items` (
  `id`, `price_list_version_id`, `product_code`, `description`, `minimum_price`,
  `normal_price`, `reference`, `unit_price`, `ipi_rate`, `ipi_included`, `source_row`, `raw_data`
)
SELECT
  `id`, `matrix_version_id`, `product_code`, NULL, `minimum_price`,
  `normal_price`, NULL, NULL, NULL, NULL, `source_row`, `raw_data`
FROM `price_matrix_items`;

INSERT INTO `kit_calculation_series` (
  `id`, `kit_id`, `price_list_id`, `created_at`, `updated_at`
)
SELECT `id`, `kit_id`, `profile_id`, `created_at`, `updated_at`
FROM `kit_price_lists`;

UPDATE `price_lists` AS `list`
INNER JOIN `price_profiles` AS `profile` ON `profile`.`id` = `list`.`id`
SET `list`.`active_version_id` = `profile`.`active_matrix_version_id`;

ALTER TABLE `price_lists`
  ADD CONSTRAINT `price_lists_active_version_id_fkey`
    FOREIGN KEY (`active_version_id`) REFERENCES `price_list_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `calculation_versions`
  ADD COLUMN `kit_calculation_series_id` CHAR(36) NULL,
  ADD COLUMN `price_list_version_id` CHAR(36) NULL;

UPDATE `calculation_versions`
SET
  `kit_calculation_series_id` = `price_list_id`,
  `price_list_version_id` = `matrix_version_id`;

-- Mapeamentos inequívocos apenas. EXPORT não recebe preço ou versão inventados.
INSERT INTO `price_list_classes` (`price_list_id`, `customer_class_id`, `created_at`)
SELECT `list`.`id`, `class`.`id`, CURRENT_TIMESTAMP(3)
FROM `price_lists` AS `list`
INNER JOIN `customer_classes` AS `class`
  ON `class`.`code` = CASE `list`.`code`
    WHEN 'IMPLEMENTER' THEN 'IMPLEMENTER'
    WHEN 'TRADE_REPLACEMENT' THEN 'RESELLER'
    WHEN 'END_CONSUMER' THEN 'END_CONSUMER'
  END
WHERE `list`.`type` = 'KIT_COMPONENT'
ON DUPLICATE KEY UPDATE `price_list_id` = VALUES(`price_list_id`);

-- Faz a migração falhar antes do corte se qualquer fotografia ou vínculo divergir.
CREATE TEMPORARY TABLE `_price_list_history_guard` (
  `violations` INTEGER NOT NULL,
  CONSTRAINT `_price_list_history_guard_zero_check` CHECK (`violations` = 0)
);

INSERT INTO `_price_list_history_guard` (`violations`)
SELECT
  (SELECT COUNT(*) FROM `price_profiles` AS `old` LEFT JOIN `price_lists` AS `new` ON `new`.`id` = `old`.`id` WHERE `new`.`id` IS NULL OR `new`.`type` <> 'KIT_COMPONENT')
  + (SELECT COUNT(*) FROM `price_matrix_versions` AS `old` LEFT JOIN `price_list_versions` AS `new` ON `new`.`id` = `old`.`id` WHERE `new`.`id` IS NULL OR `new`.`price_list_id` <> `old`.`profile_id` OR `new`.`version` <> `old`.`version` OR `new`.`file_hash` <> `old`.`file_hash` OR `new`.`source_file` <> `old`.`source_file` OR `new`.`item_count` <> `old`.`item_count`)
  + (SELECT COUNT(*) FROM `price_matrix_items` AS `old` LEFT JOIN `price_list_items` AS `new` ON `new`.`id` = `old`.`id` WHERE `new`.`id` IS NULL OR `new`.`price_list_version_id` <> `old`.`matrix_version_id` OR `new`.`minimum_price` <> `old`.`minimum_price` OR `new`.`normal_price` <> `old`.`normal_price` OR `new`.`source_row` <> `old`.`source_row` OR NOT (`new`.`raw_data` <=> `old`.`raw_data`))
  + (SELECT COUNT(*) FROM `price_matrix_versions` AS `version` LEFT JOIN (SELECT `matrix_version_id`, COUNT(*) AS `actual_count` FROM `price_matrix_items` GROUP BY `matrix_version_id`) AS `items` ON `items`.`matrix_version_id` = `version`.`id` WHERE `version`.`item_count` <> COALESCE(`items`.`actual_count`, 0))
  + (SELECT COUNT(*) FROM `price_profiles` AS `profile` INNER JOIN `price_lists` AS `list` ON `list`.`id` = `profile`.`id` WHERE NOT (`list`.`active_version_id` <=> `profile`.`active_matrix_version_id`))
  + (SELECT COUNT(*) FROM `kit_price_lists` AS `old` LEFT JOIN `kit_calculation_series` AS `new` ON `new`.`id` = `old`.`id` WHERE `new`.`id` IS NULL OR `new`.`kit_id` <> `old`.`kit_id` OR `new`.`price_list_id` <> `old`.`profile_id`)
  + (SELECT COUNT(*) FROM `calculation_versions` AS `calculation` LEFT JOIN `kit_calculation_series` AS `series` ON `series`.`id` = `calculation`.`kit_calculation_series_id` LEFT JOIN `price_list_versions` AS `version` ON `version`.`id` = `calculation`.`price_list_version_id` WHERE `series`.`id` IS NULL OR `version`.`id` IS NULL OR `series`.`price_list_id` <> `version`.`price_list_id` OR `calculation`.`kit_calculation_series_id` <> `calculation`.`price_list_id` OR `calculation`.`price_list_version_id` <> `calculation`.`matrix_version_id`);

DROP TEMPORARY TABLE `_price_list_history_guard`;

ALTER TABLE `calculation_versions`
  MODIFY `kit_calculation_series_id` CHAR(36) NOT NULL,
  MODIFY `price_list_version_id` CHAR(36) NOT NULL,
  ADD INDEX `calculation_versions_kit_calculation_series_id_idx` (`kit_calculation_series_id`),
  ADD INDEX `calculation_versions_price_list_version_id_idx` (`price_list_version_id`),
  ADD CONSTRAINT `calculation_versions_kit_calculation_series_id_fkey`
    FOREIGN KEY (`kit_calculation_series_id`) REFERENCES `kit_calculation_series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `calculation_versions_price_list_version_id_fkey`
    FOREIGN KEY (`price_list_version_id`) REFERENCES `price_list_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
