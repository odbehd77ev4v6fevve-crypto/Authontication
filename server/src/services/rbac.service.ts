import {
  ALL_PERMISSIONS,
  resolveRolePermissions,
  type Permission,
  type StaffRole,
} from '../../../shared/rbac.ts';
import { RoleDefinitionModel } from '../modules/users/user.model.ts';

interface CachedPermissionsEntry {
  permissions: Permission[];
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 1000;
const rolePermissionsCache = new Map<StaffRole, CachedPermissionsEntry>();

export function invalidateRolePermissionCache(roleKey?: StaffRole): void {
  if (roleKey) {
    rolePermissionsCache.delete(roleKey);
  } else {
    rolePermissionsCache.clear();
  }
}

export async function getEffectivePermissionsForRole(role: StaffRole): Promise<Permission[]> {
  if (role === 'customer') return [];
  if (role === 'super_admin') return [...ALL_PERMISSIONS];

  const now = Date.now();
  const cached = rolePermissionsCache.get(role);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  let storedPermissions: string[] | undefined;
  try {
    const def = await RoleDefinitionModel.findOne({ roleKey: role }).select('permissions').lean();
    storedPermissions = def?.permissions;
  } catch {
    storedPermissions = undefined;
  }

  const resolved = resolveRolePermissions(role, storedPermissions);
  rolePermissionsCache.set(role, {
    permissions: resolved,
    expiresAt: now + CACHE_TTL_MS,
  });
  return resolved;
}

export async function userHasEffectivePermission(
  user: { role?: StaffRole } | null | undefined,
  permission: Permission,
  preloadedPermissions?: Permission[]
): Promise<boolean> {
  if (!user?.role) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'customer') return false;
  const effective = preloadedPermissions ?? (await getEffectivePermissionsForRole(user.role));
  return effective.includes(permission);
}
