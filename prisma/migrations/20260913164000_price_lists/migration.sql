-- Definição geral e aditiva de listas de preço. As tabelas legadas permanecem
-- intactas e serão copiadas somente na etapa de migração histórica.
CREATE TABLE `price_lists` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('KIT_COMPONENT', 'STANDALONE_PRODUCT') NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `minimum_order_quantity` INTEGER NULL,
  `maximum_order_quantity` INTEGER NULL,
  `active_version_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  CONSTRAINT `price_lists_minimum_order_quantity_check`
    CHECK (`minimum_order_quantity` IS NULL OR `minimum_order_quantity` >= 0),
  CONSTRAINT `price_lists_maximum_order_quantity_check`
    CHECK (`maximum_order_quantity` IS NULL OR `maximum_order_quantity` >= 0),
  CONSTRAINT `price_lists_order_quantity_range_check`
    CHECK (
      `minimum_order_quantity` IS NULL
      OR `maximum_order_quantity` IS NULL
      OR `minimum_order_quantity` <= `maximum_order_quantity`
    ),
  UNIQUE INDEX `price_lists_code_key` (`code`),
  UNIQUE INDEX `price_lists_active_version_id_key` (`active_version_id`),
  INDEX `price_lists_type_active_idx` (`type`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- A FK de active_version_id será adicionada junto de price_list_versions.
-- Manter a coluna anulável permite listas ainda sem versão ativa.
