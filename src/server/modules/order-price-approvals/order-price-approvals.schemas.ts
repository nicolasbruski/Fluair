import { z } from 'zod';

import { ORDER_PRICE_APPROVAL_STATUSES } from '../../../shared/order-price-approvals.js';
import {
  idempotencyKeySchema,
  kitQuoteLineSchema,
  productQuoteLineSchema,
} from '../orders/orders.schemas.js';

const normalizedText = (minimum: number, maximum: number, label: string) =>
  z
    .string()
    .transform((value) =>
      value
        .replace(/\r\n?/g, '\n')
        .trim()
        .replace(/[ \t]+/g, ' '),
    )
    .pipe(
      z
        .string()
        .min(minimum, `${label} deve possuir ao menos ${minimum} caracteres.`)
        .max(maximum, `${label} deve possuir no máximo ${maximum} caracteres.`),
    );

const optionalNormalizedText = (maximum: number, label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    normalizedText(1, maximum, label).optional(),
  );

export const createOrderPriceApprovalSchema = z
  .object({
    customerId: z.string().uuid('Cliente inválido.'),
    lines: z
      .array(z.discriminatedUnion('kind', [productQuoteLineSchema, kitQuoteLineSchema]))
      .min(1, 'Adicione ao menos um item ao carrinho.')
      .max(500),
    justification: normalizedText(10, 2000, 'A justificativa'),
    supersedesRequestId: z.string().uuid('Solicitação anterior inválida.').optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const keys = new Set<string>();
    input.lines.forEach((line, index) => {
      const key =
        line.kind === 'STANDALONE_PRODUCT'
          ? `product:${line.priceListVersionId}:${line.productCode}`
          : `kit:${line.calculationId}:${line.priceReference}`;
      if (keys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', index],
          message: 'A mesma origem e referência não pode aparecer em duas linhas.',
        });
      }
      keys.add(key);
    });
  });

const dateTimeQuerySchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const myOrderPriceApprovalsQuerySchema = z.object({
  status: z.enum(ORDER_PRICE_APPROVAL_STATUSES).optional(),
  requestedFrom: dateTimeQuerySchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adminOrderPriceApprovalsQuerySchema = z
  .object({
    status: z.enum(ORDER_PRICE_APPROVAL_STATUSES).optional(),
    requestedFrom: dateTimeQuerySchema.optional(),
    requestedTo: dateTimeQuerySchema.optional(),
    requesterId: z.string().uuid('Solicitante inválido.').optional(),
    customerId: z.string().uuid('Cliente inválido.').optional(),
    code: z.string().trim().min(1).max(32).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .superRefine((input, context) => {
    if (input.requestedFrom && input.requestedTo && input.requestedFrom > input.requestedTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestedTo'],
        message: 'A data final deve ser igual ou posterior à data inicial.',
      });
    }
  });

export const orderPriceApprovalIdParamsSchema = z.object({
  id: z.string().uuid('Solicitação inválida.'),
});

export const cancelOrderPriceApprovalSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const approveOrderPriceApprovalSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    note: optionalNormalizedText(2000, 'A observação'),
  })
  .strict();

export const rejectOrderPriceApprovalSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: normalizedText(3, 2000, 'O motivo'),
  })
  .strict();

export { idempotencyKeySchema };

export type CreateOrderPriceApprovalCommand = z.infer<typeof createOrderPriceApprovalSchema>;
export type MyOrderPriceApprovalsQuery = z.infer<typeof myOrderPriceApprovalsQuerySchema>;
export type CancelOrderPriceApprovalCommand = z.infer<typeof cancelOrderPriceApprovalSchema>;
export type AdminOrderPriceApprovalsQuery = z.infer<typeof adminOrderPriceApprovalsQuerySchema>;
export type ApproveOrderPriceApprovalCommand = z.infer<typeof approveOrderPriceApprovalSchema>;
export type RejectOrderPriceApprovalCommand = z.infer<typeof rejectOrderPriceApprovalSchema>;
