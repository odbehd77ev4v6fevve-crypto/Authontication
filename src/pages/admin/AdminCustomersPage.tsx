import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { extractEntityId } from '../../../shared/formHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest, formatBdt } from '../../lib/api.ts';
import type { CustomerGroup, CustomerRecord, OrderRecord } from '../../types/domain.ts';

export function AdminCustomersPage({ mode = 'list' }: { mode?: 'list' | 'groups' }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<'list' | 'groups'>(mode);

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderRecord[]>([]);
  const [editGroupId, setEditGroupId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpSlug, setGrpSlug] = useState('');
  const [grpDescription, setGrpDescription] = useState('');
  const [grpDiscount, setGrpDiscount] = useState(0);
  const [grpColor, setGrpColor] = useState('#16A34A');
  const [grpActive, setGrpActive] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  useEffect(() => {
    setTab(mode);
  }, [mode]);

  const loadGroups = () => {
    apiRequest<{ groups: CustomerGroup[] }>('/api/users/admin/customer-groups')
      .then((res) => setGroups(res.groups || []))
      .catch(() => {});
  };

  const loadCustomers = (targetPage = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: '20' });
    if (search.trim()) params.set('q', search.trim());
    if (groupFilter) params.set('groupId', groupFilter);
    if (statusFilter) params.set('status', statusFilter);

    apiRequest<{
      customers: CustomerRecord[];
      total: number;
      totalPages: number;
    }>(`/api/users/admin/customers?${params.toString()}`)
      .then((res) => {
        setCustomers(res.customers || []);
        setTotalCustomers(res.total || 0);
        setTotalPages(Math.max(1, res.totalPages || 1));
      })
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load customers.',
          })
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    loadCustomers(page);
  }, [groupFilter, statusFilter, page]);

  const openCustomerDetails = async (c: CustomerRecord) => {
    setSelectedCustomer(c);
    setCustomerOrders([]);
    setEditActive(c.isActive);
    setEditGroupId(extractEntityId(c.customerGroupId));
    try {
      const res = await apiRequest<{ customer: CustomerRecord; orders: OrderRecord[] }>(
        `/api/users/admin/customers/${c._id}`
      );
      setSelectedCustomer(res.customer);
      setEditActive(res.customer.isActive);
      setEditGroupId(extractEntityId(res.customer.customerGroupId));
      setCustomerOrders(res.orders || []);
    } catch {
      // Keep summary card open
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setSavingCustomer(true);
    try {
      await apiRequest(`/api/users/admin/customers/${selectedCustomer._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: editActive,
          customerGroupId: editGroupId || null,
        }),
      });
      dispatch(pushToast({ variant: 'success', message: 'Customer account updated.' }));
      setSelectedCustomer(null);
      loadCustomers(page);
      loadGroups();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to update customer.',
        })
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  const openGroupModal = (grp?: CustomerGroup) => {
    if (grp) {
      setEditingGroup(grp);
      setGrpName(grp.name);
      setGrpSlug(grp.slug);
      setGrpDescription(grp.description || '');
      setGrpDiscount(grp.discountPercent || 0);
      setGrpColor(grp.badgeColor || '#16A34A');
      setGrpActive(grp.isActive);
    } else {
      setEditingGroup(null);
      setGrpName('');
      setGrpSlug('');
      setGrpDescription('');
      setGrpDiscount(5);
      setGrpColor('#16A34A');
      setGrpActive(true);
    }
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    try {
      const payload = {
        name: grpName.trim(),
        slug: (grpSlug.trim() || grpName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase(),
        description: grpDescription.trim(),
        discountPercent: Number(grpDiscount) || 0,
        badgeColor: grpColor || '#16A34A',
        isActive: grpActive,
      };
      if (editingGroup) {
        await apiRequest(`/api/users/admin/customer-groups/${editingGroup._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ variant: 'success', message: 'Customer group updated.' }));
      } else {
        await apiRequest('/api/users/admin/customer-groups', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ variant: 'success', message: 'Customer group created.' }));
      }
      setGroupModalOpen(false);
      loadGroups();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save customer group.',
        })
      );
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await apiRequest(`/api/users/admin/customer-groups/${deleteGroupId}`, { method: 'DELETE' });
      setDeleteGroupId(null);
      dispatch(pushToast({ variant: 'info', message: 'Customer group deleted.' }));
      loadGroups();
      loadCustomers(page);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Delete failed.',
        })
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'list' ? 'bg-[#16A34A] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            Customer Directory ({totalCustomers})
          </button>
          <button
            type="button"
            onClick={() => setTab('groups')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'groups' ? 'bg-[#16A34A] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Customer Groups ({groups.length})
          </button>
        </div>

        {tab === 'groups' && (
          <button
            type="button"
            onClick={() => openGroupModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Create Customer Group
          </button>
        )}
      </div>

      {tab === 'list' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                loadCustomers(1);
              }}
              className="flex items-center gap-1.5 flex-1 min-w-[220px] max-w-md"
            >
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone..."
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold"
              >
                Search
              </button>
            </form>

            <select
              aria-label="Filter by customer group"
              value={groupFilter}
              onChange={(e) => {
                setPage(1);
                setGroupFilter(e.target.value);
              }}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            >
              <option value="">All Customer Groups</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by account status"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="inactive">Disabled / Blocked</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold">Group</th>
                    <th className="text-center px-4 py-3 font-semibold">Orders</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Spend</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">
                        Loading customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">
                        No customers match your criteria.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const grp = typeof c.customerGroupId === 'object' ? c.customerGroupId : null;
                      return (
                        <tr key={c._id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {c.avatarUrl ? (
                                <SafeImage
                                  src={c.avatarUrl}
                                  alt={c.name}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {c.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate">{c.name}</p>
                                <p className="text-[11px] text-slate-500 truncate">{c.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{c.phone || '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            {grp ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                                {grp.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">Standard</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-semibold">
                            {c.ordersCount ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-xs">
                            {formatBdt(c.totalSpent ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {c.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void openCustomerDetails(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Page {page} of {totalPages} ({totalCustomers} customers)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
              No customer groups created yet. Add VIP or Wholesale groups for targeted coupons and discounts.
            </div>
          ) : (
            groups.map((grp) => (
              <div key={grp._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: grp.badgeColor || '#16A34A' }}
                    >
                      {grp.name}
                    </span>
                    <p className="text-[11px] font-mono text-slate-400 mt-1">/{grp.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openGroupModal(grp)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      aria-label={`Edit ${grp.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteGroupId(grp._id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                      aria-label={`Delete ${grp.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {grp.description && <p className="text-xs text-slate-600">{grp.description}</p>}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    Members: <strong className="text-slate-900">{grp.memberCount ?? 0}</strong>
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {grp.discountPercent}% Perk
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Customer Detail Modal */}
      <Modal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name || 'Customer Profile'}
        description={selectedCustomer?.email}
        maxWidthClass="max-w-2xl"
      >
        {selectedCustomer && (
          <div className="space-y-5">
            <form onSubmit={handleSaveCustomer} className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Group
                  </label>
                  <select
                    value={editGroupId}
                    onChange={(e) => setEditGroupId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="">Standard Customer (No Group)</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name} ({g.discountPercent}% perk)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 h-9">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                    />
                    <span>Account Active (Allow Sign-In)</span>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingCustomer}
                className="px-4 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold disabled:opacity-60"
              >
                {savingCustomer ? 'Saving...' : 'Update Customer Profile'}
              </button>
            </form>

            <div>
              <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">
                Recent Orders ({customerOrders.length})
              </h3>
              {customerOrders.length === 0 ? (
                <p className="text-xs text-slate-500">No orders placed yet.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
                  {customerOrders.map((o) => (
                    <div key={o._id} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{o.orderNumber}</span>
                        <span className="text-slate-400 ml-2">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100">
                          {o.orderStatus}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatBdt(o.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Customer Group Modal */}
      <Modal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={editingGroup ? 'Edit Customer Group' : 'Create Customer Group'}
      >
        <form onSubmit={handleSaveGroup} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Group Name *</label>
              <input
                type="text"
                required
                value={grpName}
                onChange={(e) => {
                  const val = e.target.value;
                  setGrpName(val);
                  if (!editingGroup) {
                    setGrpSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }
                }}
                placeholder="VIP Club"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slug *</label>
              <input
                type="text"
                required
                value={grpSlug}
                onChange={(e) => setGrpSlug(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={grpDescription}
              onChange={(e) => setGrpDescription(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount Perk (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={grpDiscount}
                onChange={(e) => setGrpDiscount(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Color</label>
              <input
                type="color"
                value={grpColor}
                onChange={(e) => setGrpColor(e.target.value)}
                className="w-full h-10 p-1 rounded-lg border border-slate-200 bg-white"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={grpActive}
              onChange={(e) => setGrpActive(e.target.checked)}
            />
            <span>Active Group</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGroupModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingGroup}
              className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold disabled:opacity-60"
            >
              {savingGroup ? 'Saving...' : 'Save Group'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteGroupId)}
        onClose={() => setDeleteGroupId(null)}
        onConfirm={handleDeleteGroup}
        title="Delete Customer Group"
        message="Members will revert to standard customer status. Continue?"
        confirmLabel="Delete Group"
        danger
      />
    </div>
  );
}
