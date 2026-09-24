-- A identidade do produto não recebe preço. Descrição e referência conhecidas
-- podem evoluir, enquanto cada price_list_item permanece como fotografia.
ALTER TABLE `products`
  ADD COLUMN `reference` VARCHAR(120) NULL,
  MODIFY `unit` VARCHAR(30) NULL;

-- Cria identidades para versões avulsas que já existam no momento do corte.
-- O segundo comando aplica descrição e referência da aparição mais recente;
-- nenhum preço é copiado para products.
INSERT INTO `products` (
  `id`, `code`, `description`, `reference`, `unit`, `first_seen_at`, `last_seen_at`
)
SELECT
  UUID(),
  `item`.`product_code`,
  COALESCE(NULLIF(MAX(`item`.`description`), ''), `item`.`product_code`),
  NULLIF(MAX(`item`.`reference`), ''),
  NULL,
  MIN(`version`.`created_at`),
  MAX(`version`.`created_at`)
FROM `price_list_items` AS `item`
INNER JOIN `price_list_versions` AS `version`
  ON `version`.`id` = `item`.`price_list_version_id`
INNER JOIN `price_lists` AS `list`
  ON `list`.`id` = `version`.`price_list_id`
WHERE `list`.`type` = 'STANDALONE_PRODUCT'
GROUP BY `item`.`product_code`
ON DUPLICATE KEY UPDATE
  `last_seen_at` = GREATEST(`products`.`last_seen_at`, VALUES(`last_seen_at`));

UPDATE `products` AS `product`
INNER JOIN (
  SELECT
    `item`.`product_code`,
    `item`.`description`,
    `item`.`reference`,
    `version`.`created_at`
  FROM `price_list_items` AS `item`
  INNER JOIN `price_list_versions` AS `version`
    ON `version`.`id` = `item`.`price_list_version_id`
  INNER JOIN `price_lists` AS `list`
    ON `list`.`id` = `version`.`price_list_id`
  WHERE `list`.`type` = 'STANDALONE_PRODUCT'
    AND NOT EXISTS (
      SELECT 1
      FROM `price_list_items` AS `newer_item`
      INNER JOIN `price_list_versions` AS `newer_version`
        ON `newer_version`.`id` = `newer_item`.`price_list_version_id`
      INNER JOIN `price_lists` AS `newer_list`
        ON `newer_list`.`id` = `newer_version`.`price_list_id`
      WHERE `newer_list`.`type` = 'STANDALONE_PRODUCT'
        AND `newer_item`.`product_code` = `item`.`product_code`
        AND (
          `newer_version`.`created_at` > `version`.`created_at`
          OR (
            `newer_version`.`created_at` = `version`.`created_at`
            AND `newer_version`.`id` > `version`.`id`
          )
        )
    )
) AS `latest`
  ON `latest`.`product_code` = `product`.`code`
SET
  `product`.`description` = COALESCE(NULLIF(`latest`.`description`, ''), `product`.`code`),
  `product`.`reference` = NULLIF(`latest`.`reference`, ''),
  `product`.`last_seen_at` = GREATEST(`product`.`last_seen_at`, `latest`.`created_at`);

CREATE INDEX `price_list_items_description_idx` ON `price_list_items` (`description`);
CREATE INDEX `price_list_items_reference_idx` ON `price_list_items` (`reference`);
