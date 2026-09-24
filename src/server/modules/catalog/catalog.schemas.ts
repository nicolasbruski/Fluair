import { z } from 'zod';

import { CATALOG_FILTERS } from '../../../shared/catalog.js';

export const catalogQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  filter: z.enum(CATALOG_FILTERS).optional().default('ALL'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(30),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
