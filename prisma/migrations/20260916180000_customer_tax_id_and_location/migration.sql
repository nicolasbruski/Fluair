ALTER TABLE `customers`
  ADD COLUMN `cnpj` CHAR(14) NULL AFTER `legal_name`,
  ADD COLUMN `city` VARCHAR(120) NULL AFTER `cnpj`,
  ADD COLUMN `state` CHAR(2) NULL AFTER `city`;

CREATE INDEX `customers_cnpj_idx` ON `customers`(`cnpj`);
