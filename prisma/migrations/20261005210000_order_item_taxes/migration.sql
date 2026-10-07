-- Tax rates belong to the immutable price-list version. Order and approval
-- rows snapshot both the selection and the calculated amounts.
ALTER TABLE `price_list_items`
  DROP CHECK `price_list_items_price_shape_check`;

ALTER TABLE `price_list_items`
  ADD COLUMN `pis_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN `cofins_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
  ADD CONSTRAINT `price_list_items_pis_rate_check` CHECK (`pis_rate` >= 0 AND `pis_rate` <= 100),
  ADD CONSTRAINT `price_list_items_cofins_rate_check` CHECK (`cofins_rate` >= 0 AND `cofins_rate` <= 100);

ALTER TABLE `price_list_items`
  ADD CONSTRAINT `price_list_items_price_shape_check`
    CHECK (
      (`minimum_price` IS NOT NULL AND `normal_price` IS NOT NULL AND `unit_price` IS NULL AND `ipi_rate` IS NULL AND `ipi_included` IS NULL)
      OR
      (`minimum_price` IS NULL AND `normal_price` IS NULL AND `unit_price` IS NOT NULL AND `ipi_rate` IS NOT NULL AND `ipi_included` IS NOT NULL)
    );

-- Standalone list values are base prices. Taxes are only added when selected
-- on the order item. Older versions used this flag only because the former
-- order flow assumed IPI was already part of every imported value.
UPDATE `price_list_items`
SET `ipi_included` = false
WHERE `unit_price` IS NOT NULL;

ALTER TABLE `order_price_approval_items`
  ADD COLUMN `pis_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `pis_rate` DECIMAL(7, 4) NULL,
  ADD COLUMN `pis_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `cofins_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `cofins_rate` DECIMAL(7, 4) NULL,
  ADD COLUMN `cofins_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `icms_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `icms_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `ipi_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `ipi_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `total_tax_unit_amount` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN `final_unit_price` DECIMAL(15, 4) NULL;

UPDATE `order_price_approval_items`
SET `final_unit_price` = `negotiated_unit_price`
WHERE `final_unit_price` IS NULL;

ALTER TABLE `order_price_approval_items`
  MODIFY COLUMN `final_unit_price` DECIMAL(15, 4) NOT NULL;

ALTER TABLE `order_items`
  ADD COLUMN `pis_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `pis_rate` DECIMAL(7, 4) NULL,
  ADD COLUMN `pis_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `cofins_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `cofins_rate` DECIMAL(7, 4) NULL,
  ADD COLUMN `cofins_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `icms_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `icms_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `ipi_selected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `ipi_unit_amount` DECIMAL(15, 4) NULL,
  ADD COLUMN `total_tax_unit_amount` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN `final_unit_price` DECIMAL(15, 4) NULL;

UPDATE `order_items`
SET `final_unit_price` = `negotiated_unit_price`
WHERE `final_unit_price` IS NULL;

ALTER TABLE `order_items`
  MODIFY COLUMN `final_unit_price` DECIMAL(15, 4) NOT NULL;
