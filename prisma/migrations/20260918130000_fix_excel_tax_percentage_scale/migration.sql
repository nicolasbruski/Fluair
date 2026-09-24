-- Versoes importadas pelo leitor anterior salvaram percentuais numericos do
-- Excel como fracoes (por exemplo, 3,25% como 0,0325). No dominio tributario,
-- as aliquotas sao armazenadas em pontos percentuais.
UPDATE `price_list_items`
SET `ipi_rate` = `ipi_rate` * 100
WHERE `ipi_rate` > 0
  AND `ipi_rate` < 1;

UPDATE `price_list_items`
SET `icms_rate` = `icms_rate` * 100
WHERE `icms_rate` > 0
  AND `icms_rate` < 1;
