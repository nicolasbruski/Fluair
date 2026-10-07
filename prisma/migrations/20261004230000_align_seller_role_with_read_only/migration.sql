-- Alinha o perfil exibido como Vendedor ao acesso padrão do perfil Consulta.
-- Concessões individuais, como Comissões, permanecem em user_permission_overrides.
UPDATE `roles`
SET
  `name` = 'Vendedor',
  `description` = 'Consulta cálculos e históricos.'
WHERE `code` = 'CALCULATION_OPERATOR';

DELETE FROM `role_permissions`
WHERE `role_id` IN (
  SELECT `id`
  FROM `roles`
  WHERE `code` = 'CALCULATION_OPERATOR'
);

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
INNER JOIN `permissions`
  ON `permissions`.`code` IN ('calculation.view', 'calculation.history')
WHERE `roles`.`code` = 'CALCULATION_OPERATOR';
