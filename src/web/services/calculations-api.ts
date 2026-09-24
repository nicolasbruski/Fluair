import type {
  CalculationDetailEnvelope,
  CalculationHistoryEnvelope,
  CalculationPreviewEnvelope,
  CalculationSaveEnvelope,
  CalculationSearchEnvelope,
  CalculationSearchSort,
} from '../../shared/pricing.js';
import { apiRequest } from './api.js';

function spreadsheetRequest(file: File): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  };
}

export function previewCalculation(
  priceListId: string,
  file: File,
): Promise<CalculationPreviewEnvelope> {
  return apiRequest<CalculationPreviewEnvelope>(
    `/api/v1/calculations/preview/${encodeURIComponent(priceListId)}`,
    spreadsheetRequest(file),
  );
}

export function saveCalculation(
  priceListId: string,
  file: File,
  input: {
    recalculate: boolean;
    customerId: string;
    expectedPriceListVersionId: string;
    expectedKitImageId: string | null;
    image?: File | null;
  },
): Promise<CalculationSaveEnvelope> {
  const body = new FormData();
  body.set('spreadsheet', file, file.name);
  body.set('recalculate', String(input.recalculate));
  body.set('customerId', input.customerId);
  body.set('expectedPriceListVersionId', input.expectedPriceListVersionId);
  body.set('expectedKitImageId', input.expectedKitImageId ?? '');
  if (input.image) body.set('image', input.image, input.image.name);
  return apiRequest<CalculationSaveEnvelope>(
    `/api/v1/calculations/save/${encodeURIComponent(priceListId)}`,
    { method: 'POST', body },
  );
}

export interface CalculationSearchQuery {
  search?: string;
  priceListId?: string;
  sort: CalculationSearchSort;
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function listCalculations(
  query: CalculationSearchQuery,
): Promise<CalculationSearchEnvelope> {
  const params = new URLSearchParams({
    sort: query.sort,
    direction: query.direction,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search) params.set('search', query.search);
  if (query.priceListId) params.set('priceListId', query.priceListId);
  return apiRequest<CalculationSearchEnvelope>(`/api/v1/calculations?${params.toString()}`);
}

export function getCalculation(id: string): Promise<CalculationDetailEnvelope> {
  return apiRequest<CalculationDetailEnvelope>(`/api/v1/calculations/${encodeURIComponent(id)}`);
}

export function getCalculationHistory(id: string): Promise<CalculationHistoryEnvelope> {
  return apiRequest<CalculationHistoryEnvelope>(
    `/api/v1/calculations/${encodeURIComponent(id)}/history`,
  );
}
