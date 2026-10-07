-- Libera ao Vendedor o fluxo comercial sem conceder permissões administrativas.
UPDATE `roles`
SET `description` = 'Consulta o catálogo e clientes, negocia preços e monta pedidos.'
WHERE `code` = 'CALCULATION_OPERATOR';

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
INNER JOIN `permissions`
  ON `permissions`.`code` IN (
    'calculation.view',
    'calculation.history',
    'calculation.export',
    'order.access',
    'price.view',
    'price.override',
    'customer.view'
  )
WHERE `roles`.`code` = 'CALCULATION_OPERATOR';
