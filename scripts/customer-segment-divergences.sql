-- Resumo de reconciliação após a migração de segmentos.
SELECT
  COUNT(*) AS `total_customers`,
  SUM(CASE WHEN `customer_segment_id` IS NOT NULL THEN 1 ELSE 0 END) AS `classified_customers`,
  SUM(CASE WHEN `segment` IS NULL AND `customer_segment_id` IS NULL THEN 1 ELSE 0 END) AS `unclassified_customers`
FROM `customers`;

-- O resultado esperado desta consulta é vazio. Cada linha retornada exige
-- revisão manual; a consulta não altera nem tenta reparar dados.
WITH `legacy_segment_mapping` AS (
  SELECT 'AUTO-PECAS' AS `legacy_value`, 'AUTO_PARTS' AS `normalized_code`
  UNION ALL SELECT 'AUTORIZADA', 'AUTHORIZED'
  UNION ALL SELECT 'CONSUMIDOR FINAL', 'END_CONSUMER'
  UNION ALL SELECT 'DISTRIBUIDOR', 'DISTRIBUTOR'
  UNION ALL SELECT 'FROTISTA', 'FLEET_OWNER'
  UNION ALL SELECT 'IMPLEMENTADOR', 'IMPLEMENTER'
  UNION ALL SELECT 'POSTO DE SERVICO', 'SERVICE_STATION'
)
SELECT
  `customer`.`id`,
  `customer`.`code`,
  `customer`.`segment` AS `legacy_segment`,
  `normalized_segment`.`code` AS `normalized_segment_code`,
  CASE
    WHEN `mapping`.`normalized_code` IS NULL THEN 'UNMAPPED_LEGACY_SEGMENT'
    WHEN `customer`.`customer_segment_id` IS NULL THEN 'NORMALIZED_SEGMENT_MISSING'
    WHEN `normalized_segment`.`code` <> `mapping`.`normalized_code` THEN 'NORMALIZED_SEGMENT_MISMATCH'
  END AS `divergence`
FROM `customers` AS `customer`
LEFT JOIN `legacy_segment_mapping` AS `mapping`
  ON `mapping`.`legacy_value` = `customer`.`segment`
LEFT JOIN `customer_segments` AS `normalized_segment`
  ON `normalized_segment`.`id` = `customer`.`customer_segment_id`
WHERE `customer`.`segment` IS NOT NULL
  AND (
    `mapping`.`normalized_code` IS NULL
    OR `customer`.`customer_segment_id` IS NULL
    OR `normalized_segment`.`code` <> `mapping`.`normalized_code`
  )
UNION ALL
SELECT
  `customer`.`id`,
  `customer`.`code`,
  `customer`.`segment` AS `legacy_segment`,
  `normalized_segment`.`code` AS `normalized_segment_code`,
  'UNEXPECTED_CLASSIFICATION_WITHOUT_LEGACY_SEGMENT' AS `divergence`
FROM `customers` AS `customer`
INNER JOIN `customer_segments` AS `normalized_segment`
  ON `normalized_segment`.`id` = `customer`.`customer_segment_id`
WHERE `customer`.`segment` IS NULL;
