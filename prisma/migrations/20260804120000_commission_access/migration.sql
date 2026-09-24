-- O sistema de comissões é liberado exclusivamente por override individual de usuário.
INSERT INTO `permissions` (`id`, `code`, `description`, `created_at`)
VALUES (UUID(), 'commission.access', 'Acessar o sistema de comissões.', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
