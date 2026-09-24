-- Relatório somente leitura para o ensaio/corte da migração de listas.
-- Qualquer linha retornada deve ser investigada manualmente.
SELECT 'PROFILE_WITHOUT_EQUIVALENT_LIST' AS `divergence`, `old`.`id` AS `entity_id`
FROM `price_profiles` AS `old`
LEFT JOIN `price_lists` AS `new` ON `new`.`id` = `old`.`id`
WHERE `new`.`id` IS NULL OR `new`.`type` <> 'KIT_COMPONENT'

UNION ALL

SELECT 'VERSION_SNAPSHOT_MISMATCH', `old`.`id`
FROM `price_matrix_versions` AS `old`
LEFT JOIN `price_list_versions` AS `new` ON `new`.`id` = `old`.`id`
WHERE `new`.`id` IS NULL
   OR NOT (`new`.`price_list_id` <=> `old`.`profile_id`)
   OR NOT (`new`.`version` <=> `old`.`version`)
   OR NOT (`new`.`file_name` <=> `old`.`file_name`)
   OR NOT (`new`.`mime_type` <=> `old`.`mime_type`)
   OR NOT (`new`.`file_size` <=> `old`.`file_size`)
   OR NOT (`new`.`file_hash` <=> `old`.`file_hash`)
   OR NOT (`new`.`source_file` <=> `old`.`source_file`)
   OR NOT (`new`.`item_count` <=> `old`.`item_count`)
   OR NOT (`new`.`imported_by_user_id` <=> `old`.`imported_by_user_id`)
   OR NOT (`new`.`created_at` <=> `old`.`created_at`)

UNION ALL

SELECT 'ITEM_SNAPSHOT_MISMATCH', `old`.`id`
FROM `price_matrix_items` AS `old`
LEFT JOIN `price_list_items` AS `new` ON `new`.`id` = `old`.`id`
WHERE `new`.`id` IS NULL
   OR NOT (`new`.`price_list_version_id` <=> `old`.`matrix_version_id`)
   OR NOT (`new`.`product_code` <=> `old`.`product_code`)
   OR NOT (`new`.`minimum_price` <=> `old`.`minimum_price`)
   OR NOT (`new`.`normal_price` <=> `old`.`normal_price`)
   OR NOT (`new`.`source_row` <=> `old`.`source_row`)
   OR NOT (`new`.`raw_data` <=> `old`.`raw_data`)

UNION ALL

SELECT 'ACTIVE_VERSION_MISMATCH', `profile`.`id`
FROM `price_profiles` AS `profile`
INNER JOIN `price_lists` AS `list` ON `list`.`id` = `profile`.`id`
LEFT JOIN `price_list_versions` AS `version` ON `version`.`id` = `list`.`active_version_id`
WHERE NOT (`list`.`active_version_id` <=> `profile`.`active_matrix_version_id`)
   OR (`list`.`active_version_id` IS NOT NULL AND `version`.`price_list_id` <> `list`.`id`)

UNION ALL

SELECT 'VERSION_ITEM_COUNT_MISMATCH', `version`.`id`
FROM `price_list_versions` AS `version`
LEFT JOIN `price_list_items` AS `item` ON `item`.`price_list_version_id` = `version`.`id`
GROUP BY `version`.`id`, `version`.`item_count`
HAVING COUNT(`item`.`id`) <> `version`.`item_count`

UNION ALL

SELECT 'CALCULATION_RELATION_MISMATCH', `calculation`.`id`
FROM `calculation_versions` AS `calculation`
LEFT JOIN `kit_calculation_series` AS `series`
  ON `series`.`id` = `calculation`.`kit_calculation_series_id`
LEFT JOIN `price_list_versions` AS `version`
  ON `version`.`id` = `calculation`.`price_list_version_id`
WHERE NOT (`calculation`.`kit_calculation_series_id` <=> `calculation`.`price_list_id`)
   OR NOT (`calculation`.`price_list_version_id` <=> `calculation`.`matrix_version_id`)
   OR `series`.`price_list_id` <> `version`.`price_list_id`;
