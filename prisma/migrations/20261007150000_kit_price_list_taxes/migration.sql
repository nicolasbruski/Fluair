-- Structured-list taxes are stored on every immutable component row. The
-- importer guarantees that all rows in one version use the same rates.
ALTER TABLE `price_list_items`
  DROP CHECK `price_list_items_price_shape_check`;

UPDATE `price_list_items`
SET `ipi_rate` = 0.0000,
    `ipi_included` = false
WHERE `minimum_price` IS NOT NULL
  AND `normal_price` IS NOT NULL
  AND `ipi_rate` IS NULL;

ALTER TABLE `price_list_items`
  ADD CONSTRAINT `price_list_items_price_shape_check`
    CHECK (
      (`minimum_price` IS NOT NULL AND `normal_price` IS NOT NULL AND `unit_price` IS NULL AND `ipi_rate` IS NOT NULL AND `ipi_included` = false)
      OR
      (`minimum_price` IS NULL AND `normal_price` IS NULL AND `unit_price` IS NOT NULL AND `ipi_rate` IS NOT NULL AND `ipi_included` IS NOT NULL)
    );
