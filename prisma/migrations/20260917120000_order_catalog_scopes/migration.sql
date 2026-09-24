-- Kits calculados continuam exclusivos do cliente por padrão. Um administrador pode
-- promovê-los a padrão sem alterar a fotografia ou os vínculos históricos do cálculo.
ALTER TABLE `calculation_versions`
  ADD COLUMN `catalog_scope` ENUM('CUSTOMER_SPECIFIC', 'STANDARD')
  NOT NULL DEFAULT 'CUSTOMER_SPECIFIC';

CREATE INDEX `calculation_versions_catalog_scope_catalog_visible_idx`
  ON `calculation_versions` (`catalog_scope`, `catalog_visible`);
