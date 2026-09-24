import { z } from 'zod';

const customerId = z.string().uuid('Cliente inválido.');

function quantityValues(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as unknown[];
  return [value];
}

const quantities = z.preprocess(
  quantityValues,
  z.array(z.coerce.number().int().min(1).max(10_000_000)).max(500),
);

export const eligibleOrderPriceListsQuerySchema = z.object({
  customerId,
  quantities: quantities.optional().default([]),
});

export const orderCatalogQuerySchema = z.object({
  customerId: customerId.optional(),
  priceListId: z.string().uuid('Lista de preço inválida.').optional(),
  quantities: quantities.optional().default([]),
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const orderSavedCatalogQuerySchema = z.object({
  customerId: customerId.optional(),
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const savedCatalogItemParamsSchema = z.object({
  kind: z.enum(['products', 'kits']),
  id: z.string().uuid('Item salvo inválido.'),
});

const catalogPrice = z
  .string()
  .trim()
  .regex(/^\d{1,11}(?:[.,]\d{1,4})?$/, 'Informe um valor monetário válido.')
  .transform((value) => value.replace(',', '.'));

export const updateSavedCatalogItemSchema = z
  .object({
    description: z.string().trim().min(2, 'Informe uma descrição.').max(255),
    minimumPrice: catalogPrice,
    normalPrice: catalogPrice,
    scope: z.enum(['STANDARD', 'CUSTOMER_SPECIFIC']).optional(),
  })
  .strict()
  .refine((input) => Number(input.minimumPrice) <= Number(input.normalPrice), {
    message: 'O valor mínimo não pode ser maior que o valor normal.',
    path: ['minimumPrice'],
  });

const quoteQuantity = z.number().int().min(1).max(10_000_000);
const productQuoteLineSchema = z.object({
  kind: z.literal('STANDALONE_PRODUCT'),
  productCode: z.string().trim().min(1).max(32),
  priceListVersionId: z.string().uuid('Versão da lista inválida.'),
  quantity: quoteQuantity,
});
const kitQuoteLineSchema = z.object({
  kind: z.literal('KIT'),
  calculationId: z.string().uuid('Cálculo de kit inválido.'),
  priceReference: z.enum(['MINIMUM', 'NORMAL']),
  quantity: quoteQuantity,
});
export const orderQuoteSchema = z
  .object({
    customerId,
    lines: z
      .array(z.discriminatedUnion('kind', [productQuoteLineSchema, kitQuoteLineSchema]))
      .min(1, 'Adicione ao menos um item ao carrinho.')
      .max(500),
  })
  .superRefine((input, context) => {
    const keys = new Set<string>();
    input.lines.forEach((line, index) => {
      const key =
        line.kind === 'STANDALONE_PRODUCT'
          ? `product:${line.priceListVersionId}:${line.productCode}`
          : `kit:${line.calculationId}:${line.priceReference}`;
      if (keys.has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', index],
          message: 'A mesma origem e referência não pode aparecer em duas linhas.',
        });
      keys.add(key);
    });
  });

export type EligibleOrderPriceListsQuery = z.infer<typeof eligibleOrderPriceListsQuerySchema>;
export type OrderCatalogQuery = z.infer<typeof orderCatalogQuerySchema>;
export type OrderSavedCatalogQuery = z.infer<typeof orderSavedCatalogQuerySchema>;
export type OrderQuoteCommand = z.infer<typeof orderQuoteSchema>;
export type SavedCatalogItemParams = z.infer<typeof savedCatalogItemParamsSchema>;
export type UpdateSavedCatalogItemCommand = z.infer<typeof updateSavedCatalogItemSchema>;
