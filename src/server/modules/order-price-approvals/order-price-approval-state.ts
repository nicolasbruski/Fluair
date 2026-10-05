import type { OrderPriceApprovalStatusCode } from '../../../shared/order-price-approvals.js';

const TRANSITIONS: Readonly<
  Record<OrderPriceApprovalStatusCode, readonly OrderPriceApprovalStatusCode[]>
> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED'],
  APPROVED: ['CONSUMED', 'SUPERSEDED', 'EXPIRED'],
  REJECTED: [],
  CANCELLED: [],
  SUPERSEDED: [],
  EXPIRED: [],
  CONSUMED: [],
};

export function canTransitionOrderPriceApproval(
  current: OrderPriceApprovalStatusCode,
  next: OrderPriceApprovalStatusCode,
): boolean {
  return TRANSITIONS[current].includes(next);
}

export function canReviewOrderPriceApproval(requesterId: string, reviewerId: string): boolean {
  return requesterId !== reviewerId;
}
