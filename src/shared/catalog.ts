import type { NullableImageReference } from './media.js';

export const CATALOG_FILTERS = ['ALL', 'KITS', 'PRODUCTS', 'WITHOUT_IMAGE'] as const;
export type CatalogFilter = (typeof CATALOG_FILTERS)[number];

export interface CatalogOrigin {
  id: string;
  code: string;
  name: string;
}

export type CatalogItem =
  | {
      kind: 'KIT';
      entityId: string;
      code: string;
      description: string;
      reference: string | null;
      image: NullableImageReference;
      origins: CatalogOrigin[];
      compositionCalculationId: string;
      scope: 'STANDARD' | 'CUSTOMER_SPECIFIC';
    }
  | {
      kind: 'PRODUCT';
      entityId: string;
      code: string;
      description: string;
      reference: string | null;
      image: NullableImageReference;
      origins: CatalogOrigin[];
    };

export interface CatalogEnvelope {
  data: { items: CatalogItem[] };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
