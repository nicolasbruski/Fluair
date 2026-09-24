import type {
  EligibleOrderPriceListsEnvelope,
  OrderCatalogEnvelope,
  OrderQuoteEnvelope,
  OrderQuoteInput,
  OrderSavedCatalogEnvelope,
  SavedKitCompositionEnvelope,
  SavedCatalogMutationEnvelope,
  UpdateSavedCatalogItemInput,
} from '../../shared/orders.js';
import { apiRequest } from './api.js';

export function listEligibleOrderPriceLists(
  customerId: string,
  quantities: readonly number[],
): Promise<EligibleOrderPriceListsEnvelope> {
  const query = new URLSearchParams({ customerId });
  for (const quantity of quantities) query.append('quantity', String(quantity));
  return apiRequest<EligibleOrderPriceListsEnvelope>(`/api/v1/orders/price-lists?${query}`);
}

export function loadOrderCatalog(input: {
  customerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<OrderCatalogEnvelope> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 20),
  });
  if (input.customerId) query.set('customerId', input.customerId);
  if (input.search) query.set('search', input.search);
  return apiRequest<OrderCatalogEnvelope>(`/api/v1/orders/catalog?${query}`);
}

export function loadSavedOrderCatalog(input: {
  customerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<OrderSavedCatalogEnvelope> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 20),
  });
  if (input.customerId) query.set('customerId', input.customerId);
  if (input.search) query.set('search', input.search);
  return apiRequest<OrderSavedCatalogEnvelope>(`/api/v1/orders/saved-catalog?${query}`);
}

export function loadSavedKitComposition(
  calculationId: string,
): Promise<SavedKitCompositionEnvelope> {
  return apiRequest<SavedKitCompositionEnvelope>(
    `/api/v1/orders/saved-catalog/kits/${encodeURIComponent(calculationId)}/composition`,
  );
}

export function updateSavedCatalogItem(
  kind: 'products' | 'kits',
  id: string,
  input: UpdateSavedCatalogItemInput,
): Promise<SavedCatalogMutationEnvelope> {
  return apiRequest<SavedCatalogMutationEnvelope>(
    `/api/v1/orders/saved-catalog/${kind}/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteSavedCatalogItem(kind: 'products' | 'kits', id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/orders/saved-catalog/${kind}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function quoteOrder(input: OrderQuoteInput): Promise<OrderQuoteEnvelope> {
  return apiRequest<OrderQuoteEnvelope>('/api/v1/orders/quote', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
