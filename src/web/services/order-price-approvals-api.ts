import type {
  AdminOrderPriceApprovalDetail,
  AdminOrderPriceApprovalSummary,
  CancelOrderPriceApprovalInput,
  CreatedOrderPriceApprovalEnvelope,
  CreateOrderPriceApprovalInput,
  MyOrderPriceApprovalDetail,
  MyOrderPriceApprovalSummary,
  OrderPriceApprovalCountEnvelope,
  OrderPriceApprovalDetailEnvelope,
  OrderPriceApprovalListEnvelope,
  OrderPriceApprovalStatusCode,
} from '../../shared/order-price-approvals.js';
import { apiRequest } from './api.js';

export function createOrderPriceApproval(
  input: CreateOrderPriceApprovalInput,
  idempotencyKey: string,
): Promise<CreatedOrderPriceApprovalEnvelope> {
  return apiRequest<CreatedOrderPriceApprovalEnvelope>('/api/v1/order-price-approvals', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function listMyOrderPriceApprovals(
  input: {
    status?: OrderPriceApprovalStatusCode;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<OrderPriceApprovalListEnvelope<MyOrderPriceApprovalSummary>> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 20),
  });
  if (input.status) query.set('status', input.status);
  return apiRequest<OrderPriceApprovalListEnvelope<MyOrderPriceApprovalSummary>>(
    `/api/v1/order-price-approvals/mine?${query}`,
  );
}

export function getMyOrderPriceApproval(
  id: string,
): Promise<OrderPriceApprovalDetailEnvelope<MyOrderPriceApprovalDetail>> {
  return apiRequest<OrderPriceApprovalDetailEnvelope<MyOrderPriceApprovalDetail>>(
    `/api/v1/order-price-approvals/${encodeURIComponent(id)}`,
  );
}

export function cancelMyOrderPriceApproval(
  id: string,
  input: CancelOrderPriceApprovalInput,
): Promise<OrderPriceApprovalDetailEnvelope<MyOrderPriceApprovalDetail>> {
  return apiRequest<OrderPriceApprovalDetailEnvelope<MyOrderPriceApprovalDetail>>(
    `/api/v1/order-price-approvals/${encodeURIComponent(id)}/cancel`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export interface AdminOrderPriceApprovalsQuery {
  status?: OrderPriceApprovalStatusCode;
  requestedFrom?: string;
  requestedTo?: string;
  requesterId?: string;
  customerId?: string;
  code?: string;
  page?: number;
  pageSize?: number;
}

export function countAdminOrderPriceApprovals(): Promise<OrderPriceApprovalCountEnvelope> {
  return apiRequest<OrderPriceApprovalCountEnvelope>('/api/v1/order-price-approvals/admin/count');
}

export function listAdminOrderPriceApprovals(
  input: AdminOrderPriceApprovalsQuery = {},
): Promise<OrderPriceApprovalListEnvelope<AdminOrderPriceApprovalSummary>> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 20),
  });
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && key !== 'page' && key !== 'pageSize') query.set(key, String(value));
  }
  return apiRequest<OrderPriceApprovalListEnvelope<AdminOrderPriceApprovalSummary>>(
    `/api/v1/order-price-approvals/admin?${query}`,
  );
}

export function getAdminOrderPriceApproval(
  id: string,
): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
  return apiRequest<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>>(
    `/api/v1/order-price-approvals/admin/${encodeURIComponent(id)}`,
  );
}

export function approveAdminOrderPriceApproval(
  id: string,
  expectedVersion: number,
  note?: string,
): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
  return apiRequest<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>>(
    `/api/v1/order-price-approvals/admin/${encodeURIComponent(id)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, ...(note?.trim() ? { note: note.trim() } : {}) }),
    },
  );
}

export function rejectAdminOrderPriceApproval(
  id: string,
  expectedVersion: number,
  reason: string,
): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
  return apiRequest<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>>(
    `/api/v1/order-price-approvals/admin/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, reason: reason.trim() }),
    },
  );
}
