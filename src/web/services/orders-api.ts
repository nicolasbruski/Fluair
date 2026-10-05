import type {
  EligibleOrderPriceListsEnvelope,
  CreateOrderEnvelope,
  CreateOrderInput,
  OrderCatalogEnvelope,
  OrderQuoteEnvelope,
  OrderQuoteInput,
  OrderDetailsEnvelope,
  OrderSavedCatalogEnvelope,
  SavedKitCompositionEnvelope,
  SavedCatalogMutationEnvelope,
  UpdateSavedCatalogItemInput,
  OrderDraftEnvelope,
  OrderDraftSwapEnvelope,
  OrderDraftSwapInput,
  OrderDraftSaveInput,
  OrderLastSalePricesEnvelope,
  OrderLastSalePricesInput,
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

export function loadLastSalePrices(
  input: OrderLastSalePricesInput,
): Promise<OrderLastSalePricesEnvelope> {
  return apiRequest<OrderLastSalePricesEnvelope>('/api/v1/orders/last-sale-prices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createOrder(
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<CreateOrderEnvelope> {
  return apiRequest<CreateOrderEnvelope>('/api/v1/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function loadOrder(id: string): Promise<OrderDetailsEnvelope> {
  return apiRequest<OrderDetailsEnvelope>(`/api/v1/orders/${encodeURIComponent(id)}`);
}

export function loadOrderDraft(): Promise<OrderDraftEnvelope> {
  return apiRequest<OrderDraftEnvelope>('/api/v1/orders/draft');
}

export function swapOrderDraft(input: OrderDraftSwapInput): Promise<OrderDraftSwapEnvelope> {
  return apiRequest<OrderDraftSwapEnvelope>('/api/v1/orders/draft/swap', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function saveOrderDraft(input: OrderDraftSaveInput): Promise<OrderDraftEnvelope> {
  return apiRequest<OrderDraftEnvelope>('/api/v1/orders/draft', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteOrderDraft(customerId?: string): Promise<void> {
  const query = customerId ? `?${new URLSearchParams({ customerId }).toString()}` : '';
  return apiRequest<void>(`/api/v1/orders/draft${query}`, { method: 'DELETE' });
}
