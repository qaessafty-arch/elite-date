/** Every permission the admin area checks. Roles hold a subset (see scripts/seed.ts). */
export const PERMISSIONS = [
  'dashboard.view',
  'products.manage',
  'orders.manage',
  'refunds.process',
  'customers.manage',
  'promotions.manage',
  'settings.manage',
  'roles.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Open the admin dashboard',
  'products.manage': 'Manage products, categories and stock',
  'orders.manage': 'Manage orders and tracking',
  'refunds.process': 'Issue refunds',
  'customers.manage': 'View and manage customers',
  'promotions.manage': 'Manage coupons and campaigns',
  'settings.manage': 'Change store settings',
  'roles.manage': 'Manage roles and staff access',
};
