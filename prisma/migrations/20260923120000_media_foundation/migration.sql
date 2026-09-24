-- Aditiva: registros existentes continuam com imagem nula e nenhum histórico é inventado.
CREATE TABLE `media_assets` (
    `id` CHAR(36) NOT NULL,
    `original_file_name` VARCHAR(255) NOT NULL,
    `original_mime_type` VARCHAR(40) NOT NULL,
    `mime_type` VARCHAR(40) NOT NULL,
    `source_size` INTEGER NOT NULL,
    `source_sha256` CHAR(64) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `display_size` INTEGER NOT NULL,
    `display_sha256` CHAR(64) NOT NULL,
    `display_data` LONGBLOB NOT NULL,
    `thumbnail_width` INTEGER NOT NULL,
    `thumbnail_height` INTEGER NOT NULL,
    `thumbnail_size` INTEGER NOT NULL,
    `thumbnail_sha256` CHAR(64) NOT NULL,
    `thumbnail_data` LONGBLOB NOT NULL,
    `created_by_user_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `media_assets_created_by_user_id_created_at_idx`(`created_by_user_id`, `created_at`),
    INDEX `media_assets_source_sha256_idx`(`source_sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `products` ADD COLUMN `current_image_id` CHAR(36) NULL;
ALTER TABLE `kits` ADD COLUMN `current_image_id` CHAR(36) NULL;
ALTER TABLE `calculation_versions` ADD COLUMN `kit_image_id` CHAR(36) NULL;

CREATE INDEX `products_current_image_id_idx` ON `products`(`current_image_id`);
CREATE INDEX `kits_current_image_id_idx` ON `kits`(`current_image_id`);
CREATE INDEX `calculation_versions_kit_image_id_idx` ON `calculation_versions`(`kit_image_id`);

ALTER TABLE `media_assets`
    ADD CONSTRAINT `media_assets_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `products`
    ADD CONSTRAINT `products_current_image_id_fkey`
    FOREIGN KEY (`current_image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `kits`
    ADD CONSTRAINT `kits_current_image_id_fkey`
    FOREIGN KEY (`current_image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `calculation_versions`
    ADD CONSTRAINT `calculation_versions_kit_image_id_fkey`
    FOREIGN KEY (`kit_image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
