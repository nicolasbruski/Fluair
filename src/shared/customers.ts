export interface CustomerClass {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface CustomerSegment {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/** Labels consumed by the legacy commissions workflow. */
export const LEGACY_CUSTOMER_SEGMENT_LABELS: Readonly<Record<string, string>> = {
  AUTO_PARTS: 'AUTO-PECAS',
  AUTHORIZED: 'AUTORIZADA',
  END_CONSUMER: 'CONSUMIDOR FINAL',
  DISTRIBUTOR: 'DISTRIBUIDOR',
  FLEET_OWNER: 'FROTISTA',
  IMPLEMENTER: 'IMPLEMENTADOR',
  SERVICE_STATION: 'POSTO DE SERVICO',
};

export function legacyCustomerSegmentLabel(segment: CustomerSegment): string {
  return LEGACY_CUSTOMER_SEGMENT_LABELS[segment.code] ?? segment.name;
}

export interface CustomerClassificationInput {
  customerClassId?: string | null | undefined;
  customerClassCode?: string | null | undefined;
  customerSegmentId?: string | null | undefined;
  customerSegmentCode?: string | null | undefined;
}

export interface Customer {
  id: string;
  code: string;
  legalName: string;
  cnpj?: string | null;
  city?: string | null;
  state?: string | null;
  /** @deprecated Use `customerSegment` for pricing and authorization rules. */
  segment: string | null;
  customerClass: CustomerClass | null;
  customerSegment: CustomerSegment | null;
  seller: string | null;
  representative: string | null;
  internalNote: string | null;
  orderNote: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerFilters {
  /** @deprecated Use `customerSegments` for new filters. */
  segments: string[];
  /** Missing only in a legacy response produced during the transition. */
  customerClasses?: CustomerClass[];
  /** Missing only in a legacy response produced during the transition. */
  customerSegments?: CustomerSegment[];
  sellers: string[];
  representatives: string[];
}

export type CustomerStatus = 'active' | 'inactive' | 'all';

export interface CustomerQuery {
  search?: string;
  customerClassId?: string;
  customerSegmentId?: string;
  /** @deprecated Temporary filter for the legacy textual segment. */
  segment?: string;
  seller?: string;
  representative?: string;
  directOnly?: boolean;
  status?: CustomerStatus;
  page?: number;
  pageSize?: number;
}

export interface CustomersEnvelope {
  data: {
    customers: Customer[];
    filters: CustomerFilters;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CustomerEnvelope {
  data: { customer: Customer };
}

export interface CustomerClassificationsEnvelope {
  data: {
    customerClasses: CustomerClass[];
    customerSegments: CustomerSegment[];
  };
}

export interface CustomersExportEnvelope {
  data: { customers: Customer[] };
}

export interface CustomerCalculationItemLink {
  id: string;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  minimumUnitPrice: string;
  normalUnitPrice: string;
}

export interface CustomerCalculationLink {
  calculationId: string;
  version: number;
  current: boolean;
  kitCode: string;
  kitDescription: string;
  priceListName: string;
  className: string | null;
  linkedAt: string;
  linkedBy: string;
  items: CustomerCalculationItemLink[];
}

export interface CustomerCalculationLinksEnvelope {
  data: {
    customer: { id: string; code: string; legalName: string };
    calculations: CustomerCalculationLink[];
  };
}
