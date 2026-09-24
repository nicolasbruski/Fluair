import type { UserEnvelope, UsersEnvelope } from '../../shared/users.js';
import { apiRequest } from './api.js';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleCode: string;
  commissionAccess: boolean;
}

export interface UpdateUserInput {
  name: string;
  email: string;
  roleCode: string;
  commissionAccess: boolean;
  password?: string;
}

export function listUsers(): Promise<UsersEnvelope> {
  return apiRequest<UsersEnvelope>('/api/v1/users');
}

export function createUser(input: CreateUserInput): Promise<UserEnvelope> {
  return apiRequest<UserEnvelope>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<UserEnvelope> {
  return apiRequest<UserEnvelope>(`/api/v1/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setUserActive(id: string, active: boolean): Promise<UserEnvelope> {
  return apiRequest<UserEnvelope>(
    `/api/v1/users/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`,
    { method: 'POST', body: '{}' },
  );
}
