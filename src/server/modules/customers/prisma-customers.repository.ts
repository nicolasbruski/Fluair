import { Prisma, type PrismaClient } from '@prisma/client';

import type { AuditInput } from '../auth/auth.types.js';
import type {
  CreateCustomerInput,
  CustomerClassificationsResult,
  CustomerClassificationLookup,
  CustomerListQuery,
  CustomerListResult,
  CustomerMutationResult,
  CustomerRecord,
  CustomersRepository,
  SetCustomerActiveInput,
  UpdateCustomerInput,
} from './customers.types.js';

const customerRelations = {
  customerClass: true,
  customerSegment: true,
} satisfies Prisma.CustomerInclude;

function where(query: Omit<CustomerListQuery, 'page' | 'pageSize'>): Prisma.CustomerWhereInput {
  return {
    ...(query.status === 'all' ? {} : { active: query.status === 'active' }),
    ...(query.customerClassId ? { customerClassId: query.customerClassId } : {}),
    ...(query.customerSegmentId ? { customerSegmentId: query.customerSegmentId } : {}),
    ...(query.segment ? { segment: query.segment } : {}),
    ...(query.seller ? { seller: query.seller } : {}),
    ...(query.directOnly
      ? { representative: null }
      : query.representative
        ? { representative: query.representative }
        : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { legalName: { contains: query.search } },
            { cnpj: { contains: query.search.replace(/\D/g, '') || query.search } },
            { city: { contains: query.search } },
            { state: { contains: query.search } },
            { segment: { contains: query.search } },
            { seller: { contains: query.search } },
            { representative: { contains: query.search } },
          ],
        }
      : {}),
  };
}

function auditData(audit: AuditInput, entityId: string) {
  return {
    actorUserId: audit.actorUserId,
    action: audit.action,
    entityType: audit.entityType,
    entityId,
    requestId: audit.requestId,
    ...(audit.metadata ? { metadata: audit.metadata } : {}),
  };
}

function codeConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function facets(prisma: PrismaClient): Promise<CustomerListResult['filters']> {
  const [segments, sellers, representatives] = await Promise.all([
    prisma.customer.findMany({
      where: { segment: { not: null } },
      distinct: ['segment'],
      select: { segment: true },
      orderBy: { segment: 'asc' },
    }),
    prisma.customer.findMany({
      where: { seller: { not: null } },
      distinct: ['seller'],
      select: { seller: true },
      orderBy: { seller: 'asc' },
    }),
    prisma.customer.findMany({
      where: { representative: { not: null } },
      distinct: ['representative'],
      select: { representative: true },
      orderBy: { representative: 'asc' },
    }),
  ]);
  return {
    segments: segments.flatMap((item) => (item.segment ? [item.segment] : [])),
    sellers: sellers.flatMap((item) => (item.seller ? [item.seller] : [])),
    representatives: representatives.flatMap((item) =>
      item.representative ? [item.representative] : [],
    ),
  };
}

