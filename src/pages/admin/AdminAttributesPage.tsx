import { useEffect, useState } from 'react';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks.ts';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { AttributeGroup } from '../../types/domain.ts';

interface AttrFieldForm {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'color';
  optionsText: string;
  isFilterable: boolean;
  isRequired: boolean;
}

const emptyField = (): AttrFieldForm => ({
  key: '',
  label: '',
  type: 'select',
  optionsText: '',
  isFilterable: true,
  isRequired: false,
});

export function AdminAttributesPage() {
  const dispatch = useAppDispatch();
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AttributeGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<AttrFieldForm[]>([emptyField()]);

  const loadGroups = () => {
    setLoading(true);
    apiRequest<{ groups: AttributeGroup[] }>('/api/catalog/admin/attributes')
      .then((res) => setGroups(res.groups || []))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load attribute groups.',
          })
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const openModal = (grp?: AttributeGroup) => {
    if (grp) {
      setEditing(grp);
      setName(grp.name);
      setSlug(grp.slug);
      setDescription(grp.description || '');
      setDisplayOrder(grp.displayOrder ?? 0);
      setIsActive(grp.isActive);
      setFields(
        grp.attributes.length > 0
          ? grp.attributes.map((a) => ({
              key: a.key,
              label: a.label,
              type: a.type,
              optionsText: (a.options || []).join(', '),
              isFilterable: a.isFilterable,
              isRequired: a.isRequired,
            }))
          : [emptyField()]
      );
    } else {
      setEditing(null);
      setName('');
      setSlug('');
      setDescription('');
      setDisplayOrder(groups.length);
      setIsActive(true);
      setFields([emptyField()]);
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedAttributes = fields
      .filter((f) => f.label.trim() && (f.key.trim() || f.label.trim()))
      .map((f) => ({
        key:
          f.key.trim() ||
          f.label
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_'),
        label: f.label.trim(),
        type: f.type,
        options: f.optionsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isFilterable: f.isFilterable,
        isRequired: f.isRequired,
      }));

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: (slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase(),
        description: description.trim(),
        displayOrder: Number(displayOrder) || 0,
        isActive,
        attributes: cleanedAttributes,
      };
      if (editing) {
        await apiRequest(`/api/catalog/admin/attributes/${editing._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ variant: 'success', message: 'Attribute group updated.' }));
      } else {
        await apiRequest('/api/catalog/admin/attributes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ variant: 'success', message: 'Attribute group created.' }));
      }
      setModalOpen(false);
      loadGroups();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save attribute group.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiRequest(`/api/catalog/admin/attributes/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      dispatch(pushToast({ variant: 'info', message: 'Attribute group deleted.' }));
      loadGroups();
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
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Product Attributes &amp; Groups</h1>
          <p className="text-xs text-slate-500">
            Define reusable specification templates (Color, Storage, Size, RAM, Material) for product editors.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
        >
          <Plus className="w-4 h-4" /> Create Attribute Group
        </button>
      </div>

      {loading ? (
        <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      ) : groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No attribute groups configured yet</p>
          <p className="text-xs text-slate-500">
            Create templates like Smartphones, Apparel Sizing, or Audio Specs to speed up catalog entry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((grp) => (
            <div
              key={grp._id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-extrabold text-slate-900">{grp.name}</h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        grp.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {grp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400">/{grp.slug}</p>
                  {grp.description && <p className="text-xs text-slate-600 mt-1">{grp.description}</p>}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openModal(grp)}
                    aria-label={`Edit ${grp.name}`}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(grp._id)}
                    aria-label={`Delete ${grp.name}`}
                    className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {grp.attributes.map((attr) => (
                  <span
                    key={attr.key}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700"
                  >
                    <strong>{attr.label}</strong> ({attr.type})
                    {attr.options?.length ? `: ${attr.options.slice(0, 3).join(', ')}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Attribute Group' : 'Create Attribute Group'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Group Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  if (!editing) {
                    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }
                }}
                placeholder="Electronics Specs"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="electronics-specs"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Order</label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700">Attribute Fields</span>
              <button
                type="button"
                onClick={() => setFields((prev) => [...prev, emptyField()])}
                className="text-xs font-semibold text-[#16A34A] hover:underline"
              >
                + Add Field
              </button>
            </div>
            {fields.map((f, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Label (e.g. Storage)"
                    value={f.label}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row))
                      )
                    }
                    className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Key (e.g. storage)"
                    value={f.key}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, key: e.target.value } : row))
                      )
                    }
                    className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                  />
                  <select
                    value={f.type}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, type: e.target.value as AttrFieldForm['type'] } : row
                        )
                      )
                    }
                    className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="select">Select Options</option>
                    <option value="color">Color Swatch</option>
                    <option value="text">Free Text</option>
                    <option value="number">Number</option>
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={f.isFilterable}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, isFilterable: e.target.checked } : row
                            )
                          )
                        }
                      />
                      Filterable
                    </label>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 rounded border border-slate-200 bg-white text-red-600"
                        aria-label="Remove field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Comma-separated values (e.g. 128GB, 256GB, 512GB)"
                  value={f.optionsText}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, optionsText: e.target.value } : row
                      )
                    )
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                />
              </div>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Active in Product Editor</span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Group'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Attribute Group"
        message="Remove this attribute template? Existing products keep their stored attribute values."
        confirmLabel="Delete Group"
        danger
      />
    </div>
  );
}
