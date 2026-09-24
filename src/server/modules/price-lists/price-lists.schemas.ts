import { z } from 'zod';

import { PRICE_LIST_TYPES } from '../../../shared/pricing.js';

const name = z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(120);
const quantity = z.number().int().min(0).nullable();
const audienceIds = z.array(z.string().uuid('Classificação inválida.')).max(100);

export const priceListIdSchema = z.object({ id: z.string().uuid('Lista de preço inválida.') });

export const standaloneProductParamsSchema = priceListIdSchema.extend({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,31}$/, 'Código de produto inválido.'),
});

export const standaloneProductsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const priceListStructureQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const createPriceListSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_]+$/, 'Use apenas letras, números e sublinhado no código.')
      .transform((value) => value.toUpperCase()),
    name,
    type: z.enum(PRICE_LIST_TYPES),
    active: z.boolean().optional(),
    minimumOrderQuantity: quantity.optional(),
    maximumOrderQuantity: quantity.optional(),
    customerClassIds: audienceIds.optional(),
    customerSegmentIds: audienceIds.optional(),
  })
  .strict();

export const updatePriceListSchema = z
  .object({
    name: name.optional(),
    minimumOrderQuantity: quantity.optional(),
    maximumOrderQuantity: quantity.optional(),
    customerClassIds: audienceIds.optional(),
    customerSegmentIds: audienceIds.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Informe ao menos um campo para alteração.');

export const activeVersionSchema = z
  .object({ versionId: z.string().uuid('Versão inválida.').nullable() })
  .strict();

export const expectedFileHashSchema = z
  .string({ required_error: 'Informe o hash retornado pela prévia.' })
  .trim()
  .regex(/^[a-f0-9]{64}$/i, 'O hash esperado é inválido.')
  .transform((value) => value.toLowerCase());