export class PrismaCustomersRepository implements CustomersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listActiveClassifications(): Promise<CustomerClassificationsResult> {
    const select = { id: true, code: true, name: true, active: true } as const;
    const [customerClasses, customerSegments] = await Promise.all([
      this.prisma.customerClass.findMany({
        where: { active: true },
        select,
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.customerSegment.findMany({
        where: { active: true },
        select,
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
      }),
    ]);
    return { customerClasses, customerSegments };
  }

  async findCustomerClass(reference: CustomerClassificationLookup) {
    return this.prisma.customerClass.findUnique({
      where: 'id' in reference ? { id: reference.id } : { code: reference.code },
    });
  }

  async findCustomerSegment(reference: CustomerClassificationLookup) {
    return this.prisma.customerSegment.findUnique({
      where: 'id' in reference ? { id: reference.id } : { code: reference.code },
    });
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    return this.prisma.customer.findUnique({ where: { id }, include: customerRelations });
  }

  async list(query: CustomerListQuery): Promise<CustomerListResult> {
    const criteria = where(query);
    const [customers, total, filters] = await Promise.all([
      this.prisma.customer.findMany({
        where: criteria,
        include: customerRelations,
        orderBy: [{ active: 'desc' }, { legalName: 'asc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where: criteria }),
      facets(this.prisma),
    ]);
    return { customers, total, filters };
  }

  async listForExport(
    query: Omit<CustomerListQuery, 'page' | 'pageSize'>,
  ): Promise<CustomerRecord[]> {
    return this.prisma.customer.findMany({
      where: where(query),
      include: customerRelations,
      orderBy: [{ legalName: 'asc' }, { code: 'asc' }],
    });
  }

  async calculationLinks(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        legalName: true,
        calculationLinks: {
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            classNameSnapshot: true,
            linkedBy: { select: { name: true } },
            calculationVersion: {
              select: {
                id: true,
                version: true,
                current: true,
                kitDescription: true,
                series: { select: { kit: { select: { code: true } }, priceList: true } },
                items: {
                  orderBy: { lineNumber: 'asc' },
                  select: {
                    id: true,
                    productCode: true,
                    description: true,
                    quantity: true,
                    unit: true,
                    minimumUnitPrice: true,
                    normalUnitPrice: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!customer) return null;
    return {
      customer: { id: customer.id, code: customer.code, legalName: customer.legalName },
      calculations: customer.calculationLinks.map((link) => ({
        calculationId: link.calculationVersion.id,
        version: link.calculationVersion.version,
        current: link.calculationVersion.current,
        kitCode: link.calculationVersion.series.kit.code,
        kitDescription: link.calculationVersion.kitDescription,
        priceListName: link.calculationVersion.series.priceList.name,
        className: link.classNameSnapshot,
        linkedAt: link.createdAt.toISOString(),
        linkedBy: link.linkedBy.name,
        items: link.calculationVersion.items.map((item) => ({
          id: item.id,
          code: item.productCode,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          minimumUnitPrice: item.minimumUnitPrice.toFixed(4),
          normalUnitPrice: item.normalUnitPrice.toFixed(4),
        })),
      })),
    };
  }

  async create(input: CreateCustomerInput): Promise<CustomerMutationResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const customer = await transaction.customer.create({
          data: {
            code: input.code,
            legalName: input.legalName,
            cnpj: input.cnpj,
            city: input.city,
            state: input.state,
            segment: input.segment,
            customerClassId: input.customerClassId ?? null,
            customerSegmentId: input.customerSegmentId ?? null,
            seller: input.seller,
            representative: input.representative,
            internalNote: input.internalNote,
            orderNote: input.orderNote,
          },
          include: customerRelations,
        });
        await transaction.auditLog.create({ data: auditData(input.audit, customer.id) });
        return { outcome: 'success', customer } as const;
      });
    } catch (error) {
      if (codeConflict(error)) return { outcome: 'code_conflict' };
      throw error;
    }
  }

  async update(input: UpdateCustomerInput): Promise<CustomerMutationResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.customer.findUnique({ where: { id: input.id } });
        if (!current) return { outcome: 'not_found' } as const;
        const customer = await transaction.customer.update({
          where: { id: input.id },
          data: {
            code: input.code,
            legalName: input.legalName,
            cnpj: input.cnpj,
            city: input.city,
            state: input.state,
            segment: input.segment,
            ...(input.customerClassId !== undefined
              ? { customerClassId: input.customerClassId }
              : {}),
            ...(input.customerSegmentId !== undefined
              ? { customerSegmentId: input.customerSegmentId }
              : {}),
            seller: input.seller,
            representative: input.representative,
            internalNote: input.internalNote,
            orderNote: input.orderNote,
          },
          include: customerRelations,
        });
        await transaction.auditLog.create({ data: auditData(input.audit, customer.id) });
        return { outcome: 'success', customer } as const;
      });
    } catch (error) {
      if (codeConflict(error)) return { outcome: 'code_conflict' };
      throw error;
    }
  }

  async setActive(input: SetCustomerActiveInput): Promise<CustomerMutationResult> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.customer.findUnique({
        where: { id: input.id },
        include: customerRelations,
      });
      if (!current) return { outcome: 'not_found' } as const;
      if (current.active === input.active)
        return { outcome: 'success', customer: current } as const;
      const customer = await transaction.customer.update({
        where: { id: input.id },
        data: { active: input.active },
        include: customerRelations,
      });
      await transaction.auditLog.create({ data: auditData(input.audit, customer.id) });
      return { outcome: 'success', customer } as const;
    });
  }
}
