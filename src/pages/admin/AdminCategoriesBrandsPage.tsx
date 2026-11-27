import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.ts';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { Brand, Category, MediaAsset } from '../../types/domain.ts';

export function AdminCategoriesBrandsPage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const isBrandsFocused = location.pathname === '/admin/brands';
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState<{
    name: string;
    nameBn: string;
    slug: string;
    parentId: string;
    displayOrder: number;
    isActive: boolean;
    seoTitle: string;
    seoDescription: string;
    image?: MediaAsset;
  }>({
    name: '',
    nameBn: '',
    slug: '',
    parentId: '',
    displayOrder: 0,
    isActive: true,
    seoTitle: '',
    seoDescription: '',
  });
  const [savingCat, setSavingCat] = useState(false);

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandForm, setBrandForm] = useState<{
    name: string;
    slug: string;
    description: string;
    isActive: boolean;
    logo?: MediaAsset;
  }>({ name: '', slug: '', description: '', isActive: true });
  const [savingBrand, setSavingBrand] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'categories' | 'brands';
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      apiRequest<{ categories: Category[] }>('/api/catalog/categories?all=true'),
      apiRequest<{ brands: Brand[] }>('/api/catalog/brands?all=true'),
    ])
      .then(([c, b]) => {
        setCategories(c.categories);
        setBrands(b.brands);
      })
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Failed to load categories and brands.',
          })
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openCatModal = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({
        name: cat.name,
        nameBn: cat.nameBn || '',
        slug: cat.slug,
        parentId: cat.parentId ? String(cat.parentId) : '',
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        seoTitle: cat.seoTitle || '',
        seoDescription: cat.seoDescription || '',
        image: cat.image,
      });
    } else {
      setEditingCat(null);
      setCatForm({
        name: '',
        nameBn: '',
        slug: '',
        parentId: '',
        displayOrder: categories.length + 1,
        isActive: true,
        seoTitle: '',
        seoDescription: '',
      });
    }
    setCatModalOpen(true);
  };

  const openBrandModal = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setBrandForm({
        name: brand.name,
        slug: brand.slug,
        description: brand.description || '',
        isActive: brand.isActive,
        logo: brand.logo,
      });
    } else {
      setEditingBrand(null);
      setBrandForm({ name: '', slug: '', description: '', isActive: true });
    }
    setBrandModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCat(true);
    try {
      const url = editingCat
        ? `/api/catalog/admin/categories/${editingCat._id}`
        : '/api/catalog/admin/categories';
      const payload = {
        ...catForm,
        parentId: catForm.parentId || null,
        seoTitle: catForm.seoTitle.trim() || undefined,
        seoDescription: catForm.seoDescription.trim() || undefined,
      };
      await apiRequest(url, {
        method: editingCat ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setCatModalOpen(false);
      dispatch(
        pushToast({
          variant: 'success',
          message: editingCat ? 'Category updated.' : 'Category created.',
        })
      );
      loadAll();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save category.',
        })
      );
    } finally {
      setSavingCat(false);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBrand(true);
    try {
      const url = editingBrand
        ? `/api/catalog/admin/brands/${editingBrand._id}`
        : '/api/catalog/admin/brands';
      await apiRequest(url, {
        method: editingBrand ? 'PATCH' : 'POST',
        body: JSON.stringify(brandForm),
      });
      setBrandModalOpen(false);
      dispatch(
        pushToast({
          variant: 'success',
          message: editingBrand ? 'Brand updated.' : 'Brand created.',
        })
      );
      loadAll();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save brand.',
        })
      );
    } finally {
      setSavingBrand(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/catalog/admin/${deleteTarget.kind}/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      dispatch(
        pushToast({
          variant: 'info',
          message: `${deleteTarget.kind === 'categories' ? 'Category' : 'Brand'} "${deleteTarget.name}" deleted.`,
        })
      );
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to delete item.',
        })
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Categories */}
      <div className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 ${isBrandsFocused ? 'border-slate-200 order-2 lg:order-2' : 'border-emerald-300 order-1'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Categories</h2>
            <p className="text-xs text-slate-500">Storefront hierarchy and display order</p>
          </div>
          <button
            type="button"
            onClick={() => openCatModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="text-xs text-slate-500 py-6">Loading categories...</p>
          ) : (
            categories.map((cat) => (
              <div key={cat._id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SafeImage
                    src={cat.image?.url}
                    alt={cat.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {cat.name} {cat.nameBn ? <span className="text-xs text-slate-500">({cat.nameBn})</span> : null}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      /{cat.slug} · Order #{cat.displayOrder}
                      {cat.parentId
                        ? ` · Child of ${categories.find((c) => c._id === String(cat.parentId))?.name || 'Parent'}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      cat.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.isActive ? 'Active' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openCatModal(cat)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    aria-label={`Edit ${cat.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ kind: 'categories', id: cat._id, name: cat.name })
                    }
                    className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Brands */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Brands</h2>
            <p className="text-xs text-slate-500">Official retail partners & private labels</p>
          </div>
          <button
            type="button"
            onClick={() => openBrandModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Brand
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="text-xs text-slate-500 py-6">Loading brands...</p>
          ) : (
            brands.map((brand) => (
              <div key={brand._id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SafeImage
                    src={brand.logo?.url}
                    alt={brand.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{brand.name}</p>
                    <p className="text-[11px] font-mono text-slate-500">/{brand.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      brand.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {brand.isActive ? 'Active' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openBrandModal(brand)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    aria-label={`Edit ${brand.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ kind: 'brands', id: brand._id, name: brand.name })
                    }
                    className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                    aria-label={`Delete ${brand.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCat ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={catForm.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setCatForm((f) => ({
                    ...f,
                    name: val,
                    slug: editingCat
                      ? f.slug
                      : val
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, ''),
                  }));
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bangla Name</label>
              <input
                type="text"
                value={catForm.nameBn}
                onChange={(e) => setCatForm((f) => ({ ...f, nameBn: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slug</label>
              <input
                type="text"
                required
                value={catForm.slug}
                onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={catForm.displayOrder}
                onChange={(e) => setCatForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parent Category
            </label>
            <select
              value={catForm.parentId}
              onChange={(e) => setCatForm((f) => ({ ...f, parentId: e.target.value }))}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">Top-Level Root Category</option>
              {categories
                .filter((candidate) => {
                  if (!editingCat) return true;
                  if (candidate._id === editingCat._id) return false;
                  let cursor: string | null | undefined = candidate.parentId
                    ? String(candidate.parentId)
                    : null;
                  const seen = new Set<string>();
                  while (cursor) {
                    if (cursor === editingCat._id) return false;
                    if (seen.has(cursor)) break;
                    seen.add(cursor);
                    const nextParent = categories.find((c) => c._id === cursor)?.parentId;
                    cursor = nextParent ? String(nextParent) : null;
                  }
                  return true;
                })
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SEO Title <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                maxLength={120}
                value={catForm.seoTitle}
                onChange={(e) => setCatForm((f) => ({ ...f, seoTitle: e.target.value }))}
                placeholder="Meta title..."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SEO Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                maxLength={240}
                value={catForm.seoDescription}
                onChange={(e) => setCatForm((f) => ({ ...f, seoDescription: e.target.value }))}
                placeholder="Search snippet description..."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <CloudinaryUploadField
              folder="categories"
              label="Upload Category Icon/Image"
              onUploaded={(asset) => setCatForm((f) => ({ ...f, image: asset }))}
            />
            {catForm.image?.url && (
              <SafeImage
                src={catForm.image.url}
                alt={catForm.name}
                className="w-16 h-16 rounded-lg object-cover border border-slate-200"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={catForm.isActive}
              onChange={(e) => setCatForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span>Active on storefront</span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCatModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCat}
              className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold disabled:opacity-60"
            >
              {savingCat ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Brand Modal */}
      <Modal
        open={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        title={editingBrand ? 'Edit Brand' : 'Create Brand'}
      >
        <form onSubmit={handleSaveBrand} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name</label>
              <input
                type="text"
                required
                value={brandForm.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setBrandForm((f) => ({
                    ...f,
                    name: val,
                    slug: editingBrand
                      ? f.slug
                      : val
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, ''),
                  }));
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slug</label>
              <input
                type="text"
                required
                value={brandForm.slug}
                onChange={(e) => setBrandForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={brandForm.description}
              onChange={(e) => setBrandForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </div>

          <div className="space-y-2">
            <CloudinaryUploadField
              folder="brands"
              label="Upload Brand Logo"
              onUploaded={(asset) => setBrandForm((f) => ({ ...f, logo: asset }))}
            />
            {brandForm.logo?.url && (
              <SafeImage
                src={brandForm.logo.url}
                alt={brandForm.name}
                className="w-16 h-16 rounded-lg object-cover border border-slate-200"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={brandForm.isActive}
              onChange={(e) => setBrandForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span>Active brand</span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBrandModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBrand}
              className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold disabled:opacity-60"
            >
              {savingBrand ? 'Saving...' : 'Save Brand'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.kind === 'categories' ? 'Delete Category' : 'Delete Brand'}
        message={`Permanently delete "${deleteTarget?.name || ''}"? Categories or brands still assigned to products or child categories cannot be deleted.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
}
