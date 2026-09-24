import type { AuditInput } from '../auth/auth.types.js';
import type {
  CustomerCalculationLinksEnvelope,
  CustomerClass,
  CustomerClassificationInput,
  CustomerSegment,
} from '../../../shared/customers.js';

export type CustomerStatus = 'active' | 'inactive' | 'all';

export interface CustomerRecord {
  id: string;
  code: string;
  legalName: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  customerClass: CustomerClass | null;
  customerSegment: CustomerSegment | null;
  seller: string | null;
  representative: string | null;
  internalNote: string | null;
  orderNote: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerListQuery {
  search?: string | undefined;
  customerClassId?: string | undefined;
  customerSegmentId?: string | undefined;
  segment?: string | undefined;
  seller?: string | undefined;
  representative?: string | undefined;
  directOnly?: boolean | undefined;
  status: CustomerStatus;
  page: number;
  pageSize: number;
}

export interface CustomerListResult {
  customers: CustomerRecord[];
  total: number;
  filters: {
    segments: string[];
    sellers: string[];
    representatives: string[];
  };
}

export interface CustomerClassificationsResult {
  customerClasses: CustomerClass[];
  customerSegments: CustomerSegment[];
}

export interface CustomerWriteData {
  code: string;
  legalName: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  customerClassId?: string | null | undefined;
  customerSegmentId?: string | null | undefined;
  seller: string | null;
  representative: string | null;
  internalNote: string | null;
  orderNote: string | null;
}

export interface CustomerCommandData extends CustomerWriteData, CustomerClassificationInput {}

export interface CustomerPreRegistrationData {
  legalName: string;
  customerClassId: string;
  customerSegmentId: string;
}

export type CustomerClassificationLookup = { id: string } | { code: string };

export type CustomerMutationResult =
  { outcome: 'success'; customer: CustomerRecord } | { outcome: 'not_found' | 'code_conflict' };

export interface CreateCustomerInput extends CustomerWriteData {
  audit: AuditInput;
}

export interface UpdateCustomerInput extends CustomerWriteData {
  id: string;
  audit: AuditInput;
}

export interface SetCustomerActiveInput {
  id: string;
  active: boolean;
  audit: AuditInput;
}

export interface CustomersRepository {
  listActiveClassifications(): Promise<CustomerClassificationsResult>;
  findCustomerClass(reference: CustomerClassificationLookup): Promise<CustomerClass | null>;
  findCustomerSegment(reference: CustomerClassificationLookup): Promise<CustomerSegment | null>;
  findById(id: string): Promise<CustomerRecord | null>;
  list(query: CustomerListQuery): Promise<CustomerListResult>;
  listForExport(query: Omit<CustomerListQuery, 'page' | 'pageSize'>): Promise<CustomerRecord[]>;
  calculationLinks(id: string): Promise<CustomerCalculationLinksEnvelope['data'] | null>;
  create(input: CreateCustomerInput): Promise<CustomerMutationResult>;
  update(input: UpdateCustomerInput): Promise<CustomerMutationResult>;
  setActive(input: SetCustomerActiveInput): Promise<CustomerMutationResult>;
}
