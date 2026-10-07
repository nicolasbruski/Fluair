import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import type {
  CanonicalOrderPriceApprovalContent,
  OrderPriceApprovalItemSnapshot,
} from '../../../shared/order-price-approvals.js';
import type { OrderQuoteEnvelope } from '../../../shared/orders.js';

export const ORDER_PRICE_APPROVAL_HASH_VERSION = 1;

export class InvalidOrderPriceApprovalContentError extends Error {
  readonly code = 'ORDER_PRICE_APPROVAL_INVALID_CONTENT';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrderPriceApprovalContentError';
  }
}

function fixedDecimal(value: string, field: string): string {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite() || parsed.isNegative()) throw new Error('invalid');
    return parsed.toFixed(4);
  } catch {
    throw new InvalidOrderPriceApprovalContentError(`${field} deve ser decimal não negativo.`);
  }
}

function lineIdentity(item: OrderPriceApprovalItemSnapshot): string {
  return [
    item.kind,
    item.code,
    item.sourceProductId ?? '',
    item.sourceKitId ?? '',
    item.sourceCalculationVersionId ?? '',
    item.priceList.id,
    item.sourcePriceListVersionId,
    item.priceReference,
  ].join('\u001f');
}

function canonicalLine(item: OrderPriceApprovalItemSnapshot) {
  return {
    kind: item.kind,
    code: item.code,
    sourceProductId: item.sourceProductId,
    sourceKitId: item.sourceKitId,
    sourceCalculationVersionId: item.sourceCalculationVersionId,
    sourcePriceListId: item.priceList.id,
    sourcePriceListVersionId: item.sourcePriceListVersionId,
    sourcePriceListVersion: item.priceList.version,
    minimumOrderQuantity: item.priceList.minimumOrderQuantity,
    maximumOrderQuantity: item.priceList.maximumOrderQuantity,
    calculationVersion: item.calculationVersion,
    priceReference: item.priceReference,
    quantity: fixedDecimal(item.quantity, 'quantity'),
    minimumUnitPrice: fixedDecimal(item.minimumUnitPrice, 'minimumUnitPrice'),
    referenceUnitPrice: fixedDecimal(item.referenceUnitPrice, 'referenceUnitPrice'),
    negotiatedUnitPrice: fixedDecimal(item.negotiatedUnitPrice, 'negotiatedUnitPrice'),
    finalUnitPrice: fixedDecimal(
      item.finalUnitPrice ?? item.negotiatedUnitPrice,
      'finalUnitPrice',
    ),
    taxes: item.taxes ?? null,
    minimumSubtotal: fixedDecimal(item.minimumSubtotal, 'minimumSubtotal'),
    negotiatedSubtotal: fixedDecimal(item.negotiatedSubtotal, 'negotiatedSubtotal'),
  };
}

export function canonicalizeOrderPriceApprovalContent(
  content: CanonicalOrderPriceApprovalContent,
): string {
  if (content.items.length === 0) {
    throw new InvalidOrderPriceApprovalContentError('O conteúdo deve possuir ao menos uma linha.');
  }

  const identities = content.items.map(lineIdentity);
  if (new Set(identities).size !== identities.length) {
    throw new InvalidOrderPriceApprovalContentError('O conteúdo possui uma origem duplicada.');
  }

  const items = content.items
    .map((item) => ({ identity: lineIdentity(item), value: canonicalLine(item) }))
    .sort((left, right) => left.identity.localeCompare(right.identity))
    .map(({ value }) => value);

  return JSON.stringify({
    hashVersion: ORDER_PRICE_APPROVAL_HASH_VERSION,
    requesterId: content.requesterId,
    customerId: content.customerId,
    customerClassId: content.customerClassId,
    customerSegmentId: content.customerSegmentId,
    items,
    totalQuantity: fixedDecimal(content.totalQuantity, 'totalQuantity'),
    minimumTotalAmount: fixedDecimal(content.minimumTotalAmount, 'minimumTotalAmount'),
    requestedTotalAmount: fixedDecimal(content.requestedTotalAmount, 'requestedTotalAmount'),
  });
}

