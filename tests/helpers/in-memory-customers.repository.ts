import type { AuditInput } from '../../src/server/modules/auth/auth.types.js';
import type {
  CreateCustomerInput,
  CustomerClassificationLookup,
  CustomerListQuery,
  CustomerListResult,
  CustomerMutationResult,
  CustomerRecord,
  CustomersRepository,
  SetCustomerActiveInput,
  UpdateCustomerInput,
} from '../../src/server/modules/customers/customers.types.js';

const now = new Date('2026-08-02T12:00:00.000Z');

export const customerClasses = {
  implementer: {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'IMPLEMENTER',
    name: 'Implementador',
    active: true,
  },
  endConsumer: {
    id: '30000000-0000-4000-8000-000000000003',
    code: 'END_CONSUMER',
    name: 'Consumidor Final',
    active: true,
  },
  inactiveReseller: {
    id: '30000000-0000-4000-8000-000000000002',
    code: 'RESELLER',
    name: 'Revenda',
    active: false,
  },
} as const;

export const customerSegments = {
  fleetOwner: {
    id: '40000000-0000-4000-8000-000000000001',
    code: 'FLEET_OWNER',
    name: 'Frotista',
    active: true,
  },
  autoParts: {
    id: '40000000-0000-4000-8000-000000000003',
    code: 'AUTO_PARTS',
    name: 'Autopeças',
    active: true,
  },
  inactiveServiceStation: {
    id: '40000000-0000-4000-8000-000000000002',
    code: 'SERVICE_STATION',
    name: 'Posto de Serviço',
    active: false,
  },
} as const;

export const sampleCustomer: CustomerRecord = {
  id: '10000000-0000-4000-8000-000000000001',
  code: 'C01619',
  legalName: 'Expresso Figueiredo',
  cnpj: '12345678000190',
  city: 'São Paulo',
  state: 'SP',
  segment: 'FROTISTA',
  customerClass: customerClasses.implementer,
  customerSegment: customerSegments.fleetOwner,
  seller: 'Marcelo Ort',
  representative: null,
  internalNote: 'Cliente com atendimento prioritário.',
  orderNote: 'Entregar somente no período da manhã.',
  active: true,
  createdAt: now,
  updatedAt: now,
};

