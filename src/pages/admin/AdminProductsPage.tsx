import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  extractEntityId,
  extractEntityIds,
  toDatetimeLocalInput,
  toOptionalNumberInput,
} from '../../../shared/formHelpers.ts';
import { reorderArrayItem } from '../../../shared/productDetailHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest, downloadCsvRequest, formatBdt } from '../../lib/api.ts';
import type {
  AttributeGroup,
  Brand,
  Category,
  MediaAsset,
  Product,
  ProductSpecificationGroup,
} from '../../types/domain.ts';

type EditorTab = 'basic' | 'pricing' | 'media' | 'specs' | 'variants' | 'policies';

interface VariantOptionRow {
  key: string;
  value: string;
}

interface VariantFormRow {
  _id?: string;
  sku: string;
  title: string;
  price: string;
  stockOnHand: number;
  lowStockThreshold: number;
  optionRows: VariantOptionRow[];
  image?: MediaAsset | null;
  isActive: boolean;
}

interface ProductFormState {
  name: string;
  nameBn: string;
  slug: string;
  sku: string;
  barcode: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  categoryDomain: Product['categoryDomain'];
  shortDescription: string;
  description: string;
  features: string[];
  bilingualKeywordsText: string;
  attributesText: string;
  specificationGroups: ProductSpecificationGroup[];
  basePrice: number;
  salePrice: string;
  purchasePrice: string;
  costPrice: string;
  flashSalePrice: string;
  flashSaleStart: string;
  flashSaleEnd: string;
  stockOnHand: number;
  lowStockThreshold: number;
  allowBackorders: boolean;
  maxOrderQuantity: number;
  status: Product['status'];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  codEligible: boolean;
  warrantyInfo: string;
  returnPolicyInfo: string;
  shippingInfo: string;
  deliveryNotes: string;
  relatedProductIds: string[];
  seoTitle: string;
  seoDescription: string;
  metaKeywordsText: string;
  canonicalUrl: string;
  ogImage: MediaAsset | null;
  images: MediaAsset[];
  videoUrl: string;
  videoThumbnail: MediaAsset | null;
  variants: VariantFormRow[];
}

const emptyProductForm = (defaultCategoryId = ''): ProductFormState => ({
  name: '',
  nameBn: '',
  slug: '',
  sku: '',
  barcode: '',
  categoryId: defaultCategoryId,
  subcategoryId: '',
  brandId: '',
  categoryDomain: 'general',
  shortDescription: '',
  description: '',
  features: [],
  bilingualKeywordsText: '',
  attributesText: '',
  specificationGroups: [],
  basePrice: 0,
  salePrice: '',
  purchasePrice: '',
  costPrice: '',
  flashSalePrice: '',
  flashSaleStart: '',
  flashSaleEnd: '',
  stockOnHand: 10,
  lowStockThreshold: 5,
  allowBackorders: false,
  maxOrderQuantity: 10,
  status: 'published',
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: false,
  codEligible: true,
  warrantyInfo: 'Official 1-Year Warranty',
  returnPolicyInfo: '7 Days Easy Return on unused items in original packaging.',
  shippingInfo: '',
  deliveryNotes: '',
  relatedProductIds: [],
  seoTitle: '',
  seoDescription: '',
  metaKeywordsText: '',
  canonicalUrl: '',
  ogImage: null,
  images: [],
  videoUrl: '',
  videoThumbnail: null,
  variants: [],
});

