import type { PriceListTypeCode } from './pricing.js';
import type { NullableImageReference } from './media.js';

export interface EligibleOrderPriceList {
  id: string;
  code: string;
  name: string;
  type: 'STANDALONE_PRODUCT';
  minimumOrderQuantity: number | null;
  maximumOrderQuantity: number | null;
  activeVersion: { id: string; version: number };
}

export interface EligibleOrderPriceListsEnvelope {
  data: {
    customer: { id: string; code: string; legalName: string; customerSegmentId: string };
    totalQuantity: number;
    priceLists: EligibleOrderPriceList[];
  };
}

export interface OrderStandaloneCatalogItem {
  kind: 'STANDALONE_PRODUCT';
  productId: string | null;
  code: string;
  description: string;
  reference: string;
  unitPrice: string;
  minimumPrice: string;
  maximumPrice: string;
  priceRanges: Array<{
    priceList: { id: string; code: string; name: string };
    priceListVersionId: string;
    priceListVersion: number;
    minimumOrderQuantity: number | null;
    maximumOrderQuantity: number | null;
    minimumPrice: string;
    maximumPrice: string;
    ipiRate: string;
    icmsRate: string;
  }>;
  ipiRate: string;
  ipiIncluded: true;
  icmsRate: string;
  priceListVersionId: string;
  priceListVersion: number;
  priceList: { id: string; code: string; name: string };
  image: NullableImageReference;
}

export interface OrderCalculatedProductCatalogItem {
  kind: 'CALCULATED_PRODUCT';
  calculationItemId: string;
  productId: string;
  code: string;
  description: string;
  reference?: string | null;
  unit: string;
  minimumPrice: string;
  normalPrice: string;
  calculatedAt: string;
  priceList: { id: string; code: string; name: string; type: 'KIT_COMPONENT' };
  priceListVersion: { id: string; version: number };
  kits: Array<{ code: string; description: string }>;
  image: NullableImageReference;
}

export interface OrderKitCatalogItem {
  kind: 'KIT';
  calculationId: string;
  calculationVersion: number;
  code: string;
  description: string;
  reference?: string | null;
  minimumPrice: string;
  normalPrice: string;
  scope: 'STANDARD' | 'CUSTOMER_SPECIFIC';
  calculatedAt: string;
  priceList: { id: string; code: string; name: string; type: PriceListTypeCode };
  priceListVersion: { id: string; version: number };
  image: NullableImageReference;
}

export interface OrderCatalogEnvelope {
  data: {
    customer: { id: string; code: string; legalName: string } | null;
    products: OrderStandaloneCatalogItem[];
    kits: OrderKitCatalogItem[];
  };
  pagination: {
    page: number;
    pageSize: number;
    productTotal: number;
    productTotalPages: number;
    kitTotal: number;
    kitTotalPages: number;
  };
}

export interface OrderSavedCatalogEnvelope {
  data: {
    calculatedProducts: OrderCalculatedProductCatalogItem[];
    kits: OrderKitCatalogItem[];
  };
  pagination: {
    page: number;
    pageSize: number;
    calculatedProductTotal: number;
    calculatedProductTotalPages: number;
    kitTotal: number;
    kitTotalPages: number;
  };
}

export interface SavedKitCompositionItem {
  lineNumber: number;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  minimumUnitPrice: string;
  normalUnitPrice: string;
  minimumTotal: string;
  normalTotal: string;
  hasPrice: boolean;
}

export interface SavedKitCompositionEnvelope {
  data: {
    kit: {
      calculationId: string;
      code: string;
      description: string;
      customers: Array<{ id: string; code: string; legalName: string }>;
      items: SavedKitCompositionItem[];
    };
  };
}

export interface UpdateSavedCatalogItemInput {
  description: string;
  minimumPrice: string;
  normalPrice: string;
  scope?: 'STANDARD' | 'CUSTOMER_SPECIFIC';
}

export interface SavedCatalogMutationEnvelope {
  data: { updated: true };
}

export type OrderQuoteLineInput =
  | {
      kind: 'STANDALONE_PRODUCT';
      productCode: string;
      priceListVersionId: string;
      quantity: number;
    }
  | {
      kind: 'KIT';
      calculationId: string;
      priceReference: 'MINIMUM' | 'NORMAL';
      quantity: number;
    };

export interface OrderQuoteInput {
  customerId: string;
  lines: OrderQuoteLineInput[];
}

export type OrderQuoteLine =
  | {
      kind: 'STANDALONE_PRODUCT';
      productCode: string;
      priceList: { id: string; code: string; name: string };
      description: string;
      reference: string;
      quantity: number;
      unitPrice: string;
      subtotal: string;
      ipiRate: string;
      ipiIncluded: true;
      icmsRate: string;
      priceListVersion: { id: string; version: number };
      image: NullableImageReference;
    }
  | {
      kind: 'KIT';
      calculationId: string;
      calculationVersion: number;
      code: string;
      description: string;
      priceReference: 'MINIMUM' | 'NORMAL';
      quantity: number;
      unitPrice: string;
      subtotal: string;
      priceList: { id: string; code: string; name: string; type: 'KIT_COMPONENT' };
      priceListVersion: { id: string; version: number };
      image: NullableImageReference;
    };

export interface OrderQuoteEnvelope {
  data: {
    customer: {
      id: string;
      code: string;
      legalName: string;
      customerClassId: string | null;
      customerSegmentId: string | null;
    };
    totalQuantity: number;
    lines: OrderQuoteLine[];
    total: string;
    warnings: string[];
    quotedAt: string;
  };
}