function matches(customer: CustomerRecord, query: Omit<CustomerListQuery, 'page' | 'pageSize'>) {
  if (query.status !== 'all' && customer.active !== (query.status === 'active')) return false;
  if (query.customerClassId && customer.customerClass?.id !== query.customerClassId) return false;
  if (query.customerSegmentId && customer.customerSegment?.id !== query.customerSegmentId)
    return false;
  if (query.segment && customer.segment !== query.segment) return false;
  if (query.seller && customer.seller !== query.seller) return false;
  if (query.directOnly && customer.representative) return false;
  if (query.representative && customer.representative !== query.representative) return false;
  if (query.search) {
    const haystack = [
      customer.code,
      customer.legalName,
      customer.cnpj,
      customer.city,
      customer.state,
      customer.segment,
      customer.seller,
      customer.representative,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('pt-BR');
    if (!haystack.includes(query.search.toLocaleLowerCase('pt-BR'))) return false;
  }
  return true;
}

export class InMemoryCustomersRepository implements CustomersRepository {
  readonly customers = new Map<string, CustomerRecord>();
  readonly audits: AuditInput[] = [];

  constructor() {
    this.customers.set(sampleCustomer.id, structuredClone(sampleCustomer));
  }

  async listActiveClassifications() {
    const byName = (left: { name: string }, right: { name: string }) =>
      left.name.localeCompare(right.name, 'pt-BR');
    return {
      customerClasses: Object.values(customerClasses)
        .filter((classification) => classification.active)
        .sort(byName),
      customerSegments: Object.values(customerSegments)
        .filter((classification) => classification.active)
        .sort(byName),
    };
  }

  async findCustomerClass(reference: CustomerClassificationLookup) {
    return (
      Object.values(customerClasses).find((classification) =>
        'id' in reference
          ? classification.id === reference.id
          : classification.code === reference.code,
      ) ?? null
    );
  }

  async findCustomerSegment(reference: CustomerClassificationLookup) {
    return (
      Object.values(customerSegments).find((classification) =>
        'id' in reference
          ? classification.id === reference.id
          : classification.code === reference.code,
      ) ?? null
    );
  }

  async findById(id: string) {
    return structuredClone(this.customers.get(id) ?? null);
  }

  async list(query: CustomerListQuery): Promise<CustomerListResult> {
    const matched = [...this.customers.values()].filter((customer) => matches(customer, query));
    const start = (query.page - 1) * query.pageSize;
    const all = [...this.customers.values()];
    return {
      customers: structuredClone(matched.slice(start, start + query.pageSize)),
      total: matched.length,
      filters: {
        segments: [...new Set(all.flatMap((item) => (item.segment ? [item.segment] : [])))],
        sellers: [...new Set(all.flatMap((item) => (item.seller ? [item.seller] : [])))],
        representatives: [
          ...new Set(all.flatMap((item) => (item.representative ? [item.representative] : []))),
        ],
      },
    };
  }

  async listForExport(
    query: Omit<CustomerListQuery, 'page' | 'pageSize'>,
  ): Promise<CustomerRecord[]> {
    return structuredClone(
      [...this.customers.values()].filter((customer) => matches(customer, query)),
    );
  }

  async calculationLinks(id: string) {
    const customer = this.customers.get(id);
    return customer
      ? {
          customer: { id: customer.id, code: customer.code, legalName: customer.legalName },
          calculations: [],
        }
      : null;
  }

  async create(input: CreateCustomerInput): Promise<CustomerMutationResult> {
    if ([...this.customers.values()].some((customer) => customer.code === input.code)) {
      return { outcome: 'code_conflict' };
    }
    const id = `10000000-0000-4000-8000-${String(this.customers.size + 1).padStart(12, '0')}`;
    const customer: CustomerRecord = {
      id,
      code: input.code,
      legalName: input.legalName,
      cnpj: input.cnpj,
      city: input.city,
      state: input.state,
      segment: input.segment,
      customerClass:
        Object.values(customerClasses).find(
          (classification) => classification.id === input.customerClassId,
        ) ?? null,
      customerSegment:
        Object.values(customerSegments).find(
          (classification) => classification.id === input.customerSegmentId,
        ) ?? null,
      seller: input.seller,
      representative: input.representative,
      internalNote: input.internalNote,
      orderNote: input.orderNote,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.set(id, structuredClone(customer));
    this.audits.push({ ...structuredClone(input.audit), entityId: id });
    return { outcome: 'success', customer: structuredClone(customer) };
  }

  async update(input: UpdateCustomerInput): Promise<CustomerMutationResult> {
    const current = this.customers.get(input.id);
    if (!current) return { outcome: 'not_found' };
    if (
      [...this.customers.values()].some(
        (customer) => customer.id !== input.id && customer.code === input.code,
      )
    ) {
      return { outcome: 'code_conflict' };
    }
    const customer: CustomerRecord = {
      ...current,
      code: input.code,
      legalName: input.legalName,
      cnpj: input.cnpj,
      city: input.city,
      state: input.state,
      segment: input.segment,
      customerClass:
        input.customerClassId === undefined
          ? current.customerClass
          : (Object.values(customerClasses).find(
              (classification) => classification.id === input.customerClassId,
            ) ?? null),
      customerSegment:
        input.customerSegmentId === undefined
          ? current.customerSegment
          : (Object.values(customerSegments).find(
              (classification) => classification.id === input.customerSegmentId,
            ) ?? null),
      seller: input.seller,
      representative: input.representative,
      internalNote: input.internalNote,
      orderNote: input.orderNote,
      updatedAt: now,
    };
    this.customers.set(input.id, structuredClone(customer));
    this.audits.push(structuredClone(input.audit));
    return { outcome: 'success', customer: structuredClone(customer) };
  }

  async setActive(input: SetCustomerActiveInput): Promise<CustomerMutationResult> {
    const current = this.customers.get(input.id);
    if (!current) return { outcome: 'not_found' };
    const customer = { ...current, active: input.active, updatedAt: now };
    this.customers.set(input.id, structuredClone(customer));
    this.audits.push(structuredClone(input.audit));
    return { outcome: 'success', customer: structuredClone(customer) };
  }
}
