-- O ICMS pertence ao item da versao da lista, pois pode variar para o mesmo
-- produto entre listas. Versoes anteriores permanecem validas com aliquota zero.
ALTER TABLE `price_list_items`
  ADD COLUMN `icms_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000;