export function AdminProductsPage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('basic');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [saving, setSaving] = useState(false);
  const [newFeatureInput, setNewFeatureInput] = useState('');

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState(
    'sku,name,slug,categorySlug,brandSlug,basePrice,salePrice,stockOnHand,status\nNVR-DEMO-01,Sample Product,sample-product,electronics,novara-tech,2500,2199,20,published'
  );
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) params.set('q', search.trim());

    Promise.all([
      apiRequest<{ products: Product[]; totalPages: number }>(
        `/api/catalog/admin/products?${params.toString()}`
      ),
      apiRequest<{ categories: Category[] }>('/api/catalog/categories?all=true'),
      apiRequest<{ brands: Brand[] }>('/api/catalog/brands?all=true'),
      apiRequest<{ groups: AttributeGroup[] }>('/api/catalog/admin/attributes').catch(() => ({ groups: [] })),
    ])
      .then(([prodRes, catRes, brandRes, attrRes]) => {
        setProducts(prodRes.products);
        setTotalPages(Math.max(1, prodRes.totalPages));
        setCategories(catRes.categories);
        setBrands(brandRes.brands);
        setAttributeGroups(attrRes.groups || []);
      })
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load products.',
          })
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const openCreateModal = () => {
    setEditingId(null);
    setEditorTab('basic');
    setNewFeatureInput('');
    const rootCat = categories.find((c) => !c.parentId) || categories[0];
    setForm(emptyProductForm(rootCat?._id || ''));
    setFormOpen(true);
  };

  useEffect(() => {
    if (location.pathname === '/admin/products/new' && !loading) {
      openCreateModal();
    }
  }, [location.pathname, loading]);

  const openEditModal = (p: Product) => {
    setEditingId(p._id);
    setEditorTab('basic');
    setNewFeatureInput('');
    const attrLines = Object.entries(p.attributes || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    setForm({
      name: p.name,
      nameBn: p.nameBn || '',
      slug: p.slug,
      sku: p.sku,
      barcode: p.barcode || '',
      categoryId: extractEntityId(p.categoryId),
      subcategoryId: extractEntityId(p.subcategoryId),
      brandId: extractEntityId(p.brandId),
      categoryDomain: p.categoryDomain,
      shortDescription: p.shortDescription || '',
      description: p.description,
      features: p.features || [],
      bilingualKeywordsText: (p.bilingualKeywords || []).join(', '),
      attributesText: attrLines,
      specificationGroups: (p.specificationGroups || []).map((g) => ({
        groupTitle: g.groupTitle,
        items: (g.items || []).map((i) => ({ label: i.label, value: i.value })),
      })),
      basePrice: p.basePrice,
      salePrice: toOptionalNumberInput(p.salePrice),
      purchasePrice: toOptionalNumberInput(p.purchasePrice),
      costPrice: toOptionalNumberInput(p.costPrice),
      flashSalePrice: toOptionalNumberInput(p.flashSalePrice),
      flashSaleStart: toDatetimeLocalInput(p.flashSaleStart),
      flashSaleEnd: toDatetimeLocalInput(p.flashSaleEnd),
      stockOnHand: p.stockOnHand,
      lowStockThreshold: p.lowStockThreshold,
      allowBackorders: Boolean(p.allowBackorders),
      maxOrderQuantity: p.maxOrderQuantity || 10,
      status: p.status,
      isFeatured: p.isFeatured,
      isBestSeller: Boolean(p.isBestSeller),
      isNewArrival: Boolean(p.isNewArrival),
      codEligible: p.codEligible,
      warrantyInfo: p.warrantyInfo || '',
      returnPolicyInfo: p.returnPolicyInfo || '',
      shippingInfo: p.shippingInfo || '',
      deliveryNotes: p.deliveryNotes || '',
      relatedProductIds: extractEntityIds(p.relatedProductIds),
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
      metaKeywordsText: (p.metaKeywords || []).join(', '),
      canonicalUrl: p.canonicalUrl || '',
      ogImage: p.ogImage || null,
      images: p.images || [],
      videoUrl: p.videoUrl || '',
      videoThumbnail: p.videoThumbnail || null,
      variants: (p.variants || []).map((v) => ({
        _id: v._id,
        sku: v.sku,
        title: v.title,
        price: v.price !== null && v.price !== undefined ? String(v.price) : '',
        stockOnHand: v.stockOnHand,
        lowStockThreshold: v.lowStockThreshold,
        optionRows: Object.entries(v.options || {}).map(([key, value]) => ({ key, value })),
        image: v.image || null,
        isActive: v.isActive !== false,
      })),
    });
    setFormOpen(true);
  };

  const openDetailsModal = async (p: Product) => {
    setDetailProduct(p);
    try {
      const res = await apiRequest<{ product: Product }>(`/api/catalog/admin/products/${p._id}`);
      if (res.product) setDetailProduct(res.product);
    } catch {
      // keep existing product summary
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const attributes: Record<string, string> = {};
      for (const line of form.attributesText.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          attributes[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }

      const cleanedSpecGroups = form.specificationGroups
        .map((g) => ({
          groupTitle: g.groupTitle.trim(),
          items: g.items
            .map((i) => ({ label: i.label.trim(), value: i.value.trim() }))
            .filter((i) => i.label && i.value),
        }))
        .filter((g) => g.groupTitle && g.items.length > 0);

      const payload = {
        name: form.name.trim(),
        nameBn: form.nameBn.trim(),
        slug: form.slug.trim().toLowerCase(),
        sku: form.sku.trim().toUpperCase(),
        barcode: form.barcode.trim(),
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || null,
        brandId: form.brandId || null,
        categoryDomain: form.categoryDomain,
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
        features: form.features.map((s) => s.trim()).filter(Boolean),
        bilingualKeywords: form.bilingualKeywordsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        attributes,
        specificationGroups: cleanedSpecGroups,
        basePrice: Number(form.basePrice),
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        flashSalePrice: form.flashSalePrice ? Number(form.flashSalePrice) : null,
        flashSaleStart: form.flashSaleStart ? new Date(form.flashSaleStart).toISOString() : null,
        flashSaleEnd: form.flashSaleEnd ? new Date(form.flashSaleEnd).toISOString() : null,
        stockOnHand: Number(form.stockOnHand),
        lowStockThreshold: Number(form.lowStockThreshold),
        allowBackorders: form.allowBackorders,
        maxOrderQuantity: Math.min(50, Math.max(1, Number(form.maxOrderQuantity) || 10)),
        status: form.status,
        isFeatured: form.isFeatured,
        isBestSeller: form.isBestSeller,
        isNewArrival: form.isNewArrival,
        codEligible: form.codEligible,
        warrantyInfo: form.warrantyInfo.trim(),
        returnPolicyInfo: form.returnPolicyInfo.trim(),
        shippingInfo: form.shippingInfo.trim(),
        deliveryNotes: form.deliveryNotes.trim(),
        relatedProductIds: form.relatedProductIds,
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        metaKeywords: form.metaKeywordsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        canonicalUrl: form.canonicalUrl.trim(),
        ogImage: form.ogImage,
        images: form.images,
        videoUrl: form.videoUrl.trim(),
        videoThumbnail: form.videoThumbnail,
        variants: form.variants.map((v) => {
          const opts: Record<string, string> = {};
          for (const row of v.optionRows) {
            if (row.key.trim() && row.value.trim()) {
              opts[row.key.trim()] = row.value.trim();
            }
          }
          return {
            _id: v._id,
            sku: v.sku.trim().toUpperCase(),
            title: v.title.trim(),
            price: v.price ? Number(v.price) : null,
            stockOnHand: Number(v.stockOnHand),
            lowStockThreshold: Number(v.lowStockThreshold),
            options: opts,
            image: v.image || null,
            isActive: v.isActive,
          };
        }),
      };

      const url = editingId
        ? `/api/catalog/admin/products/${editingId}`
        : '/api/catalog/admin/products';
      const method = editingId ? 'PATCH' : 'POST';

      await apiRequest(url, { method, body: JSON.stringify(payload) });
      setFormOpen(false);
      dispatch(
        pushToast({
          variant: 'success',
          message: editingId ? 'Product updated.' : 'New product created.',
        })
      );
      loadData();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save product.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      await downloadCsvRequest('/api/catalog/admin/products/export/csv', 'novara-catalog-export.csv');
      dispatch(pushToast({ variant: 'success', message: 'Catalog CSV downloaded.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'CSV export failed.',
        })
      );
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    try {
      const res = await apiRequest<{
        importedCount: number;
        errorCount: number;
      }>('/api/catalog/admin/products/import/csv', {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      });
      setCsvOpen(false);
      dispatch(
        pushToast({
          variant: res.errorCount > 0 ? 'warning' : 'success',
          message: `Imported ${res.importedCount} product(s). ${res.errorCount} row error(s).`,
        })
      );
      loadData();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Bulk CSV import failed.',
        })
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/catalog/admin/products/${deleteTarget._id}`, {
        method: 'DELETE',
      });
      dispatch(pushToast({ variant: 'info', message: `Product "${deleteTarget.name}" deleted.` }));
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to delete product.',
        })
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const subcategoriesForSelected = categories.filter(
    (c) => Boolean(c.parentId) && extractEntityId(c.parentId) === form.categoryId
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            loadData();
          }}
          className="flex items-center gap-2 flex-1 max-w-md"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => setCsvOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4" /> Bulk CSV Import
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">SKU</th>
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-right px-4 py-3 font-semibold">Price</th>
                <th className="text-center px-4 py-3 font-semibold">Stock</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    No products found. Add a product or seed the Bangladesh catalog from Overview.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={p.images?.[0]?.url}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate max-w-[240px]">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {p.variants?.length ? `${p.variants.length} variant(s)` : 'Simple SKU'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.sku}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {typeof p.categoryId === 'object' ? p.categoryId?.name : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatBdt(p.salePrice || p.basePrice)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {p.variants?.length
                        ? p.variants.reduce((s, v) => s + (v.stockOnHand - v.reservedStock), 0)
                        : p.stockOnHand - p.reservedStock}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          p.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700'
                            : p.status === 'draft'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openDetailsModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                          title="Inspect Product Details"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                        <Link
                          to={`/product/${p.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-emerald-700"
                          title="Preview Product Detail Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Live
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-600"
                          title="Delete Product"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-xs text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Create / Edit Tabbed Product Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Product Details' : 'Create New Product'}
        maxWidthClass="max-w-4xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {/* Modal Editor Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2">
            {(
              [
                ['basic', 'Basic Info'],
                ['pricing', 'Pricing & Stock'],
                ['media', 'Media & Video'],
                ['specs', 'Highlights & Specs'],
                ['variants', `Variants (${form.variants.length})`],
                ['policies', 'Policies, Related & SEO'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setEditorTab(tabKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  editorTab === tabKey
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {editorTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name (English)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({
                        ...f,
                        name: val,
                        slug: editingId
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bangla Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.nameBn}
                    onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary SKU
                    </label>
                    <input
                      type="text"
                      required
                      value={form.sku}
                      onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Barcode (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.barcode}
                      onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoryId: e.target.value, subcategoryId: '' }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subcategory
                  </label>
                  <select
                    value={form.subcategoryId}
                    onChange={(e) => setForm((f) => ({ ...f, subcategoryId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="">None</option>
                    {subcategoriesForSelected.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <select
                    value={form.brandId}
                    onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="">No Brand</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category Domain
                  </label>
                  <select
                    value={form.categoryDomain}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        categoryDomain: e.target.value as Product['categoryDomain'],
                      }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="books">Books</option>
                    <option value="beauty">Beauty</option>
                    <option value="home_lifestyle">Home & Living</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Summary (Displayed above Buy Buttons)
                </label>
                <input
                  type="text"
                  maxLength={320}
                  value={form.shortDescription}
                  onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
                  placeholder="Concise 1–2 sentence overview shown on Product Detail Hero"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Description
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full p-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bangla/English Search Keywords (comma separated)
                </label>
                <input
                  type="text"
                  value={form.bilingualKeywordsText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bilingualKeywordsText: e.target.value }))
                  }
                  placeholder="স্মার্টফোন, ফোন, mobile"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-700 pt-1">
                <div>
                  <label className="mr-2 font-semibold">Publish Status:</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as Product['status'] }))
                    }
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                  />
                  <span>Featured</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isBestSeller}
                    onChange={(e) => setForm((f) => ({ ...f, isBestSeller: e.target.checked }))}
                  />
                  <span>Best Seller</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isNewArrival}
                    onChange={(e) => setForm((f) => ({ ...f, isNewArrival: e.target.checked }))}
                  />
                  <span>New Arrival</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.codEligible}
                    onChange={(e) => setForm((f) => ({ ...f, codEligible: e.target.checked }))}
                  />
                  <span>Cash on Delivery Eligible</span>
                </label>
              </div>
            </div>
          )}

          {editorTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Regular Base Price (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.basePrice}
                    onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discounted Sale Price (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.salePrice}
                    onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Flash Sale Price (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.flashSalePrice}
                    onChange={(e) => setForm((f) => ({ ...f, flashSalePrice: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Price (৳ Internal)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.purchasePrice}
                    onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                    placeholder="Optional"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Landed Cost Price (৳ Internal)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.costPrice}
                    onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                    placeholder="Optional"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Order Qty (1–50)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.maxOrderQuantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxOrderQuantity: Number(e.target.value) || 1 }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Flash Sale Start (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.flashSaleStart}
                    onChange={(e) => setForm((f) => ({ ...f, flashSaleStart: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Flash Sale End (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.flashSaleEnd}
                    onChange={(e) => setForm((f) => ({ ...f, flashSaleEnd: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Stock on Hand
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.stockOnHand}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stockOnHand: Number(e.target.value) }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Warning Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.lowStockThreshold}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lowStockThreshold: Number(e.target.value) }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.allowBackorders}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, allowBackorders: e.target.checked }))
                    }
                  />
                  <span>Allow Backorders / Pre-order when 0 stock</span>
                </label>
              </div>
            </div>
          )}

          {editorTab === 'media' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Product Gallery Images ({form.images.length})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Image #1 is the primary hero image. Reorder, edit alt text, or upload multiple photos.
                    </p>
                  </div>
                  <CloudinaryUploadField
                    folder="products"
                    label="Add Gallery Image"
                    onUploaded={(asset) =>
                      setForm((f) => ({ ...f, images: [...f.images, asset] }))
                    }
                  />
                </div>

                {form.images.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {form.images.map((img, i) => (
                      <div
                        key={`${img.publicId}-${i}`}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex gap-3 items-center"
                      >
                        <SafeImage
                          src={img.url}
                          alt={img.alt || form.name}
                          className="w-16 h-16 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase text-emerald-700">
                              {i === 0 ? 'Primary Hero' : `Image #${i + 1}`}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    images: reorderArrayItem(f.images, i, i - 1),
                                  }))
                                }
                                title="Move left"
                                className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={i === form.images.length - 1}
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    images: reorderArrayItem(f.images, i, i + 1),
                                  }))
                                }
                                title="Move right"
                                className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              {i > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      images: reorderArrayItem(f.images, i, 0),
                                    }))
                                  }
                                  title="Make Primary"
                                  className="p-1 rounded border border-slate-200 bg-white text-amber-600"
                                >
                                  <Star className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    images: f.images.filter((_, idx) => idx !== i),
                                  }))
                                }
                                aria-label="Remove image"
                                className="p-1 rounded border border-red-200 bg-red-50 text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={img.alt || ''}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                images: f.images.map((item, idx) =>
                                  idx === i ? { ...item, alt: e.target.value } : item
                                ),
                              }))
                            }
                            placeholder="Image alt text"
                            className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Video & Thumbnail */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-800">
                  Product Video (Optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Video URL (YouTube, Vimeo, or direct .mp4/.webm)
                    </label>
                    <input
                      type="url"
                      value={form.videoUrl}
                      onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <CloudinaryUploadField
                      folder="products"
                      label="Upload Video Poster Thumbnail"
                      onUploaded={(asset) => setForm((f) => ({ ...f, videoThumbnail: asset }))}
                    />
                    {form.videoThumbnail && (
                      <div className="flex items-center gap-2">
                        <SafeImage
                          src={form.videoThumbnail.url}
                          alt="Video thumbnail"
                          className="w-20 h-12 rounded-lg object-cover border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, videoThumbnail: null }))}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Remove Thumbnail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {editorTab === 'specs' && (
            <div className="space-y-4">
              {/* Highlights Checklist Builder */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-800">
                  Product Highlights Checklist ({form.features.length})
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeatureInput}
                    onChange={(e) => setNewFeatureInput(e.target.value)}
                    placeholder="Add highlight bullet (e.g. Official 1-Year Brand Warranty)"
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newFeatureInput.trim()) return;
                      setForm((f) => ({ ...f, features: [...f.features, newFeatureInput.trim()] }));
                      setNewFeatureInput('');
                    }}
                    className="px-3.5 h-9 rounded-lg bg-[#16A34A] text-white text-xs font-semibold"
                  >
                    + Add
                  </button>
                </div>
                {form.features.length > 0 && (
                  <div className="space-y-1.5">
                    {form.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={feat}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              features: f.features.map((item, i) =>
                                i === idx ? e.target.value : item
                              ),
                            }))
                          }
                          className="flex-1 h-8 px-2.5 rounded border border-slate-200 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              features: f.features.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded bg-red-50 text-red-600"
                          aria-label="Remove highlight"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grouped Specifications Builder */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800">
                    Grouped Specification Tables ({form.specificationGroups.length})
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        specificationGroups: [
                          ...f.specificationGroups,
                          { groupTitle: 'General Specifications', items: [{ label: '', value: '' }] },
                        ],
                      }))
                    }
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Add Spec Group
                  </button>
                </div>

                {form.specificationGroups.map((group, gIdx) => (
                  <div key={gIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={group.groupTitle}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            specificationGroups: f.specificationGroups.map((g, idx) =>
                              idx === gIdx ? { ...g, groupTitle: e.target.value } : g
                            ),
                          }))
                        }
                        placeholder="Group Title (e.g. Audio & Battery)"
                        className="flex-1 h-8 px-2.5 rounded border border-slate-200 bg-white text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            specificationGroups: f.specificationGroups.map((g, idx) =>
                              idx === gIdx
                                ? { ...g, items: [...g.items, { label: '', value: '' }] }
                                : g
                            ),
                          }))
                        }
                        className="px-2.5 h-8 rounded bg-white border border-slate-200 text-xs font-semibold text-emerald-700"
                      >
                        + Row
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            specificationGroups: f.specificationGroups.filter((_, idx) => idx !== gIdx),
                          }))
                        }
                        className="p-1.5 rounded bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {group.items.map((item, rIdx) => (
                        <div key={rIdx} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                specificationGroups: f.specificationGroups.map((g, idx) =>
                                  idx === gIdx
                                    ? {
                                        ...g,
                                        items: g.items.map((row, j) =>
                                          j === rIdx ? { ...row, label: e.target.value } : row
                                        ),
                                      }
                                    : g
                                ),
                              }))
                            }
                            placeholder="Spec label"
                            className="col-span-5 h-8 px-2 rounded border border-slate-200 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                specificationGroups: f.specificationGroups.map((g, idx) =>
                                  idx === gIdx
                                    ? {
                                        ...g,
                                        items: g.items.map((row, j) =>
                                          j === rIdx ? { ...row, value: e.target.value } : row
                                        ),
                                      }
                                    : g
                                ),
                              }))
                            }
                            placeholder="Value"
                            className="col-span-6 h-8 px-2 rounded border border-slate-200 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                specificationGroups: f.specificationGroups.map((g, idx) =>
                                  idx === gIdx
                                    ? {
                                        ...g,
                                        items: g.items.filter((_, j) => j !== rIdx),
                                      }
                                    : g
                                ),
                              }))
                            }
                            className="col-span-1 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="space-y-2 pt-2">
                  {attributeGroups.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-600">
                        Quick-fill from Attribute Group:
                      </span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const grp = attributeGroups.find((g) => g._id === e.target.value);
                          if (!grp) return;
                          const lines = grp.attributes
                            .map((a) => `${a.label}: ${a.options?.[0] || ''}`)
                            .join('\n');
                          setForm((f) => ({
                            ...f,
                            attributesText: f.attributesText ? `${f.attributesText}\n${lines}` : lines,
                          }));
                        }}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <option value="">Select Attribute Group...</option>
                        {attributeGroups.map((grp) => (
                          <option key={grp._id} value={grp._id}>
                            {grp.name} ({grp.attributes.length} fields)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Additional Flat Specifications &amp; Attributes (`Key: Value` per line)
                  </label>
                  <textarea
                    rows={3}
                    value={form.attributesText}
                    onChange={(e) => setForm((f) => ({ ...f, attributesText: e.target.value }))}
                    placeholder={'Storage: 256GB\nWarranty: 1 Year'}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {editorTab === 'variants' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Add SKU variants with unlimited custom attributes (Color, Storage, RAM, Size, Material) and optional variant-specific image.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      variants: [
                        ...f.variants,
                        {
                          sku: `${f.sku || 'SKU'}-V${f.variants.length + 1}`,
                          title: 'Standard Option',
                          price: '',
                          stockOnHand: 10,
                          lowStockThreshold: 5,
                          optionRows: [{ key: 'Color', value: '' }],
                          image: null,
                          isActive: true,
                        },
                      ],
                    }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 shrink-0"
                >
                  + Add Variant
                </button>
              </div>

              {form.variants.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                    <input
                      type="text"
                      required
                      value={v.sku}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.map((item, i) =>
                            i === idx ? { ...item, sku: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Variant SKU"
                      className="h-8 px-2 rounded border border-slate-200 bg-white text-xs font-mono"
                    />
                    <input
                      type="text"
                      required
                      value={v.title}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.map((item, i) =>
                            i === idx ? { ...item, title: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Display Title"
                      className="h-8 px-2 rounded border border-slate-200 bg-white text-xs sm:col-span-2"
                    />
                    <input
                      type="number"
                      value={v.price}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.map((item, i) =>
                            i === idx ? { ...item, price: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Price override (৳)"
                      className="h-8 px-2 rounded border border-slate-200 bg-white text-xs font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      value={v.stockOnHand}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.map((item, i) =>
                            i === idx ? { ...item, stockOnHand: Number(e.target.value) } : item
                          ),
                        }))
                      }
                      placeholder="Stock"
                      className="h-8 px-2 rounded border border-slate-200 bg-white text-xs font-mono"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={v.isActive}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((item, i) =>
                                i === idx ? { ...item, isActive: e.target.checked } : item
                              ),
                            }))
                          }
                        />
                        <span>Active</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            variants: f.variants.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-1.5 rounded bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Option Attributes */}
                  <div className="space-y-1.5 pl-2 border-l-2 border-emerald-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">
                        Variant Option Attributes
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            variants: f.variants.map((item, i) =>
                              i === idx
                                ? { ...item, optionRows: [...item.optionRows, { key: '', value: '' }] }
                                : item
                            ),
                          }))
                        }
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        + Add Attribute
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {v.optionRows.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt.key}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                variants: f.variants.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        optionRows: item.optionRows.map((r, j) =>
                                          j === oIdx ? { ...r, key: e.target.value } : r
                                        ),
                                      }
                                    : item
                                ),
                              }))
                            }
                            placeholder="Name (e.g. Storage)"
                            className="w-1/2 h-7 px-2 rounded border border-slate-200 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={opt.value}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                variants: f.variants.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        optionRows: item.optionRows.map((r, j) =>
                                          j === oIdx ? { ...r, value: e.target.value } : r
                                        ),
                                      }
                                    : item
                                ),
                              }))
                            }
                            placeholder="Value (e.g. 256GB)"
                            className="w-1/2 h-7 px-2 rounded border border-slate-200 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                variants: f.variants.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        optionRows: item.optionRows.filter((_, j) => j !== oIdx),
                                      }
                                    : item
                                ),
                              }))
                            }
                            className="px-1.5 h-7 rounded bg-red-50 text-red-600 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Variant Image */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <CloudinaryUploadField
                      folder="products"
                      label="Variant Image (Optional)"
                      onUploaded={(asset) =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.map((item, i) =>
                            i === idx ? { ...item, image: asset } : item
                          ),
                        }))
                      }
                    />
                    {v.image?.url && (
                      <div className="flex items-center gap-2">
                        <SafeImage
                          src={v.image.url}
                          alt={v.title}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((item, i) =>
                                i === idx ? { ...item, image: null } : item
                              ),
                            }))
                          }
                          className="text-[11px] font-semibold text-red-600 hover:underline"
                        >
                          Clear Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {editorTab === 'policies' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Warranty Info
                  </label>
                  <input
                    type="text"
                    value={form.warrantyInfo}
                    onChange={(e) => setForm((f) => ({ ...f, warrantyInfo: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Return Policy Override
                  </label>
                  <input
                    type="text"
                    value={form.returnPolicyInfo}
                    onChange={(e) => setForm((f) => ({ ...f, returnPolicyInfo: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Shipping Details (Shipping Tab)
                  </label>
                  <textarea
                    rows={3}
                    value={form.shippingInfo}
                    onChange={(e) => setForm((f) => ({ ...f, shippingInfo: e.target.value }))}
                    placeholder="Leave blank to use Store Settings shipping policy."
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Note Badge
                  </label>
                  <textarea
                    rows={3}
                    value={form.deliveryNotes}
                    onChange={(e) => setForm((f) => ({ ...f, deliveryNotes: e.target.value }))}
                    placeholder="e.g. Express same-day courier available inside Dhaka."
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Manual Related Products */}
              <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-slate-800">
                  Related Products Override (Selected: {form.relatedProductIds.length})
                </p>
                <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {products
                    .filter((item) => item._id !== editingId)
                    .map((item) => {
                      const checked = form.relatedProductIds.includes(item._id);
                      return (
                        <label
                          key={item._id}
                          className="flex items-center gap-2 text-xs text-slate-700 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextChecked = e.target.checked;
                              setForm((f) => ({
                                ...f,
                                relatedProductIds: nextChecked
                                  ? [...f.relatedProductIds, item._id]
                                  : f.relatedProductIds.filter((id) => id !== item._id),
                              }));
                            }}
                          />
                          <span className="truncate">{item.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* SEO Metadata */}
              <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-slate-800">SEO & OpenGraph Settings</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Meta Title
                    </label>
                    <input
                      type="text"
                      maxLength={140}
                      value={form.seoTitle}
                      onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Canonical URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.canonicalUrl}
                      onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))}
                      placeholder="/product/your-slug"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Meta Description
                  </label>
                  <textarea
                    rows={2}
                    maxLength={260}
                    value={form.seoDescription}
                    onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Meta Keywords (comma separated)
                  </label>
                  <input
                    type="text"
                    value={form.metaKeywordsText}
                    onChange={(e) => setForm((f) => ({ ...f, metaKeywordsText: e.target.value }))}
                    placeholder="earbuds, bluetooth, bangladesh electronics"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <CloudinaryUploadField
                    folder="products"
                    label="OG Share Image (Optional)"
                    onUploaded={(asset) => setForm((f) => ({ ...f, ogImage: asset }))}
                  />
                  {form.ogImage && (
                    <div className="flex items-center gap-2">
                      <SafeImage
                        src={form.ogImage.url}
                        alt="OG share preview"
                        className="w-16 h-10 rounded object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, ogImage: null }))}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remove OG Image
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div>
              {editingId && form.slug && (
                <Link
                  to={`/product/${form.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview Live PDP</span>
                </Link>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        title="Bulk Product CSV Import"
        description="Up to 500 rows per batch. Columns: sku,name,slug,categorySlug,brandSlug,basePrice,salePrice,stockOnHand,status"
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleImportCsv} className="space-y-4">
          <textarea
            rows={10}
            required
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCsvOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing}
              className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {importing ? 'Importing...' : 'Run CSV Import'}
            </button>
          </div>
        </form>
      </Modal>
      {/* Product Details Inspection Modal */}
      <Modal
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        title={detailProduct ? `Product Details — ${detailProduct.name}` : 'Product Details'}
        maxWidthClass="max-w-3xl"
      >
        {detailProduct && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <SafeImage
                src={detailProduct.images?.[0]?.url}
                alt={detailProduct.name}
                className="w-24 h-24 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
              />
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{detailProduct.sku}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold uppercase text-[10px]">
                    {detailProduct.status}
                  </span>
                  {detailProduct.isFeatured && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold uppercase text-[10px]">
                      Featured
                    </span>
                  )}
                  {detailProduct.isBestSeller && (
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold uppercase text-[10px]">
                      Best Seller
                    </span>
                  )}
                  {detailProduct.isNewArrival && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold uppercase text-[10px]">
                      New Arrival
                    </span>
                  )}
                </div>
                <p className="text-sm font-extrabold text-slate-900">{detailProduct.name}</p>
                <p className="text-slate-600">{detailProduct.shortDescription || detailProduct.description}</p>
                <div className="flex flex-wrap gap-4 pt-1 font-mono">
                  <span>Base: <strong>{formatBdt(detailProduct.basePrice)}</strong></span>
                  {detailProduct.salePrice ? <span>Sale: <strong className="text-[#16A34A]">{formatBdt(detailProduct.salePrice)}</strong></span> : null}
                  {detailProduct.purchasePrice ? <span>Purchase: <strong>{formatBdt(detailProduct.purchasePrice)}</strong></span> : null}
                  {detailProduct.costPrice ? <span>Cost: <strong>{formatBdt(detailProduct.costPrice)}</strong></span> : null}
                  <span>Stock: <strong>{detailProduct.stockOnHand}</strong></span>
                  <span>Sold: <strong>{detailProduct.salesCount}</strong></span>
                </div>
              </div>
            </div>

            {detailProduct.variants?.length > 0 && (
              <div>
                <p className="font-bold text-slate-800 mb-1.5">Variants ({detailProduct.variants.length})</p>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {detailProduct.variants.map((v) => (
                    <div key={v._id} className="px-3 py-2 flex items-center justify-between">
                      <span>
                        <strong>{v.title}</strong> <span className="font-mono text-slate-400">({v.sku})</span>
                      </span>
                      <span className="font-mono">
                        {formatBdt(v.price ?? detailProduct.basePrice)} · Avail: {Math.max(0, v.stockOnHand - v.reservedStock)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const target = detailProduct;
                  setDetailProduct(null);
                  openEditModal(target);
                }}
                className="px-4 py-2 rounded-lg bg-[#16A34A] text-white font-semibold"
              >
                Edit Product
              </button>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteProduct}
        title="Delete Product"
        message={`Permanently delete "${deleteTarget?.name || ''}" (${deleteTarget?.sku || ''})? Products referenced by existing orders cannot be deleted and must be archived instead.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete Product'}
        danger
      />
    </div>
  );
}
