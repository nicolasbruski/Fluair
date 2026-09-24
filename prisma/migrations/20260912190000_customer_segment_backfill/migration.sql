-- Normaliza somente os sete valores legados conhecidos. Clientes sem segmento
-- permanecem sem classificação e nenhum vínculo já preenchido é sobrescrito.
INSERT INTO `customer_segments` (`id`, `code`, `name`, `active`, `created_at`, `updated_at`) VALUES
  (UUID(), 'AUTO_PARTS', 'Autopeças', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'AUTHORIZED', 'Autorizada', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'END_CONSUMER', 'Consumidor Final', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'DISTRIBUTOR', 'Distribuidor', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'FLEET_OWNER', 'Frotista', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'IMPLEMENTER', 'Implementador', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'SERVICE_STATION', 'Posto de Serviço', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `active` = true,
  `updated_at` = CURRENT_TIMESTAMP(3);

UPDATE `customers` AS `customer`
INNER JOIN `customer_segments` AS `normalized_segment`
  ON `normalized_segment`.`code` = CASE `customer`.`segment`
    WHEN 'AUTO-PECAS' THEN 'AUTO_PARTS'
    WHEN 'AUTORIZADA' THEN 'AUTHORIZED'
    WHEN 'CONSUMIDOR FINAL' THEN 'END_CONSUMER'
    WHEN 'DISTRIBUIDOR' THEN 'DISTRIBUTOR'
    WHEN 'FROTISTA' THEN 'FLEET_OWNER'
    WHEN 'IMPLEMENTADOR' THEN 'IMPLEMENTER'
    WHEN 'POSTO DE SERVICO' THEN 'SERVICE_STATION'
  END
SET `customer`.`customer_segment_id` = `normalized_segment`.`id`
WHERE `customer`.`customer_segment_id` IS NULL
  AND `customer`.`segment` IS NOT NULL;
