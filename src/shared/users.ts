import type { PermissionCode } from './auth.js';

export interface ManagedRole {
  code: string;
  name: string;
  description: string | null;
  permissions: PermissionCode[];
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: { code: string; name: string };
  permissions: PermissionCode[];
  createdAt: string;
  updatedAt: string;
}

export interface UsersEnvelope {
  data: {
    users: ManagedUser[];
    roles: ManagedRole[];
  };
}

export interface UserEnvelope {
  data: { user: ManagedUser };
}
