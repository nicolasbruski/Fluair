import { z } from 'zod';

const code = z
  .string()
  .trim()
  .min(1, 'Informe o código do cliente.')
  .max(20, 'O código deve possuir no máximo 20 caracteres.')
  .regex(/^[A-Za-z0-9._/-]+$/, 'Use apenas letras, números, ponto, hífen, barra ou sublinhado.')
  .transform((value) => value.toUpperCase());
const legalName = z
  .string()
  .trim()
  .min(2, 'Informe uma razão social com pelo menos 2 caracteres.')
  .max(180);
const cnpj = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    const digits = value?.replace(/\D/g, '') ?? '';
    if (digits && digits.length !== 14) {
      context.addIssue({ code: 'custom', message: 'Informe um CNPJ com 14 dígitos.' });
      return z.NEVER;
    }
    return digits || null;
  });
const state = z
  .string()
  .trim()
  .max(2, 'Informe a UF com 2 letras.')
  .regex(/^$|^[A-Za-z]{2}$/, 'Informe a UF com 2 letras.')
  .optional()
  .transform((value) => value?.toUpperCase() || null);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);
const optionalNote = z
  .string()
  .trim()
  .max(2000, 'A observação deve possuir no máximo 2.000 caracteres.')
  .optional()
  .transform((value) => value || null);
const classificationId = (label: string) =>
  z
    .union([
      z.literal('').transform(() => null),
      z.string().trim().uuid(`${label} inválido.`),
      z.null(),
    ])
    .optional();
const classificationCode = z
  .union([
    z.literal('').transform(() => null),
    z
      .string()
      .trim()
      .min(1)
      .max(64)
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_]+$/, 'Código de classificação inválido.')),
    z.null(),
  ])
  .optional();

const customerFields = {
  code,
  legalName,
  cnpj,
  city: optionalText(120)
    .optional()
    .transform((value) => value ?? null),
  state,
  segment: optionalText(80),
  customerClassId: classificationId('Classe de cliente'),
  customerClassCode: classificationCode,
  customerSegmentId: classificationId('Segmento de cliente'),
  customerSegmentCode: classificationCode,
  seller: optionalText(120),
  representative: optionalText(120),
  internalNote: optionalNote,
  orderNote: optionalNote,
};

function uniqueClassificationReference(
  input: {
    customerClassId?: string | null | undefined;
    customerClassCode?: string | null | undefined;
    customerSegmentId?: string | null | undefined;
    customerSegmentCode?: string | null | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (input.customerClassId && input.customerClassCode) {
    context.addIssue({
      code: 'custom',
      path: ['customerClassCode'],
      message: 'Informe a classe por ID ou código, não pelos dois.',
    });
  }
  if (input.customerSegmentId && input.customerSegmentCode) {
    context.addIssue({
      code: 'custom',
      path: ['customerSegmentCode'],
      message: 'Informe o segmento por ID ou código, não pelos dois.',
    });
  }
}

export const customerIdSchema = z.object({ id: z.string().uuid('Cliente inválido.') });
export const createCustomerSchema = z
  .object(customerFields)
  .strict()
  .superRefine(uniqueClassificationReference);
export const createCustomerPreRegistrationSchema = z
  .object({
    legalName,
    customerClassId: z.string().uuid('Classe de cliente inválida.'),
    customerSegmentId: z.string().uuid('Segmento de cliente inválido.'),
  })
  .strict();
export const updateCustomerSchema = z
  .object(customerFields)
  .strict()
  .superRefine(uniqueClassificationReference);

export const customerListQuerySchema = z
  .object({
    search: z.string().trim().max(180).optional(),
    customerClassId: z.string().uuid('Classe de cliente inválida.').optional(),
    customerSegmentId: z.string().uuid('Segmento de cliente inválido.').optional(),
    segment: z.string().trim().max(80).optional(),
    seller: z.string().trim().max(120).optional(),
    representative: z.string().trim().max(120).optional(),
    directOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(10).max(100).default(25),
  })
  .strict();

export const customerExportQuerySchema = customerListQuerySchema.omit({
  page: true,
  pageSize: true,
});
