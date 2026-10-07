import type { PriceListTypeCode } from './pricing.js';
import type { NullableImageReference } from './media.js';
import type { LastOrderPrice } from './last-order-price.js';
import type { OrderPriceViolation } from './order-price-approvals.js';

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
    pisRate: string;
    cofinsRate: string;
    ipiRate: string;
    icmsRate: string;
  }>;
  pisRate: string;
  cofinsRate: string;
  ipiRate: string;
  ipiIncluded: boolean;
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
  pisRate: string;
  cofinsRate: string;
  ipiRate: string;
  icmsRate: string;
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

export interface OrderDraftCartItem {
  key: string;
  kind: 'KIT' | 'STANDALONE_PRODUCT';
  code: string;
  description: string;
  price: number;
  /** @deprecated Compatibility with drafts saved before per-tax selection. */
  taxRate?: number | undefined;
  taxes?: OrderTaxSelections | undefined;
  referencePrice: number;
  priceEdited: boolean;
  priceReference: 'MINIMUM' | 'NORMAL' | 'UNIT';
  source: string;
  sourceVersionId: string;
  priceListName?: string | undefined;
  priceListVersion?: number | undefined;
  minimumOrderQuantity?: number | null | undefined;
  maximumOrderQuantity?: number | null | undefined;
  calculatedAt?: string | undefined;
  minimumPrice?: number | undefined;
  normalPrice?: number | undefined;
  priceRanges?:
    | Array<{
        list: string;
        minimumPrice: number;
        maximumPrice: number;
        pisRate: number;
        cofinsRate: number;
        ipiRate: number;
        icmsRate: number;
      }>
    | undefined;
  ipiRate?: number | undefined;
  icmsRate?: number | undefined;
  pisRate?: number | undefined;
  cofinsRate?: number | undefined;
  calculationId?: string | undefined;
  lastOrderPrice?: LastOrderPrice | null | undefined;
  quantity: number;
  image: NullableImageReference;
}

export type OrderLastSalePriceLine =
  | { key: string; kind: 'STANDALONE_PRODUCT'; productCode: string }
  | { key: string; kind: 'KIT'; calculationId: string };

export interface OrderLastSalePricesInput {
  customerId: string;
  lines: OrderLastSalePriceLine[];
}

export interface OrderLastSalePricesEnvelope {
  data: {
    prices: Array<{ key: string; lastOrderPrice: LastOrderPrice | null }>;
  };
}

export interface OrderDraftPayload {
  note: string;
  cart: OrderDraftCartItem[];
  approvalRequestId?: string | undefined;
}

export interface OrderDraft {
  id: string;
  revision: number;
  customer: {
    id: string;
    code: string;
    legalName: string;
    active: boolean;
  };
  payload: OrderDraftPayload;
  updatedAt: string;
}

export interface OrderDraftEnvelope {
  data: {
    drafts: OrderDraft[];
    draft?: OrderDraft | null;
    evicted?: OrderDraft | null;
  };
}

export interface OrderDraftSwapInput {
  targetCustomerId: string;
  current?:
    | {
        customerId: string;
        payload: OrderDraftPayload;
      }
    | undefined;
}

export interface OrderDraftSaveInput {
  customerId: string;
  payload: OrderDraftPayload;
}

export interface OrderDraftSwapEnvelope {
  data: {
    restored: OrderDraft | null;
    drafts: OrderDraft[];
    draft?: OrderDraft | null;
    evicted?: OrderDraft | null;
  };
}

export type OrderQuoteLineInput =
  | {
      kind: 'STANDALONE_PRODUCT';
      productCode: string;
      priceListVersionId: string;
      quantity: number;
      negotiatedUnitPrice?: string;
      appliedTaxes?: OrderAppliedTaxes;
    }
  | {
      kind: 'KIT';
      calculationId: string;
      priceReference: 'MINIMUM' | 'NORMAL';
      quantity: number;
      negotiatedUnitPrice?: string;
      appliedTaxes?: OrderAppliedTaxes;
    };

export interface OrderQuoteInput {
  customerId: string;
  lines: OrderQuoteLineInput[];
}

export interface OrderAppliedTaxes {
  pis: boolean;
  cofins: boolean;
  icms: boolean;
  ipi: boolean;
}

export interface OrderTaxSelection {
  selected: boolean;
  rate: number;
}

export interface OrderTaxSelections {
  pis: OrderTaxSelection;
  cofins: OrderTaxSelection;
  icms: OrderTaxSelection;
  ipi: OrderTaxSelection;
}

export interface OrderTaxBreakdown {
  pis: { selected: boolean; rate: string; unitAmount: string };
  cofins: { selected: boolean; rate: string; unitAmount: string };
  icms: { selected: boolean; rate: string; unitAmount: string };
  ipi: { selected: boolean; rate: string; unitAmount: string };
  totalUnitAmount: string;
}

