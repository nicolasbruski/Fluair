import { z } from 'zod';

export const calculationListQuerySchema = z
  .object({
    search: z.string().trim().max(255).optional(),
    priceListId: z.string().uuid('Perfil de preço inválido.').optional(),
    sort: z
      .enum([
        'code',
        'description',
        'reference',
        'priceList',
        'minimumTotal',
        'normalTotal',
        'createdAt',
      ])
      .default('createdAt'),
    direction: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(10).max(100).default(30),
  })
  .strict();

export type CalculationListQuery = z.infer<typeof calculationListQuerySchema>;

export const calculationIdSchema = z.object({
  id: z.string().uuid('Cálculo inválido.'),
});
