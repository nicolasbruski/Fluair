import type { AuthenticatedUser } from '../../shared/auth.js';
import { apiRequest } from './api.js';

interface AuthEnvelope {
  data: {
    user: AuthenticatedUser;
    session: { expiresAt: string };
  };
}

export function login(email: string, password: string): Promise<AuthEnvelope> {
  return apiRequest<AuthEnvelope>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    notifyAuthenticationFailure: false,
  });
}

export function currentSession(): Promise<AuthEnvelope> {
  return apiRequest<AuthEnvelope>('/api/v1/auth/me', {
    notifyAuthenticationFailure: false,
  });
}

export function logout(): Promise<{ data: { loggedOut: boolean } }> {
  return apiRequest('/api/v1/auth/logout', { method: 'POST', body: '{}' });
}