export type OrderQuoteLine =
  | {
      kind: 'STANDALONE_PRODUCT';
      productId: string | null;
      productCode: string;
      priceList: {
        id: string;
        code: string;
        name: string;
        minimumOrderQuantity: number | null;
        maximumOrderQuantity: number | null;
      };
      description: string;
      reference: string;
      unit: string | null;
      quantity: number;
      unitPrice: string;
      referenceUnitPrice: string;
      negotiatedUnitPrice: string;
      minimumReferencePrice: string;
      normalReferencePrice: string;
      subtotal: string;
      finalUnitPrice: string;
      taxes: OrderTaxBreakdown;
      pisRate: string;
      cofinsRate: string;
      ipiRate: string;
      ipiIncluded: boolean;
      icmsRate: string;
      priceListVersion: { id: string; version: number };
      image: NullableImageReference;
    }
  | {
      kind: 'KIT';
      kitId: string;
      calculationId: string;
      calculationVersion: number;
      code: string;
      description: string;
      priceReference: 'MINIMUM' | 'NORMAL';
      quantity: number;
      unitPrice: string;
      referenceUnitPrice: string;
      negotiatedUnitPrice: string;
      minimumReferencePrice: string;
      normalReferencePrice: string;
      subtotal: string;
      finalUnitPrice: string;
      taxes: OrderTaxBreakdown;
      pisRate: string;
      cofinsRate: string;
      ipiRate: string;
      icmsRate: string;
      priceList: {
        id: string;
        code: string;
        name: string;
        type: 'KIT_COMPONENT';
        minimumOrderQuantity: number | null;
        maximumOrderQuantity: number | null;
      };
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
      customerClass: { id: string; code: string; name: string } | null;
      customerSegment: { id: string; code: string; name: string } | null;
    };
    totalQuantity: number;
    lines: OrderQuoteLine[];
    total: string;
    referenceTotal: string;
    creator: { id: string; name: string; email: string } | null;
    recipients: string[];
    quoteToken: string;
    approval: {
      required: boolean;
      violations: OrderPriceViolation[];
    };
    expiresAt: string;
    differences: Array<{
      line: number;
      code: string;
      referenceUnitPrice: string;
      negotiatedUnitPrice: string;
    }>;
    warnings: string[];
    quotedAt: string;
  };
}

export const ORDER_STATUSES = ['SUBMITTED', 'CANCELLED'] as const;
export type OrderStatusCode = (typeof ORDER_STATUSES)[number];

export const ORDER_EMAIL_DELIVERY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'ACCEPTED',
  'DELIVERED',
  'FAILED',
  'BOUNCED',
] as const;
export type OrderEmailDeliveryStatusCode = (typeof ORDER_EMAIL_DELIVERY_STATUSES)[number];

export interface OrderCustomerSnapshot {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  city: string | null;
  state: string | null;
  customerClass: { id: string; code: string; name: string } | null;
  customerSegment: { id: string; code: string; name: string } | null;
}

export interface OrderCreatorSnapshot {
  id: string;
  name: string;
  email: string;
}

export interface OrderItemSnapshot {
  kind: 'STANDALONE_PRODUCT' | 'KIT';
  sourceProductId: string | null;
  sourceKitId: string | null;
  sourceCalculationVersionId: string | null;
  sourcePriceListVersionId: string | null;
  priceList: {
    id: string;
    code: string;
    name: string;
    type: PriceListTypeCode;
    version: number;
  };
  calculationVersion: number | null;
  priceReference: 'UNIT' | 'MINIMUM' | 'NORMAL';
  code: string;
  description: string;
  reference: string | null;
  unit: string | null;
  quantity: string;
  referenceUnitPrice: string;
  negotiatedUnitPrice: string;
  finalUnitPrice?: string;
  taxes?: OrderTaxBreakdown | null;
  minimumReferencePrice: string | null;
  normalReferencePrice: string | null;
  ipiRate: string | null;
  icmsRate: string | null;
  pisRate?: string | null;
  cofinsRate?: string | null;
  subtotal: string;
}

export interface OrderEmailDeliverySnapshot {
  recipients: string[];
  fromAddress: string;
  fromName: string | null;
  replyTo: string | null;
  templateVersion: string;
  idempotencyKey: string;
  contentHash: string;
}

export interface CreateOrderSnapshot {
  idempotencyKey: string;
  contentHash: string;
  customer: OrderCustomerSnapshot;
  creator: OrderCreatorSnapshot;
  note: string | null;
  totalQuantity: string;
  totalAmount: string;
  items: OrderItemSnapshot[];
  delivery: OrderEmailDeliverySnapshot;
  priceApproval?: {
    id: string;
    expectedVersion: number;
    contentHash: string;
    hashVersion: number;
  } | null;
}

export interface CreatedOrderSnapshot {
  order: {
    id: string;
    number: string;
    status: 'SUBMITTED';
    submittedAt: string;
  };
  emailDelivery: {
    id: string;
    status: OrderEmailDeliveryStatusCode;
    recipients: string[];
  };
}

export type CreateOrderLineInput =
  | (Extract<OrderQuoteLineInput, { kind: 'STANDALONE_PRODUCT' }> & {
      negotiatedUnitPrice: string;
    })
  | (Extract<OrderQuoteLineInput, { kind: 'KIT' }> & { negotiatedUnitPrice: string });

export interface CreateOrderInput {
  customerId: string;
  lines: CreateOrderLineInput[];
  note: string;
  quoteToken: string;
  approvalRequestId?: string;
}

export interface CreateOrderEnvelope {
  data: CreatedOrderSnapshot & { replayed: boolean };
}

export interface OrderDetailsEnvelope {
  data: {
    order: {
      id: string;
      number: string;
      status: OrderStatusCode;
      submittedAt: string;
      customer: OrderCustomerSnapshot;
      creator: OrderCreatorSnapshot;
      note: string | null;
      totalQuantity: string;
      totalAmount: string;
      items: OrderItemSnapshot[];
    };
    emailDeliveries: Array<{
      id: string;
      status: OrderEmailDeliveryStatusCode;
      recipients: string[];
      attemptCount: number;
      publicError: string | null;
      acceptedAt: string | null;
      deliveredAt: string | null;
      failedAt: string | null;
      bouncedAt: string | null;
      createdAt: string;
    }>;
    priceApproval: {
      id: string;
      status: 'CONSUMED';
      requestedAt: string;
      reviewedAt: string;
      approvedUntil: string;
      consumedAt: string;
      reviewer: { id: string; name: string };
      decisionNote: string | null;
    } | null;
  };
}
