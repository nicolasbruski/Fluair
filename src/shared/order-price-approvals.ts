import type { PriceListTypeCode } from './pricing.js';

export const ORDER_PRICE_APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'SUPERSEDED',
  'EXPIRED',
  'CONSUMED',
] as const;

export type OrderPriceApprovalStatusCode = (typeof ORDER_PRICE_APPROVAL_STATUSES)[number];
export type OrderPriceApprovalItemKind = 'STANDALONE_PRODUCT' | 'KIT';
export type OrderPriceApprovalPriceReference = 'UNIT' | 'MINIMUM' | 'NORMAL';

export interface OrderPriceApprovalActorSnapshot {
  id: string;
  name: string;
  email: string;
}

export interface OrderPriceApprovalCustomerSnapshot {
  id: string;
  code: string;
  legalName: string;
  customerClass: { id: string; code: string; name: string } | null;
  customerSegment: { id: string; code: string; name: string } | null;
}

export interface OrderPriceApprovalItemSnapshot {
  lineNumber: number;
  kind: OrderPriceApprovalItemKind;
  requiresApproval: boolean;
  sourceProductId: string | null;
  sourceKitId: string | null;
  sourceCalculationVersionId: string | null;
  sourcePriceListVersionId: string;
  priceList: {
    id: string;
    code: string;
    name: string;
    type: PriceListTypeCode;
    version: number;
    minimumOrderQuantity: number | null;
    maximumOrderQuantity: number | null;
  };
  calculationVersion: number | null;
  priceReference: OrderPriceApprovalPriceReference;
  code: string;
  description: string;
  reference: string | null;
  unit: string | null;
  quantity: string;
  referenceUnitPrice: string;
  minimumUnitPrice: string;
  negotiatedUnitPrice: string;
  minimumSubtotal: string;
  negotiatedSubtotal: string;
  exceptionUnitAmount: string;
  exceptionTotalAmount: string;
  ipiRate: string | null;
  icmsRate: string | null;
}

export interface OrderPriceViolation {
  line: number;
  kind: OrderPriceApprovalItemKind;
  code: string;
  priceListVersionId: string;
  priceListName: string;
  minimumOrderQuantity: number | null;
  maximumOrderQuantity: number | null;
  quantity: string;
  minimumUnitPrice: string;
  negotiatedUnitPrice: string;
  unitDifference: string;
  totalDifference: string;
  differencePercentage: string;
}

export interface OrderPriceApprovalDecisionSnapshot {
  reviewer: OrderPriceApprovalActorSnapshot;
  note: string | null;
  reviewedAt: string;
  approvedUntil: string | null;
}

export interface OrderPriceApprovalSummary {
  id: string;
  status: OrderPriceApprovalStatusCode;
  requester: OrderPriceApprovalActorSnapshot;
  customer: OrderPriceApprovalCustomerSnapshot;
  requestedAt: string;
  updatedAt: string;
  totalQuantity: string;
  minimumTotalAmount: string;
  requestedTotalAmount: string;
  exceptionAmount: string;
  itemCount: number;
  exceptionCount: number;
  decision: OrderPriceApprovalDecisionSnapshot | null;
  consumedOrder: { id: string; number: string } | null;
  version: number;
}

export interface OrderPriceApprovalDetail extends OrderPriceApprovalSummary {
  justification: string;
  items: OrderPriceApprovalItemSnapshot[];
  consumedAt: string | null;
}

export function orderPriceApprovalSummary(
  detail: OrderPriceApprovalDetail,
): OrderPriceApprovalSummary {
  return {
    id: detail.id,
    status: detail.status,
    requester: detail.requester,
    customer: detail.customer,
    requestedAt: detail.requestedAt,
    updatedAt: detail.updatedAt,
    totalQuantity: detail.totalQuantity,
    minimumTotalAmount: detail.minimumTotalAmount,
    requestedTotalAmount: detail.requestedTotalAmount,
    exceptionAmount: detail.exceptionAmount,
    itemCount: detail.itemCount,
    exceptionCount: detail.exceptionCount,
    decision: detail.decision,
    consumedOrder: detail.consumedOrder,
    version: detail.version,
  };
}

export type MyOrderPriceApprovalSummary = OrderPriceApprovalSummary;
export type MyOrderPriceApprovalDetail = OrderPriceApprovalDetail;
export interface AdminOrderPriceApprovalSummary extends OrderPriceApprovalSummary {
  waitingSeconds: number;
}
export type AdminOrderPriceApprovalDetail = OrderPriceApprovalDetail;

export interface CreateOrderPriceApprovalInput {
  customerId: string;
  lines: Array<
    | {
        kind: 'STANDALONE_PRODUCT';
        productCode: string;
        priceListVersionId: string;
        quantity: number;
        negotiatedUnitPrice: string;
      }
    | {
        kind: 'KIT';
        calculationId: string;
        priceReference: 'MINIMUM' | 'NORMAL';
        quantity: number;
        negotiatedUnitPrice: string;
      }
  >;
  justification: string;
  supersedesRequestId?: string;
}

export interface DecideOrderPriceApprovalInput {
  expectedVersion: number;
  decision: 'APPROVE' | 'REJECT';
  note?: string;
}

export interface CancelOrderPriceApprovalInput {
  expectedVersion: number;
}

export interface OrderPriceApprovalPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrderPriceApprovalListEnvelope<T = OrderPriceApprovalSummary> {
  data: T[];
  pagination: OrderPriceApprovalPagination;
}

export interface OrderPriceApprovalDetailEnvelope<T = OrderPriceApprovalDetail> {
  data: T;
}

export interface OrderPriceApprovalCountEnvelope {
  data: { pending: number };
}

export interface CreatedOrderPriceApprovalEnvelope {
  data: {
    approval: OrderPriceApprovalSummary;
    violations: OrderPriceViolation[];
    replayed: boolean;
  };
}

export interface CanonicalOrderPriceApprovalContent {
  requesterId: string;
  customerId: string;
  customerClassId: string | null;
  customerSegmentId: string | null;
  items: OrderPriceApprovalItemSnapshot[];
  totalQuantity: string;
  minimumTotalAmount: string;
  requestedTotalAmount: string;
}

export interface CreateOrderPriceApprovalSnapshot {
  idempotencyKey: string;
  contentHash: string;
  hashVersion: number;
  requester: OrderPriceApprovalActorSnapshot;
  customer: OrderPriceApprovalCustomerSnapshot;
  justification: string;
  totalQuantity: string;
  minimumTotalAmount: string;
  requestedTotalAmount: string;
  exceptionAmount: string;
  items: OrderPriceApprovalItemSnapshot[];
  supersedesRequestId?: string;
}

export interface OrderPriceApprovalAuditContext {
  requestId: string;
}

export interface OrderPriceApprovalCreateResult {
  approval: OrderPriceApprovalDetail;
  replayed: boolean;
}

export interface OrderPriceApprovalConditionalUpdate {
  id: string;
  expectedStatus: OrderPriceApprovalStatusCode;
  expectedVersion: number;
  status: OrderPriceApprovalStatusCode;
  reviewer?: OrderPriceApprovalActorSnapshot;
  reviewNote?: string | null;
  reviewedAt?: string;
  approvedUntil?: string | null;
  consumedOrderId?: string;
  consumedAt?: string;
}
