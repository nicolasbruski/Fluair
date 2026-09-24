-- Associações explícitas de público das listas. As chaves compostas impedem
-- duplicidade sem alterar classes, segmentos ou listas existentes.
CREATE TABLE `price_list_classes` (
  `price_list_id` CHAR(36) NOT NULL,
  `customer_class_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `price_list_classes_customer_class_id_idx` (`customer_class_id`),
  PRIMARY KEY (`price_list_id`, `customer_class_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_list_segments` (
  `price_list_id` CHAR(36) NOT NULL,
  `customer_segment_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `price_list_segments_customer_segment_id_idx` (`customer_segment_id`),
  PRIMARY KEY (`price_list_id`, `customer_segment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `price_list_classes`
  ADD CONSTRAINT `price_list_classes_price_list_id_fkey`
    FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `price_list_classes_customer_class_id_fkey`
    FOREIGN KEY (`customer_class_id`) REFERENCES `customer_classes`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `price_list_segments`
  ADD CONSTRAINT `price_list_segments_price_list_id_fkey`
    FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `price_list_segments_customer_segment_id_fkey`
    FOREIGN KEY (`customer_segment_id`) REFERENCES `customer_segments`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
