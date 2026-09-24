import type { CatalogEnvelope, CatalogFilter } from '../../shared/catalog.js';
import type { ImageReference } from '../../shared/media.js';
import { apiRequest } from './api.js';

export function loadCatalog(input: {
  search?: string;
  filter?: CatalogFilter;
  page?: number;
  pageSize?: number;
}): Promise<CatalogEnvelope> {
  const query = new URLSearchParams({
    filter: input.filter ?? 'ALL',
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 30),
  });
  if (input.search) query.set('search', input.search);
  return apiRequest<CatalogEnvelope>(`/api/v1/catalog?${query}`);
}

export function uploadCatalogImage(
  kind: 'products' | 'kits',
  entityId: string,
  file: File,
): Promise<{ data: { image: ImageReference } }> {
  return apiRequest(`/api/v1/media/${kind}/${encodeURIComponent(entityId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  });
}

export function removeCatalogImage(kind: 'products' | 'kits', entityId: string): Promise<void> {
  return apiRequest(`/api/v1/media/${kind}/${encodeURIComponent(entityId)}`, { method: 'DELETE' });
}
