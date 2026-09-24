-- Aditiva: kits existentes permanecem sem referência até que o dado seja informado.
ALTER TABLE `kits` ADD COLUMN `reference` VARCHAR(120) NULL;

CREATE INDEX `kits_reference_idx` ON `kits`(`reference`);
