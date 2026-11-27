import { useEffect, useState } from 'react';
import { Check, Lock, Save, ShieldCheck } from 'lucide-react';
import { ALL_PERMISSIONS, type Permission, type StaffRole } from '../../../shared/rbac.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { fetchCurrentUser } from '../../features/auth/authSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { RoleDefinitionItem } from '../../types/domain.ts';

export function AdminRolesPage() {
  const dispatch = useAppDispatch();
  const [roles, setRoles] = useState<RoleDefinitionItem[]>([]);
  const [permissionsList, setPermissionsList] = useState<string[]>([...ALL_PERMISSIONS]);
  const [selectedRoleKey, setSelectedRoleKey] = useState<StaffRole>('admin');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRoles = () => {
    setLoading(true);
    setLoadError(null);
    apiRequest<{ roles: RoleDefinitionItem[]; allPermissions: string[] }>('/api/users/admin/roles')
      .then((res) => {
        setRoles(res.roles || []);
        if (res.allPermissions?.length) setPermissionsList(res.allPermissions);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Unable to load roles.';
        setLoadError(msg);
        dispatch(
          pushToast({
            variant: 'error',
            message: msg,
          })
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const currentRole = roles.find((r) => r.roleKey === selectedRoleKey) || roles[0] || null;

  const togglePermission = (perm: string) => {
    if (!currentRole || currentRole.roleKey === 'super_admin') return;
    const has = currentRole.permissions.includes(perm);
    const nextPerms = has
      ? currentRole.permissions.filter((p) => p !== perm)
      : [...currentRole.permissions, perm];
    if (nextPerms.length === 0) {
      dispatch(pushToast({ variant: 'error', message: 'A role must retain at least 1 permission.' }));
      return;
    }
    setRoles((prev) =>
      prev.map((r) => (r.roleKey === currentRole.roleKey ? { ...r, permissions: nextPerms } : r))
    );
  };

  const handleSaveRole = async () => {
    if (!currentRole) return;
    setSaving(true);
    try {
      await apiRequest(`/api/users/admin/roles/${currentRole.roleKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: currentRole.label,
          description: currentRole.description,
          permissions: currentRole.permissions as Permission[],
        }),
      });
      dispatch(
        pushToast({
          variant: 'success',
          message: `${currentRole.label} permissions saved.`,
        })
      );
      void dispatch(fetchCurrentUser());
      loadRoles();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save role permissions.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Roles &amp; RBAC Permission Matrix</h1>
          <p className="text-xs text-slate-500">
            Inspect and customize granular staff permissions across every admin module.
          </p>
        </div>
        {currentRole && (
          <button
            type="button"
            disabled={saving || currentRole.roleKey === 'super_admin'}
            onClick={handleSaveRole}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : `Save ${currentRole.label}`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      ) : loadError || roles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-extrabold text-slate-900">Unable to load RBAC role matrix</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {loadError || 'No role definitions are available yet. Ensure MongoDB Atlas is connected and retry.'}
          </p>
          <button
            type="button"
            onClick={loadRoles}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            Retry Loading Roles
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Role Selector List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-3 space-y-1.5 shadow-xs">
            {roles.map((r) => (
              <button
                key={r.roleKey}
                type="button"
                onClick={() => setSelectedRoleKey(r.roleKey)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  currentRole?.roleKey === r.roleKey
                    ? 'border-[#16A34A] bg-emerald-50/60'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">{r.label}</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {r.permissions.length} perms · {r.staffCount ?? 0} users
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{r.description}</p>
              </button>
            ))}
          </div>

          {/* Permissions Matrix */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            {currentRole && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">{currentRole.label}</h2>
                      <p className="text-[11px] text-slate-500">{currentRole.description}</p>
                    </div>
                  </div>
                  {currentRole.roleKey === 'super_admin' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold">
                      <Lock className="w-3 h-3" /> Full Access Locked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {permissionsList.map((perm) => {
                    const enabled = currentRole.permissions.includes(perm);
                    return (
                      <button
                        key={perm}
                        type="button"
                        disabled={currentRole.roleKey === 'super_admin'}
                        onClick={() => togglePermission(perm)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                          enabled
                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        } disabled:cursor-not-allowed`}
                      >
                        <span className="text-xs font-mono font-semibold">{perm}</span>
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            enabled ? 'bg-[#16A34A] text-white' : 'bg-slate-100 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
