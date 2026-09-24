import type {
  CustomerClassificationsEnvelope,
  CustomerCalculationLinksEnvelope,
  CustomerEnvelope,
  CustomerClassificationInput,
  CustomerQuery,
  CustomersEnvelope,
  CustomersExportEnvelope,
} from '../../shared/customers.js';
import { apiRequest } from './api.js';

export type { CustomerQuery } from '../../shared/customers.js';

export interface CustomerInput extends CustomerClassificationInput {
  code: string;
  legalName: string;
  cnpj: string;
  city: string;
  state: string;
  segment: string;
  seller: string;
  representative: string;
  internalNote: string;
  orderNote: string;
}

export interface CustomerPreRegistrationInput {
  legalName: string;
  customerClassId: string;
  customerSegmentId: string;
}

function queryString(query: CustomerQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}

export function listCustomers(query: CustomerQuery): Promise<CustomersEnvelope> {
  return apiRequest<CustomersEnvelope>(`/api/v1/customers${queryString(query)}`);
}

export function listCustomerClassifications(): Promise<CustomerClassificationsEnvelope> {
  return apiRequest<CustomerClassificationsEnvelope>('/api/v1/customers/classifications');
}

export function getCustomerCalculationLinks(id: string): Promise<CustomerCalculationLinksEnvelope> {
  return apiRequest<CustomerCalculationLinksEnvelope>(
    `/api/v1/customers/${encodeURIComponent(id)}/calculation-links`,
  );
}

export function getCustomer(id: string): Promise<CustomerEnvelope> {
  return apiRequest<CustomerEnvelope>(`/api/v1/customers/${encodeURIComponent(id)}`);
}

export function exportCustomers(
  query: Omit<CustomerQuery, 'page' | 'pageSize'>,
): Promise<CustomersExportEnvelope> {
  return apiRequest<CustomersExportEnvelope>(`/api/v1/customers/export${queryString(query)}`);
}

export function createCustomer(input: CustomerInput): Promise<CustomerEnvelope> {
  return apiRequest<CustomerEnvelope>('/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function preRegisterCustomer(
  input: CustomerPreRegistrationInput,
): Promise<CustomerEnvelope> {
  return apiRequest<CustomerEnvelope>('/api/v1/customers/pre-registration', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCustomer(id: string, input: CustomerInput): Promise<CustomerEnvelope> {
  return apiRequest<CustomerEnvelope>(`/api/v1/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setCustomerActive(id: string, active: boolean): Promise<CustomerEnvelope> {
  return apiRequest<CustomerEnvelope>(
    `/api/v1/customers/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`,
    { method: 'POST', body: '{}' },
  );
}
