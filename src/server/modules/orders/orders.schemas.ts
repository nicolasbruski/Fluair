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

const lastSalePriceLineSchema = z.discriminatedUnion('kind', [
  z
    .object({
      key: z.string().min(1).max(300),
      kind: z.literal('STANDALONE_PRODUCT'),
      productCode: z.string().trim().min(1).max(32),
    })
    .strict(),
  z
    .object({
      key: z.string().min(1).max(300),
      kind: z.literal('KIT'),
      calculationId: z.string().uuid('Cálculo de kit inválido.'),
    })
    .strict(),
]);

export const orderLastSalePricesSchema = z
  .object({
    customerId,
    lines: z.array(lastSalePriceLineSchema).max(500),
  })
  .strict()
  .superRefine((input, context) => {
    const keys = new Set<string>();
    input.lines.forEach((line, index) => {
      if (keys.has(line.key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', index, 'key'],
          message: 'A chave da linha deve ser única.',
        });
      keys.add(line.key);
    });
  });

const draftMoney = z.number().finite().min(0).max(999_999_999_999);
const draftRate = z.number().finite().min(0).max(100);
const draftImageSchema = z
  .object({
    id: z.string().uuid(),
    thumbnailUrl: z.string().max(500),
    displayUrl: z.string().max(500),
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .nullable();

const orderDraftCartItemSchema = z
  .object({
    key: z.string().min(1).max(300),
    kind: z.enum(['KIT', 'STANDALONE_PRODUCT']),
    code: z.string().min(1).max(32),
    description: z.string().max(255),
    price: draftMoney,
    taxRate: draftRate,
    referencePrice: draftMoney,
    priceEdited: z.boolean(),
    priceReference: z.enum(['MINIMUM', 'NORMAL', 'UNIT']),
    source: z.string().max(500),
    sourceVersionId: z.string().uuid(),
    priceListName: z.string().max(120).optional(),
    priceListVersion: z.number().int().positive().optional(),
    minimumOrderQuantity: z.number().int().positive().nullable().optional(),
    maximumOrderQuantity: z.number().int().positive().nullable().optional(),
    calculatedAt: z.string().datetime().optional(),
    minimumPrice: draftMoney.optional(),
    normalPrice: draftMoney.optional(),
    priceRanges: z
      .array(
        z
          .object({
            list: z.string().max(180),
            minimumPrice: draftMoney,
            maximumPrice: draftMoney,
            ipiRate: draftRate,
            icmsRate: draftRate,
          })
          .strict(),
      )
      .max(50)
      .optional(),
    ipiRate: draftRate.optional(),
    icmsRate: draftRate.optional(),
    calculationId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(10_000_000),
    image: draftImageSchema,
  })
  .strict()
  .superRefine((item, context) => {
    if (item.kind === 'KIT' && (!item.calculationId || item.priceReference === 'UNIT')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O item de kit salvo possui uma origem invÃ¡lida.',
      });
    }
    if (item.kind === 'STANDALONE_PRODUCT' && item.priceReference !== 'UNIT') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O produto salvo possui uma referÃªncia invÃ¡lida.',
      });
    }
  });

export const orderDraftPayloadSchema = z
  .object({
    note: z.string().max(4000),
    cart: z.array(orderDraftCartItemSchema).min(1).max(500),
    approvalRequestId: z.string().uuid().optional(),
  })
  .strict();

export const orderDraftSwapSchema = z
  .object({
    targetCustomerId: customerId,
    current: z
      .object({
        customerId,
        payload: orderDraftPayloadSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((input) => input.current?.customerId !== input.targetCustomerId, {
    message: 'O cliente atual deve ser diferente do cliente de destino.',
    path: ['targetCustomerId'],
  });

export const orderDraftSaveSchema = z
  .object({
    customerId,
    payload: orderDraftPayloadSchema,
  })
  .strict();

export const deleteOrderDraftQuerySchema = z.object({
  customerId: customerId.optional(),
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
const negotiatedPrice = z
  .string()
  .trim()
  .regex(/^\d{1,11}(?:[.,]\d{1,4})?$/, 'Informe um preço negociado válido.')
  .transform((value) => value.replace(',', '.'));
export const productQuoteLineSchema = z.object({
  kind: z.literal('STANDALONE_PRODUCT'),
  productCode: z.string().trim().min(1).max(32),
  priceListVersionId: z.string().uuid('Versão da lista inválida.'),
  quantity: quoteQuantity,
  negotiatedUnitPrice: negotiatedPrice.optional(),
});
export const kitQuoteLineSchema = z.object({
  kind: z.literal('KIT'),
  calculationId: z.string().uuid('Cálculo de kit inválido.'),
  priceReference: z.enum(['MINIMUM', 'NORMAL']),
  quantity: quoteQuantity,
  negotiatedUnitPrice: negotiatedPrice.optional(),
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

const creationProductLineSchema = productQuoteLineSchema.extend({
  negotiatedUnitPrice: negotiatedPrice,
});
const creationKitLineSchema = kitQuoteLineSchema.extend({ negotiatedUnitPrice: negotiatedPrice });

export const createOrderSchema = z
  .object({
    customerId,
    lines: z
      .array(z.discriminatedUnion('kind', [creationProductLineSchema, creationKitLineSchema]))
      .min(1, 'Adicione ao menos um item ao carrinho.')
      .max(500),
    note: z
      .string()
      .transform((value) => value.replace(/\r\n?/g, '\n').trim())
      .pipe(z.string().max(4000, 'A observação deve possuir no máximo 4000 caracteres.'))
      .optional()
      .default(''),
    quoteToken: z.string().min(40).max(1000),
    approvalRequestId: z.string().uuid('Solicitação de aprovação inválida.').optional(),
  })
  .strict()
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

export const idempotencyKeySchema = z
  .string({ required_error: 'Informe o header Idempotency-Key.' })
  .trim()
  .min(16, 'Idempotency-Key deve possuir ao menos 16 caracteres.')
  .max(128, 'Idempotency-Key deve possuir no máximo 128 caracteres.')
  .regex(/^[A-Za-z0-9._:-]+$/, 'Idempotency-Key possui formato inválido.');

export const orderIdParamsSchema = z.object({ id: z.string().uuid('Pedido inválido.') });

export type EligibleOrderPriceListsQuery = z.infer<typeof eligibleOrderPriceListsQuerySchema>;
export type OrderCatalogQuery = z.infer<typeof orderCatalogQuerySchema>;
export type OrderSavedCatalogQuery = z.infer<typeof orderSavedCatalogQuerySchema>;
export type OrderLastSalePricesCommand = z.infer<typeof orderLastSalePricesSchema>;
export type OrderQuoteCommand = z.infer<typeof orderQuoteSchema>;
export type CreateOrderCommand = z.infer<typeof createOrderSchema>;
export type SavedCatalogItemParams = z.infer<typeof savedCatalogItemParamsSchema>;
export type UpdateSavedCatalogItemCommand = z.infer<typeof updateSavedCatalogItemSchema>;
export type OrderDraftPayloadCommand = z.infer<typeof orderDraftPayloadSchema>;
export type OrderDraftSwapCommand = z.infer<typeof orderDraftSwapSchema>;
export type OrderDraftSaveCommand = z.infer<typeof orderDraftSaveSchema>;
