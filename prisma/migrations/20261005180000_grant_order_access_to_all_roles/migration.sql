-- Todos os perfis autenticados podem montar pedidos e solicitar exceções de preço.
-- A decisão administrativa continua restrita ao papel ADMINISTRATOR no backend.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
INNER JOIN `permissions`
  ON `permissions`.`code` IN (
    'order.access',
    'price.view',
    'price.override',
    'customer.view'
  )
WHERE `roles`.`code` IN ('ADMINISTRATOR', 'CALCULATION_OPERATOR', 'READ_ONLY');
