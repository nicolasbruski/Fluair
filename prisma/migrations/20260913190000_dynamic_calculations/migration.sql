-- As novas listas passam a ser a autoridade do cÃ¡lculo. As colunas legadas
-- permanecem preenchidas quando houver espelho antigo, mas deixam de bloquear
-- listas criadas depois da migraÃ§Ã£o.
ALTER TABLE `calculation_versions`
  MODIFY `price_list_id` CHAR(36) NULL,
  MODIFY `matrix_version_id` CHAR(36) NULL,
  ADD UNIQUE INDEX `calculation_versions_kit_calculation_series_id_version_key`
    (`kit_calculation_series_id`, `version`);

ALTER TABLE `calculation_customers`
  ADD COLUMN `customer_code_snapshot` VARCHAR(20) NULL,
  ADD COLUMN `customer_name_snapshot` VARCHAR(180) NULL,
  ADD COLUMN `class_id_snapshot` CHAR(36) NULL,
  ADD COLUMN `class_code_snapshot` VARCHAR(64) NULL,
  ADD COLUMN `class_name_snapshot` VARCHAR(100) NULL;

-- Registros anteriores recebem a melhor fotografia disponÃ­vel no momento do
-- corte. Todo novo vÃ­nculo grava esses campos no instante do salvamento.
UPDATE `calculation_customers` AS `link`
INNER JOIN `customers` AS `customer` ON `customer`.`id` = `link`.`customer_id`
LEFT JOIN `customer_classes` AS `class` ON `class`.`id` = `customer`.`customer_class_id`
SET
  `link`.`customer_code_snapshot` = `customer`.`code`,
  `link`.`customer_name_snapshot` = `customer`.`legal_name`,
  `link`.`class_id_snapshot` = `class`.`id`,
  `link`.`class_code_snapshot` = `class`.`code`,
  `link`.`class_name_snapshot` = `class`.`name`;
