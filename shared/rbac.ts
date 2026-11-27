export type StaffRole =
  | 'customer'
  | 'super_admin'
  | 'admin'
  | 'order_manager'
  | 'inventory_manager'
  | 'catalog_manager'
  | 'marketing_manager'
  | 'customer_support'
  | 'finance_accounts'
  | 'read_only_analyst';

export type Permission =
  | 'dashboard:view'
  | 'catalog:read'
  | 'catalog:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'orders:read'
  | 'orders:transition'
  | 'orders:cancel'
  | 'returns:manage'
  | 'payments:read'
  | 'payments:refund'
  | 'reviews:moderate'
  | 'cms:write'
  | 'ads:write'
  | 'coupons:write'
  | 'customers:read'
  | 'support:manage'
  | 'reports:read'
  | 'staff:manage'
  | 'settings:write'
  | 'audit:read';

export const STAFF_ROLES: StaffRole[] = [
  'super_admin',
  'admin',
  'order_manager',
  'inventory_manager',
  'catalog_manager',
  'marketing_manager',
  'customer_support',
  'finance_accounts',
  'read_only_analyst',
];

export const ALL_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'catalog:read',
  'catalog:write',
  'inventory:read',
  'inventory:write',
  'orders:read',
  'orders:transition',
  'orders:cancel',
  'returns:manage',
  'payments:read',
  'payments:refund',
  'reviews:moderate',
  'cms:write',
  'ads:write',
  'coupons:write',
  'customers:read',
  'support:manage',
  'reports:read',
  'staff:manage',
  'settings:write',
  'audit:read',
];

export const ROLE_METADATA: Record<StaffRole, { label: string; description: string }> = {
  customer: {
    label: 'Customer',
    description: 'Standard storefront shopper account without admin privileges.',
  },
  super_admin: {
    label: 'Super Admin',
    description: 'Full unrestricted control including staff roles, security settings, and system tools.',
  },
  admin: {
    label: 'Admin',
    description: 'Full operational access across catalog, orders, marketing, CMS, and store settings.',
  },
  order_manager: {
    label: 'Order Manager',
    description: 'Manages order fulfillment lifecycle, cancellations, and customer returns.',
  },
  inventory_manager: {
    label: 'Inventory Manager',
    description: 'Manages stock levels, warehouses adjustments, low-stock alerts, and inventory reports.',
  },
  catalog_manager: {
    label: 'Product / Catalog Manager',
    description: 'Manages products, categories, brands, attributes, CMS content, and promotions.',
  },
  marketing_manager: {
    label: 'Marketing Manager',
    description: 'Manages coupons, discount rules, campaigns, advertisements, popups, and CMS banners.',
  },
  customer_support: {
    label: 'Support Manager',
    description: 'Handles customer enquiries, reviews moderation, Q&A, and return requests.',
  },
  finance_accounts: {
    label: 'Finance & Accounts',
    description: 'Monitors transactions, issues eligible refunds, exports financial reports, and reviews audit logs.',
  },
  read_only_analyst: {
    label: 'Read-Only Analyst',
    description: 'View-only access to dashboard KPIs, catalog, orders, customers, reports, and audit logs.',
  },
};

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  customer: [],
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== 'staff:manage'),
  order_manager: [
    'dashboard:view',
    'orders:read',
    'orders:transition',
    'orders:cancel',
    'returns:manage',
    'customers:read',
  ],
  inventory_manager: [
    'dashboard:view',
    'catalog:read',
    'inventory:read',
    'inventory:write',
    'reports:read',
  ],
  catalog_manager: [
    'dashboard:view',
    'catalog:read',
    'catalog:write',
    'cms:write',
    'ads:write',
    'coupons:write',
  ],
  marketing_manager: [
    'dashboard:view',
    'catalog:read',
    'cms:write',
    'ads:write',
    'coupons:write',
    'reports:read',
  ],
  customer_support: [
    'dashboard:view',
    'orders:read',
    'returns:manage',
    'reviews:moderate',
    'customers:read',
    'support:manage',
  ],
  finance_accounts: [
    'dashboard:view',
    'orders:read',
    'payments:read',
    'payments:refund',
    'reports:read',
    'audit:read',
  ],
  read_only_analyst: [
    'dashboard:view',
    'catalog:read',
    'inventory:read',
    'orders:read',
    'payments:read',
    'customers:read',
    'reports:read',
    'audit:read',
  ],
};

export function resolveRolePermissions(
  role: StaffRole | undefined,
  storedPermissions?: readonly string[] | null
): Permission[] {
  if (!role) return [];
  if (role === 'customer') return [];
  if (role === 'super_admin') return [...ALL_PERMISSIONS];
  if (Array.isArray(storedPermissions) && storedPermissions.length > 0) {
    const allowed = new Set<string>(ALL_PERMISSIONS);
    const filtered = storedPermissions.filter((p): p is Permission => allowed.has(p));
    if (filtered.length > 0) return Array.from(new Set(filtered));
  }
  return [...(ROLE_PERMISSIONS[role] || [])];
}

export function hasEffectivePermission(
  user: { role?: StaffRole; permissions?: readonly string[] | null } | null | undefined,
  permission: Permission
): boolean {
  if (!user?.role) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'customer') return false;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }
  return hasPermission(user.role, permission);
}

export function hasPermission(role: StaffRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isStaffRole(role: StaffRole | undefined): boolean {
  return Boolean(role && role !== 'customer');
}
