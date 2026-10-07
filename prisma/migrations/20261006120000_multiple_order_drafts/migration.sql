-- Mantem ate cinco pedidos em andamento por usuario. O limite e aplicado
-- transacionalmente pela aplicacao; cada cliente ocupa no maximo uma aba.
-- Os novos indices precisam existir antes da remocao do indice antigo porque
-- o MySQL exige um indice iniciado por user_id para sustentar a chave estrangeira.
CREATE UNIQUE INDEX `order_drafts_user_id_customer_id_key`
  ON `order_drafts` (`user_id`, `customer_id`);

CREATE INDEX `order_drafts_user_id_updated_at_idx`
  ON `order_drafts` (`user_id`, `updated_at`);

DROP INDEX `order_drafts_user_id_key` ON `order_drafts`;
