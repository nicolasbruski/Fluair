export const PERMISSIONS = [
  'calculation.view',
  'calculation.create',
  'calculation.history',
  'calculation.export',
  'matrix.view',
  'matrix.manage',
  'matrix.recalculate',
  'user.view',
  'user.manage',
  'order.access',
  'price.view',
  'price.override',
  'customer.view',
  'customer.manage',
  'catalog.manage',
  'commission.access',
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export const ROLE_CODES = {
  administrator: 'ADMINISTRATOR',
  calculationOperator: 'CALCULATION_OPERATOR',
  readOnly: 'READ_ONLY',
} as const;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  roleCode?: string;
  permissions: PermissionCode[];
}

export interface AuthResponseData {
  user: AuthenticatedUser;
}
