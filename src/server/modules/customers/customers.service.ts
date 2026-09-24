import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import type {
  Customer,
  CustomerClassificationsEnvelope,
  CustomerCalculationLinksEnvelope,
  CustomerEnvelope,
  CustomersEnvelope,
  CustomersExportEnvelope,
} from '../../../shared/customers.js';
import { AppError } from '../../errors/app-error.js';
import type {
  CustomerCommandData,
  CustomerClassificationLookup,
  CustomerListQuery,
  CustomerMutationResult,
  CustomerPreRegistrationData,
  CustomerRecord,
  CustomerWriteData,
  CustomersRepository,
} from './customers.types.js';

export interface CustomerMutationContext {
  actor: AuthenticatedUser;
  requestId: string;
}

function publicCustomer(customer: CustomerRecord): Customer {
  return {
    ...customer,
    customerClass: customer.customerClass
      ? {
          id: customer.customerClass.id,
          code: customer.customerClass.code,
          name: customer.customerClass.name,
          active: customer.customerClass.active,
        }
      : null,
    customerSegment: customer.customerSegment
      ? {
          id: customer.customerSegment.id,
          code: customer.customerSegment.code,
          name: customer.customerSegment.name,
          active: customer.customerSegment.active,
        }
      : null,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

function mutationError(result: Exclude<CustomerMutationResult, { outcome: 'success' }>): AppError {
  return result.outcome === 'not_found'
    ? new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.')
    : new AppError(409, 'CUSTOMER_CODE_ALREADY_USED', 'Já existe um cliente com este código.', {
        code: ['Este código já está sendo utilizado.'],
      });
}

function normalize(input: CustomerCommandData): CustomerWriteData {
  const optional = (value: string | null | undefined): string | null => value?.trim() || null;
  return {
    code: input.code.trim().toUpperCase(),
    legalName: input.legalName.trim(),
    cnpj: optional(input.cnpj)?.replace(/\D/g, '') ?? null,
    city: optional(input.city),
    state: optional(input.state)?.toUpperCase() ?? null,
    segment: optional(input.segment),
    seller: optional(input.seller),
    representative: optional(input.representative),
    internalNote: optional(input.internalNote),
    orderNote: optional(input.orderNote),
  };
}

type ClassificationKind = 'class' | 'segment';

function classificationError(
  kind: ClassificationKind,
  state: 'not_found' | 'inactive',
  field: string,
): AppError {
  const label = kind === 'class' ? 'Classe' : 'Segmento';
  return new AppError(
    422,
    `CUSTOMER_${kind === 'class' ? 'CLASS' : 'SEGMENT'}_${state === 'not_found' ? 'NOT_FOUND' : 'INACTIVE'}`,
    state === 'not_found'
      ? `${label} de cliente não encontrado.`
      : `${label} de cliente está inativo.`,
    { [field]: [state === 'not_found' ? `${label} inexistente.` : `${label} inativo.`] },
  );
}

export class CustomersService {
  constructor(private readonly repository: CustomersRepository) {}

  private async resolveClassification(
    kind: ClassificationKind,
    id: string | null | undefined,
    code: string | null | undefined,
  ): Promise<string | null | undefined> {
    const hasReference = id !== undefined || code !== undefined;
    const reference: CustomerClassificationLookup | null = id
      ? { id }
      : code
        ? { code: code.trim().toUpperCase() }
        : null;
    if (!reference) return hasReference ? null : undefined;

    const classification =
      kind === 'class'
        ? await this.repository.findCustomerClass(reference)
        : await this.repository.findCustomerSegment(reference);
    const field = id
      ? `customer${kind === 'class' ? 'Class' : 'Segment'}Id`
      : `customer${kind === 'class' ? 'Class' : 'Segment'}Code`;
    if (!classification) throw classificationError(kind, 'not_found', field);
    if (!classification.active) throw classificationError(kind, 'inactive', field);
    return classification.id;
  }

  private async normalizeAndResolve(input: CustomerCommandData): Promise<CustomerWriteData> {
    const normalized = normalize(input);
    const [customerClassId, customerSegmentId] = await Promise.all([
      this.resolveClassification('class', input.customerClassId, input.customerClassCode),
      this.resolveClassification('segment', input.customerSegmentId, input.customerSegmentCode),
    ]);

    return {
      ...normalized,
      ...(customerClassId !== undefined ? { customerClassId } : {}),
      ...(customerSegmentId !== undefined ? { customerSegmentId } : {}),
    };
  }

  async classifications(): Promise<CustomerClassificationsEnvelope> {
    const classifications = await this.repository.listActiveClassifications();
    return { data: classifications };
  }

  async list(query: CustomerListQuery): Promise<CustomersEnvelope> {
    const result = await this.repository.list(query);
    return {
      data: {
        customers: result.customers.map(publicCustomer),
        filters: result.filters,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
        },
      },
    };
  }

  async get(id: string): Promise<CustomerEnvelope> {
    const customer = await this.repository.findById(id);
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente nÃ£o encontrado.');
    return { data: { customer: publicCustomer(customer) } };
  }

  async export(
    query: Omit<CustomerListQuery, 'page' | 'pageSize'>,
  ): Promise<CustomersExportEnvelope> {
    const customers = await this.repository.listForExport(query);
    return { data: { customers: customers.map(publicCustomer) } };
  }

  async calculationLinks(id: string): Promise<CustomerCalculationLinksEnvelope> {
    const data = await this.repository.calculationLinks(id);
    if (!data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    return { data };
  }

  async create(
    command: CustomerCommandData,
    context: CustomerMutationContext,
  ): Promise<CustomerEnvelope> {
    const data = await this.normalizeAndResolve(command);
    const result = await this.repository.create({
      ...data,
      audit: {
        actorUserId: context.actor.id,
        action: 'CUSTOMER_CREATED',
        entityType: 'customer',
        entityId: null,
        metadata: {
          code: data.code,
          customerClassId: data.customerClassId ?? null,
          customerSegmentId: data.customerSegmentId ?? null,
        },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return { data: { customer: publicCustomer(result.customer) } };
  }

  async preRegister(
    input: CustomerPreRegistrationData,
    context: CustomerMutationContext,
  ): Promise<CustomerEnvelope> {
    const provisionalCode = `PRE-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    const data = await this.normalizeAndResolve({
      code: provisionalCode,
      legalName: input.legalName,
      cnpj: null,
      city: null,
      state: null,
      segment: null,
      customerClassId: input.customerClassId,
      customerSegmentId: input.customerSegmentId,
      seller: null,
      representative: null,
      internalNote: null,
      orderNote: null,
    });
    const result = await this.repository.create({
      ...data,
      audit: {
        actorUserId: context.actor.id,
        action: 'CUSTOMER_PRE_REGISTERED',
        entityType: 'customer',
        entityId: null,
        metadata: {
          code: data.code,
          customerClassId: data.customerClassId ?? null,
          customerSegmentId: data.customerSegmentId ?? null,
        },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return { data: { customer: publicCustomer(result.customer) } };
  }

  async update(
    id: string,
    command: CustomerCommandData,
    context: CustomerMutationContext,
  ): Promise<CustomerEnvelope> {
    const data = await this.normalizeAndResolve(command);
    const result = await this.repository.update({
      id,
      ...data,
      audit: {
        actorUserId: context.actor.id,
        action: 'CUSTOMER_UPDATED',
        entityType: 'customer',
        entityId: id,
        metadata: {
          code: data.code,
          ...(data.customerClassId !== undefined ? { customerClassId: data.customerClassId } : {}),
          ...(data.customerSegmentId !== undefined
            ? { customerSegmentId: data.customerSegmentId }
            : {}),
        },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return { data: { customer: publicCustomer(result.customer) } };
  }

  async setActive(
    id: string,
    active: boolean,
    context: CustomerMutationContext,
  ): Promise<CustomerEnvelope> {
    const result = await this.repository.setActive({
      id,
      active,
      audit: {
        actorUserId: context.actor.id,
        action: active ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED',
        entityType: 'customer',
        entityId: id,
        metadata: { active },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return { data: { customer: publicCustomer(result.customer) } };
  }
}
