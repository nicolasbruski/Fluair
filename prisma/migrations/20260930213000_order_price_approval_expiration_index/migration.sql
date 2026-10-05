-- Suporta expiração oportunista sem varrer solicitações fora do estado aprovado.
CREATE INDEX `order_price_approval_requests_status_approved_until_idx`
  ON `order_price_approval_requests` (`status`, `approved_until`);