export function hashOrderPriceApprovalContent(content: CanonicalOrderPriceApprovalContent): {
  hash: string;
  version: number;
  canonical: string;
} {
  const canonical = canonicalizeOrderPriceApprovalContent(content);
  return {
    hash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    version: ORDER_PRICE_APPROVAL_HASH_VERSION,
    canonical,
  };
}

export function approvalContentFromQuote(
  quote: OrderQuoteEnvelope['data'],
  requesterId: string,
): {
  content: CanonicalOrderPriceApprovalContent;
  exceptionAmount: string;
} {
  let minimumTotal = new Prisma.Decimal(0);
  let exceptionAmount = new Prisma.Decimal(0);
  const items: OrderPriceApprovalItemSnapshot[] = quote.lines.map((line, index) => {
    const quantity = new Prisma.Decimal(line.quantity);
    const minimum = new Prisma.Decimal(line.minimumReferencePrice);
    const negotiated = new Prisma.Decimal(line.negotiatedUnitPrice);
    const unitException = Prisma.Decimal.max(minimum.minus(negotiated), 0);
    minimumTotal = minimumTotal.add(minimum.mul(quantity));
    exceptionAmount = exceptionAmount.add(unitException.mul(quantity));
    return {
      lineNumber: index + 1,
      kind: line.kind,
      requiresApproval: negotiated.lessThan(minimum),
      sourceProductId: line.kind === 'STANDALONE_PRODUCT' ? line.productId : null,
      sourceKitId: line.kind === 'KIT' ? line.kitId : null,
      sourceCalculationVersionId: line.kind === 'KIT' ? line.calculationId : null,
      sourcePriceListVersionId: line.priceListVersion.id,
      priceList: {
        id: line.priceList.id,
        code: line.priceList.code,
        name: line.priceList.name,
        type: line.kind === 'KIT' ? line.priceList.type : 'STANDALONE_PRODUCT',
        version: line.priceListVersion.version,
        minimumOrderQuantity: line.priceList.minimumOrderQuantity,
        maximumOrderQuantity: line.priceList.maximumOrderQuantity,
      },
      calculationVersion: line.kind === 'KIT' ? line.calculationVersion : null,
      priceReference: line.kind === 'KIT' ? line.priceReference : 'UNIT',
      code: line.kind === 'KIT' ? line.code : line.productCode,
      description: line.description,
      reference: line.kind === 'STANDALONE_PRODUCT' ? line.reference : null,
      unit: line.kind === 'STANDALONE_PRODUCT' ? line.unit : null,
      quantity: quantity.toFixed(4),
      referenceUnitPrice: line.referenceUnitPrice,
      minimumUnitPrice: minimum.toFixed(4),
      negotiatedUnitPrice: negotiated.toFixed(4),
      finalUnitPrice: line.finalUnitPrice,
      taxes: line.taxes,
      minimumSubtotal: minimum.mul(quantity).toFixed(4),
      negotiatedSubtotal: negotiated.mul(quantity).toFixed(4),
      exceptionUnitAmount: unitException.toFixed(4),
      exceptionTotalAmount: unitException.mul(quantity).toFixed(4),
      pisRate: line.pisRate,
      cofinsRate: line.cofinsRate,
      ipiRate: line.ipiRate,
      icmsRate: line.icmsRate,
    };
  });

  return {
    content: {
      requesterId,
      customerId: quote.customer.id,
      customerClassId: quote.customer.customerClassId,
      customerSegmentId: quote.customer.customerSegmentId,
      items,
      totalQuantity: new Prisma.Decimal(quote.totalQuantity).toFixed(4),
      minimumTotalAmount: minimumTotal.toFixed(4),
      requestedTotalAmount: new Prisma.Decimal(quote.total).toFixed(4),
    },
    exceptionAmount: exceptionAmount.toFixed(4),
  };
}
