import type {
  CreatePriceListInput,
  PriceListEnvelope,
  PriceListImportEnvelope,
  PriceListImportPreviewEnvelope,
  PriceListStructureEnvelope,
  PriceListsEnvelope,
  StandaloneProductCatalogEnvelope,
  StandaloneProductPriceEnvelope,
  UpdatePriceListInput,
} from '../../shared/pricing.js';
import { apiRequest } from './api.js';

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function spreadsheet(file: File, expectedFileHash?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
      ...(expectedFileHash ? { 'x-expected-file-hash': expectedFileHash } : {}),
    },
    body: file,
  };
}

export function listPriceLists(): Promise<PriceListsEnvelope> {
  return apiRequest<PriceListsEnvelope>('/api/v1/price-lists');
}

export function getPriceListStructure(
  id: string,
  input: { search?: string; page?: number; pageSize?: number } = {},
): Promise<PriceListStructureEnvelope> {
  const query = new URLSearchParams();
  if (input.search) query.set('search', input.search);
  if (input.page) query.set('page', String(input.page));
  if (input.pageSize) query.set('pageSize', String(input.pageSize));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<PriceListStructureEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/active-version/structure${suffix}`,
  );
}

export function createPriceList(input: CreatePriceListInput): Promise<PriceListEnvelope> {
  return apiRequest<PriceListEnvelope>('/api/v1/price-lists', json('POST', input));
}

export function updatePriceList(
  id: string,
  input: UpdatePriceListInput,
): Promise<PriceListEnvelope> {
  return apiRequest<PriceListEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}`,
    json('PATCH', input),
  );
}

export function setPriceListActive(id: string, active: boolean): Promise<PriceListEnvelope> {
  return apiRequest<PriceListEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`,
    json('POST'),
  );
}

export function setPriceListActiveVersion(
  id: string,
  versionId: string | null,
): Promise<PriceListEnvelope> {
  return apiRequest<PriceListEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/active-version`,
    json('PUT', { versionId }),
  );
}

export function previewPriceListImport(
  id: string,
  file: File,
): Promise<PriceListImportPreviewEnvelope> {
  return apiRequest<PriceListImportPreviewEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/import/preview`,
    spreadsheet(file),
  );
}

export function confirmPriceListImport(
  id: string,
  file: File,
  expectedFileHash: string,
): Promise<PriceListImportEnvelope> {
  return apiRequest<PriceListImportEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/import/confirm`,
    spreadsheet(file, expectedFileHash),
  );
}

export function listStandaloneProducts(
  id: string,
  input: { search?: string; page?: number; pageSize?: number } = {},
): Promise<StandaloneProductCatalogEnvelope> {
  const query = new URLSearchParams();
  if (input.search) query.set('search', input.search);
  if (input.page) query.set('page', String(input.page));
  if (input.pageSize) query.set('pageSize', String(input.pageSize));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<StandaloneProductCatalogEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/products${suffix}`,
  );
}

export function getStandaloneProductPrice(
  id: string,
  code: string,
): Promise<StandaloneProductPriceEnvelope> {
  return apiRequest<StandaloneProductPriceEnvelope>(
    `/api/v1/price-lists/${encodeURIComponent(id)}/products/${encodeURIComponent(code)}/price`,
  );
}
