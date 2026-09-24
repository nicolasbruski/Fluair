-- As edições do catálogo não alteram a fotografia histórica dos cálculos.
-- Os campos opcionais são sobrescritas comerciais usadas somente no catálogo e na cotação.
ALTER TABLE `calculation_versions`
  ADD COLUMN `catalog_description` VARCHAR(255) NULL,
  ADD COLUMN `catalog_minimum_price` DECIMAL(15, 4) NULL,
  ADD COLUMN `catalog_normal_price` DECIMAL(15, 4) NULL,
  ADD COLUMN `catalog_visible` BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE `calculation_items`
  ADD COLUMN `catalog_description` VARCHAR(255) NULL,
  ADD COLUMN `catalog_minimum_price` DECIMAL(15, 4) NULL,
  ADD COLUMN `catalog_normal_price` DECIMAL(15, 4) NULL,
  ADD COLUMN `catalog_visible` BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX `calculation_versions_catalog_visible_idx`
  ON `calculation_versions` (`catalog_visible`);

CREATE INDEX `calculation_items_catalog_visible_idx`
  ON `calculation_items` (`catalog_visible`);
