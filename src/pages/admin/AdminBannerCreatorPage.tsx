import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Code2,
  Droplet,
  Eye,
  Grid,
  Image as ImageIcon,
  Layers,
  Loader2,
  Monitor,
  PlayCircle,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShoppingCart,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
} from 'lucide-react';
import {
  BANNER_POSITION_OPTIONS,
  BANNER_SIZE_OPTIONS,
  DEFAULT_BANNER_DRAFT,
  sanitizeCustomCss,
  validateBannerDraft,
  type BannerAspectRatio,
  type BannerBackgroundType,
  type BannerDraftConfig,
  type BannerFontFamily,
  type BannerFontWeight,
  type BannerPositionSlot,
  type BannerProductSelectionMode,
  type BannerSizePreset,
} from '../../../shared/bannerHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { BannerPreviewModal } from '../../components/admin/banner/BannerPreviewModal.tsx';
import {
  BANNER_GRADIENT_PRESETS,
  BANNER_TEMPLATE_PRESETS,
  BUNDLED_BANNER_IMAGES,
} from '../../components/admin/banner/bannerPresets.ts';
import { LiveBannerPreview } from '../../components/admin/banner/LiveBannerPreview.tsx';
import { ProductPickerModal } from '../../components/admin/banner/ProductPickerModal.tsx';
import { SavedBannersPanel } from '../../components/admin/banner/SavedBannersPanel.tsx';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type {
  BannerResolvedProduct,
  Category,
  DynamicBannerRecord,
  Product,
  StaticPage,
} from '../../types/domain.ts';

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromBannerRecordToDraft(record: DynamicBannerRecord): BannerDraftConfig {
  return {
    _id: record._id,
    name: record.name || 'Untitled Banner',
    aspectRatio: record.aspectRatio || '16:9',
    customAspectWidth: record.customAspectWidth || 16,
    customAspectHeight: record.customAspectHeight || 9,
    bannerSize: record.bannerSize || 'full_width',
    position: (record.position as BannerPositionSlot) || 'homepage_top_slider',
    displayOrder: record.displayOrder ?? 1,
    priority: record.priority ?? 10,
    isActive: record.isActive ?? true,
    status: record.status || 'published',
    startsAt: record.startsAt || null,
    endsAt: record.endsAt || null,

    badgeText: record.badgeText || '',
    mainHeading: record.mainHeading || '',
    highlightText: record.highlightText || '',
    subHeading: record.subHeading || '',
    buttonText: record.buttonText || '',
    buttonLink: record.buttonLink || '/shop',
    altText: record.altText || '',
    fontFamily: record.fontFamily || 'Poppins',
    fontWeight: record.fontWeight || '700',
    textAlignment: record.textAlignment || 'left',
    letterSpacingPx: record.letterSpacingPx ?? 0,
    textColor: record.textColor || '#FFFFFF',
    highlightColor: record.highlightColor || '#A3E635',
    buttonBgColor: record.buttonBgColor || '#A3E635',
    buttonTextColor: record.buttonTextColor || '#0F172A',

    backgroundType: record.backgroundType || 'gradient',
    solidColor: record.solidColor || '#15803D',
    gradientStart: record.gradientStart || '#06381C',
    gradientEnd: record.gradientEnd || '#22C55E',
    gradientDirection: record.gradientDirection || '135deg',
    backgroundOpacity: record.backgroundOpacity ?? 100,
    desktopImageUrl: record.desktopImageUrl || '',
    desktopImagePublicId: record.desktopImagePublicId || '',
    mobileImageUrl: record.mobileImageUrl || '',
    mobileImagePublicId: record.mobileImagePublicId || '',

    productSelectionMode: record.productSelectionMode || 'none',
    selectedProductIds: Array.isArray(record.selectedProductIds) ? record.selectedProductIds : [],
    targetCategorySlugs: Array.isArray(record.targetCategorySlugs) ? record.targetCategorySlugs : [],
    targetCustomPageSlugs: Array.isArray(record.targetCustomPageSlugs)
      ? record.targetCustomPageSlugs
      : [],

    animationEffect: record.animationEffect || 'fade',
    animationSpeed: record.animationSpeed || 'normal',
    autoPlay: record.autoPlay ?? true,
    loop: record.loop ?? true,
    animationDelaySec: record.animationDelaySec ?? 3,

    bannerWidthPx: record.bannerWidthPx ?? 1920,
    bannerHeightPx: record.bannerHeightPx ?? 460,
    paddingPx: record.paddingPx ?? 36,
    borderRadiusPx: record.borderRadiusPx ?? 20,
    boxShadow: record.boxShadow ?? true,

    overlayEnabled: record.overlayEnabled ?? false,
    overlayColor: record.overlayColor || '#052E16',
    overlayOpacity: record.overlayOpacity ?? 35,
    patternEnabled: record.patternEnabled ?? false,
    patternType: record.patternType || 'dots',
    blurEnabled: record.blurEnabled ?? false,
    blurPx: record.blurPx ?? 6,
    customCss: record.customCss || '',
  };
}

export function AdminBannerCreatorPage() {
  const dispatch = useAppDispatch();

  const [draft, setDraft] = useState<BannerDraftConfig>({ ...DEFAULT_BANNER_DRAFT });
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [savedBanners, setSavedBanners] = useState<DynamicBannerRecord[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customCssModalOpen, setCustomCssModalOpen] = useState(false);
  const [customCssDraft, setCustomCssDraft] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DynamicBannerRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPresetImages, setShowPresetImages] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [customProducts, setCustomProducts] = useState<BannerResolvedProduct[]>([]);
  const [autoProducts, setAutoProducts] = useState<BannerResolvedProduct[]>([]);

  const groupedPositions = useMemo(() => {
    const groups = new Map<string, typeof BANNER_POSITION_OPTIONS>();
    for (const opt of BANNER_POSITION_OPTIONS) {
      const existing = groups.get(opt.group) || [];
      existing.push(opt);
      groups.set(opt.group, existing);
    }
    return Array.from(groups.entries());
  }, []);

  const loadBannersAndMeta = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const [bannersRes, catRes, pagesRes] = await Promise.all([
        apiRequest<{ banners: DynamicBannerRecord[] }>('/api/cms/admin/banners'),
        apiRequest<{ categories: Category[] }>('/api/catalog/categories?all=true').catch(() => ({
          categories: [],
        })),
        apiRequest<{ pages: StaticPage[] }>('/api/cms/admin/pages').catch(() => ({ pages: [] })),
      ]);
      setSavedBanners(bannersRes.banners || []);
      setCategories(catRes.categories || []);
      setStaticPages((pagesRes.pages || []).filter((p) => p.pageType === 'custom' || p.isPublished));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to load saved banners.',
        })
      );
    } finally {
      setLoadingQueue(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadBannersAndMeta();
  }, [loadBannersAndMeta]);

  // Resolve live product cards inside canvas when productSelectionMode is featured/best_sellers/latest
  useEffect(() => {
    if (draft.productSelectionMode === 'none' || draft.productSelectionMode === 'custom') {
      setAutoProducts([]);
      return;
    }

    let active = true;
    const queryMap: Record<'featured' | 'best_sellers' | 'latest', string> = {
      featured: '/api/catalog/products?limit=4&tab=all',
      best_sellers: '/api/catalog/products?sort=best_selling&limit=4',
      latest: '/api/catalog/products?sort=newest&limit=4',
    };

    apiRequest<{ products: Product[] }>(queryMap[draft.productSelectionMode])
      .then((res) => {
        if (!active) return;
        setAutoProducts(
          (res.products || []).slice(0, 4).map((p) => ({
            _id: p._id,
            name: p.name,
            slug: p.slug,
            basePrice: p.basePrice,
            salePrice: p.salePrice,
            flashSalePrice: p.flashSalePrice,
            images: p.images,
            ratingAverage: p.ratingAverage,
            ratingCount: p.ratingCount,
          }))
        );
      })
      .catch(() => {
        if (active) setAutoProducts([]);
      });

    return () => {
      active = false;
    };
  }, [draft.productSelectionMode]);

  // Resolve custom products by IDs when editing a saved banner with custom products
  useEffect(() => {
    if (draft.productSelectionMode !== 'custom' || draft.selectedProductIds.length === 0) {
      return;
    }
    const alreadyLoaded = draft.selectedProductIds.every((id) =>
      customProducts.some((p) => p._id === id)
    );
    if (alreadyLoaded) return;

    let active = true;
    apiRequest<{ products: Product[] }>('/api/catalog/products/by-ids', {
      method: 'POST',
      body: JSON.stringify({ ids: draft.selectedProductIds }),
    })
      .then((res) => {
        if (!active) return;
        setCustomProducts(
          (res.products || []).slice(0, 4).map((p) => ({
            _id: p._id,
            name: p.name,
            slug: p.slug,
            basePrice: p.basePrice,
            salePrice: p.salePrice,
            flashSalePrice: p.flashSalePrice,
            images: p.images,
            ratingAverage: p.ratingAverage,
            ratingCount: p.ratingCount,
          }))
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [draft.productSelectionMode, draft.selectedProductIds, customProducts]);

  const activePreviewProducts = useMemo(() => {
    if (draft.productSelectionMode === 'none') return [];
    if (draft.productSelectionMode === 'custom') return customProducts;
    return autoProducts;
  }, [draft.productSelectionMode, customProducts, autoProducts]);

  const updateDraft = useCallback((patch: Partial<BannerDraftConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setValidationErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      for (const key of Object.keys(patch)) {
        delete next[key];
      }
      if ('startsAt' in patch || 'endsAt' in patch) delete next.schedule;
      return next;
    });
  }, []);

  const handleSizePresetChange = (size: BannerSizePreset) => {
    const preset = BANNER_SIZE_OPTIONS.find((s) => s.value === size);
    if (preset && size !== 'custom') {
      updateDraft({
        bannerSize: size,
        bannerWidthPx: preset.widthPx,
        bannerHeightPx: preset.heightPx,
      });
    } else {
      updateDraft({ bannerSize: size });
    }
  };

  const handleApplyGradientPreset = (presetId: string) => {
    const preset = BANNER_GRADIENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    updateDraft({
      gradientStart: preset.start,
      gradientEnd: preset.end,
      solidColor: preset.solid,
      gradientDirection: preset.direction,
    });
  };

  const handleStartNewBanner = () => {
    setEditingBannerId(null);
    setCustomProducts([]);
    setValidationErrors({});
    setDraft({
      ...DEFAULT_BANNER_DRAFT,
      displayOrder: savedBanners.length + 1,
    });
  };

  const handleResetConfirmed = () => {
    setResetConfirmOpen(false);
    setValidationErrors({});
    if (editingBannerId) {
      const original = savedBanners.find((b) => b._id === editingBannerId);
      if (original) {
        setDraft(fromBannerRecordToDraft(original));
        dispatch(pushToast({ variant: 'info', message: 'Restored saved banner state.' }));
        return;
      }
    }
    setEditingBannerId(null);
    setCustomProducts([]);
    setDraft({ ...DEFAULT_BANNER_DRAFT });
    dispatch(pushToast({ variant: 'info', message: 'Banner editor reset to defaults.' }));
  };

  const handleSaveBanner = async () => {
    const check = validateBannerDraft(draft);
    if (!check.valid) {
      setValidationErrors(check.errors);
      dispatch(
        pushToast({
          variant: 'error',
          message: Object.values(check.errors)[0] || 'Please review highlighted banner fields.',
        })
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        name: (draft.name || draft.mainHeading).trim().slice(0, 120),
        altText: (draft.altText || draft.mainHeading).trim().slice(0, 180),
        displayOrder: Math.max(0, Number(draft.displayOrder) || 0),
        priority: Math.max(0, Number(draft.priority) || 0),
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      };

      const url = editingBannerId
        ? `/api/cms/admin/banners/${editingBannerId}`
        : '/api/cms/admin/banners';
      const res = await apiRequest<{ banner: DynamicBannerRecord }>(url, {
        method: editingBannerId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });

      dispatch(
        pushToast({
          variant: 'success',
          message: editingBannerId ? 'Banner updated & synced to storefront.' : 'Banner created & saved.',
        })
      );
      if (res.banner) {
        setEditingBannerId(res.banner._id);
        setDraft(fromBannerRecordToDraft(res.banner));
      }
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      await loadBannersAndMeta();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save banner.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditFromQueue = (item: DynamicBannerRecord) => {
    setEditingBannerId(item._id);
    setValidationErrors({});
    setDraft(fromBannerRecordToDraft(item));
    if (item.resolvedProducts?.length) {
      setCustomProducts(item.resolvedProducts);
    } else {
      setCustomProducts([]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleQueueActive = async (item: DynamicBannerRecord) => {
    try {
      await apiRequest<{ banner: DynamicBannerRecord }>(`/api/cms/admin/banners/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (editingBannerId === item._id) {
        updateDraft({ isActive: !item.isActive });
      }
      dispatch(
        pushToast({
          variant: 'success',
          message: `${item.name} is now ${!item.isActive ? 'active' : 'inactive'}.`,
        })
      );
      await loadBannersAndMeta();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to toggle banner status.',
        })
      );
    }
  };

  const handleDuplicateFromQueue = async (item: DynamicBannerRecord) => {
    try {
      await apiRequest(`/api/cms/admin/banners/${item._id}/duplicate`, {
        method: 'POST',
      });
      dispatch(pushToast({ variant: 'success', message: `Duplicated "${item.name}".` }));
      await loadBannersAndMeta();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to duplicate banner.',
        })
      );
    }
  };

  const handleMoveInQueue = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= savedBanners.length) return;
    const reordered = [...savedBanners];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    const orderedIds = reordered.map((b) => b._id);
    setSavedBanners(reordered.map((b, idx) => ({ ...b, displayOrder: idx + 1 })));

    try {
      await apiRequest('/api/cms/admin/banners/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      });
      dispatch(pushToast({ variant: 'success', message: 'Banner display order updated.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save banner order.',
        })
      );
      await loadBannersAndMeta();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/cms/admin/banners/${deleteTarget._id}`, {
        method: 'DELETE',
      });
      if (editingBannerId === deleteTarget._id) {
        handleStartNewBanner();
      }
      dispatch(pushToast({ variant: 'info', message: `Deleted "${deleteTarget.name}".` }));
      setDeleteTarget(null);
      await loadBannersAndMeta();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to delete banner.',
        })
      );
    } finally {
      setDeleting(false);
    }
  };

  const cssAudit = useMemo(() => sanitizeCustomCss(customCssDraft), [customCssDraft]);
  const showCategoryTargeting =
    draft.position === 'category_page_banner' ||
    draft.position === 'category_page_sidebar' ||
    draft.position === 'product_listing_page' ||
    draft.position === 'product_detail_page';

  const currentBannerForModal: BannerDraftConfig = {
    ...draft,
    _id: editingBannerId || undefined,
  };

  return (
    <div className="space-y-4">
      {/* A. Header Toolbar */}
      <header className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] text-white flex items-center justify-center shadow-sm shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Banner Creator
              </h1>
              {editingBannerId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  Editing Saved Banner
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create stunning and dynamic banners for your website
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {editingBannerId && (
            <button
              type="button"
              onClick={handleStartNewBanner}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Banner</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveBanner()}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving...' : editingBannerId ? 'Update Banner' : 'Save Banner'}</span>
          </button>
        </div>
      </header>

      {/* B. Banner Configuration Toolbar */}
      <section
        aria-label="Banner Configuration Toolbar"
        className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Aspect Ratio Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Aspect Ratio:</span>
            <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
              {(['16:9', '4:3', '1:1', '21:9', 'custom'] as BannerAspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => updateDraft({ aspectRatio: ratio })}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                    draft.aspectRatio === ratio
                      ? 'bg-[#16A34A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 bg-white/70'
                  }`}
                >
                  {ratio === 'custom' ? 'Custom' : ratio}
                </button>
              ))}
            </div>
            {draft.aspectRatio === 'custom' && (
              <div className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={40}
                  aria-label="Custom aspect ratio width"
                  value={draft.customAspectWidth}
                  onChange={(e) =>
                    updateDraft({ customAspectWidth: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-12 h-8 px-2 rounded-lg border border-slate-200 text-xs text-center font-mono tabular-nums"
                />
                <span className="text-xs text-slate-400">:</span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  aria-label="Custom aspect ratio height"
                  value={draft.customAspectHeight}
                  onChange={(e) =>
                    updateDraft({ customAspectHeight: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-12 h-8 px-2 rounded-lg border border-slate-200 text-xs text-center font-mono tabular-nums"
                />
              </div>
            )}
          </div>

          {/* Banner Size */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="bc-banner-size" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Banner Size:
            </label>
            <select
              id="bc-banner-size"
              value={draft.bannerSize}
              onChange={(e) => handleSizePresetChange(e.target.value as BannerSizePreset)}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600 max-w-[175px]"
            >
              {BANNER_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Placement Position */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="bc-banner-position" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Position:
            </label>
            <select
              id="bc-banner-position"
              value={draft.position}
              onChange={(e) => updateDraft({ position: e.target.value as BannerPositionSlot })}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600 max-w-[185px]"
            >
              {groupedPositions.map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Order */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="bc-display-order" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Order:
            </label>
            <input
              id="bc-display-order"
              type="number"
              min={0}
              max={999}
              value={draft.displayOrder}
              onChange={(e) => updateDraft({ displayOrder: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs font-mono tabular-nums text-slate-800 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Active Switch */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={draft.isActive}
            aria-label="Banner active status"
            onClick={() => updateDraft({ isActive: !draft.isActive })}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-800"
          >
            <span
              className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                draft.isActive ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </span>
            <span>Active</span>
          </button>
        </div>
      </section>

      {/* Validation Alert Banner if Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-red-800"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.values(validationErrors).map((msg, i) => (
              <span key={i} className="font-semibold">
                {msg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* C. Main Editor Stage: Live Banner Canvas (left 8 cols) + Text & Style (right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Live Banner Canvas */}
        <section
          aria-label="Live Banner Canvas"
          className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-3"
        >
          {/* Canvas Top Bar: Templates + Viewport Switcher + Name */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                Templates:
              </span>
              {BANNER_TEMPLATE_PRESETS.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => updateDraft(tpl.patch)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50 text-[11px] font-semibold text-slate-700 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
              {(
                [
                  ['desktop', 'Desktop', Monitor],
                  ['tablet', 'Tablet', Tablet],
                  ['mobile', 'Mobile', Smartphone],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreviewViewport(key)}
                  aria-label={`Preview ${label} viewport`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    previewViewport === key
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Real-Time Preview Stage */}
          <div className="flex-1 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 p-2.5 sm:p-4 overflow-x-auto">
            <div className="w-full">
              <LiveBannerPreview
                banner={draft}
                resolvedProducts={activePreviewProducts}
                viewport={previewViewport}
                slideIndicators={
                  draft.position === 'homepage_top_slider' ? { total: 3, current: 0 } : undefined
                }
              />
            </div>
          </div>

          {/* Internal Campaign Name & Accessibility Alt Text */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="bc-campaign-name" className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                Banner Name:
              </label>
              <input
                id="bc-campaign-name"
                type="text"
                maxLength={120}
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder="Internal banner title..."
                className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bc-alt-text" className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                Image Alt:
              </label>
              <input
                id="bc-alt-text"
                type="text"
                maxLength={180}
                value={draft.altText}
                onChange={(e) => updateDraft({ altText: e.target.value })}
                placeholder="Accessible description for SEO..."
                className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </section>

        {/* D. Right Panel: Text & Style */}
        <aside
          aria-label="Text and Style Settings"
          className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3.5"
        >
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <Type className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">Text &amp; Style</h2>
          </div>

          {/* Main Heading */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bc-main-heading" className="text-xs font-semibold text-slate-700">
                Main Heading
              </label>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {draft.mainHeading.length}/100
              </span>
            </div>
            <input
              id="bc-main-heading"
              type="text"
              maxLength={100}
              value={draft.mainHeading}
              onChange={(e) => updateDraft({ mainHeading: e.target.value })}
              placeholder="Smart Shopping Bigger Savings!"
              className={`w-full h-9 px-3 rounded-lg border text-xs font-medium text-slate-900 focus:outline-none ${
                validationErrors.mainHeading
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-slate-200 focus:border-emerald-600'
              }`}
            />
          </div>

          {/* Highlight Word + Badge Text */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="bc-highlight-word" className="block text-xs font-semibold text-slate-700 mb-1">
                Highlight Word
              </label>
              <input
                id="bc-highlight-word"
                type="text"
                maxLength={40}
                value={draft.highlightText}
                onChange={(e) => updateDraft({ highlightText: e.target.value })}
                placeholder="Bigger"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label htmlFor="bc-badge-text" className="block text-xs font-semibold text-slate-700 mb-1">
                Badge Text
              </label>
              <input
                id="bc-badge-text"
                type="text"
                maxLength={60}
                value={draft.badgeText}
                onChange={(e) => updateDraft({ badgeText: e.target.value })}
                placeholder="Big Savings"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Sub Heading */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bc-sub-heading" className="text-xs font-semibold text-slate-700">
                Sub Heading
              </label>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {draft.subHeading.length}/160
              </span>
            </div>
            <input
              id="bc-sub-heading"
              type="text"
              maxLength={160}
              value={draft.subHeading}
              onChange={(e) => updateDraft({ subHeading: e.target.value })}
              placeholder="Up to 70% Off on Top Brands"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Button Text + Button Link */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="bc-button-text" className="text-xs font-semibold text-slate-700">
                  Button Text
                </label>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {draft.buttonText.length}/30
                </span>
              </div>
              <input
                id="bc-button-text"
                type="text"
                maxLength={30}
                value={draft.buttonText}
                onChange={(e) => updateDraft({ buttonText: e.target.value })}
                placeholder="Shop Now"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label htmlFor="bc-button-link" className="block text-xs font-semibold text-slate-700 mb-1">
                Button Link
              </label>
              <input
                id="bc-button-link"
                type="text"
                maxLength={300}
                value={draft.buttonLink}
                onChange={(e) => updateDraft({ buttonLink: e.target.value })}
                placeholder="/shop"
                className={`w-full h-9 px-3 rounded-lg border text-xs text-slate-900 focus:outline-none ${
                  validationErrors.buttonLink
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
            </div>
          </div>

          {/* Font Family & Font Weight */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="bc-font-family" className="block text-xs font-semibold text-slate-700 mb-1">
                Font Family
              </label>
              <select
                id="bc-font-family"
                value={draft.fontFamily}
                onChange={(e) => updateDraft({ fontFamily: e.target.value as BannerFontFamily })}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
              >
                <option value="Poppins">Poppins</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Outfit">Outfit</option>
                <option value="DM Sans">DM Sans</option>
                <option value="Manrope">Manrope</option>
                <option value="Playfair Display">Playfair Display</option>
              </select>
            </div>
            <div>
              <label htmlFor="bc-font-weight" className="block text-xs font-semibold text-slate-700 mb-1">
                Font Weight
              </label>
              <select
                id="bc-font-weight"
                value={draft.fontWeight}
                onChange={(e) => updateDraft({ fontWeight: e.target.value as BannerFontWeight })}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
              >
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">ExtraBold</option>
              </select>
            </div>
          </div>

          {/* Text Alignment & Letter Spacing */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1">
                Text Alignment
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
                {(
                  [
                    ['left', AlignLeft, 'Align left'],
                    ['center', AlignCenter, 'Align center'],
                    ['right', AlignRight, 'Align right'],
                  ] as const
                ).map(([align, Icon, label]) => (
                  <button
                    key={align}
                    type="button"
                    aria-label={label}
                    onClick={() => updateDraft({ textAlignment: align })}
                    className={`h-7 rounded-md flex items-center justify-center transition-colors ${
                      draft.textAlignment === align
                        ? 'bg-[#16A34A] text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="bc-letter-spacing" className="text-xs font-semibold text-slate-700">
                  Letter Spacing
                </label>
                <span className="text-[11px] font-mono tabular-nums text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {draft.letterSpacingPx}px
                </span>
              </div>
              <input
                id="bc-letter-spacing"
                type="range"
                min={-2}
                max={8}
                step={0.5}
                value={draft.letterSpacingPx}
                onChange={(e) => updateDraft({ letterSpacingPx: Number(e.target.value) })}
                className="w-full accent-[#16A34A] cursor-pointer"
              />
            </div>
          </div>

          {/* 4 Color Swatches Row */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/60 cursor-pointer">
              <span className="text-[11px] font-semibold text-slate-700">Text Color</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label="Text color"
                  value={draft.textColor}
                  onChange={(e) => updateDraft({ textColor: e.target.value })}
                  className="w-6 h-5 rounded border border-slate-300 cursor-pointer bg-transparent p-0"
                />
                <span className="text-[10px] font-mono text-slate-500">{draft.textColor}</span>
              </span>
            </label>

            <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/60 cursor-pointer">
              <span className="text-[11px] font-semibold text-slate-700">Highlight Color</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label="Highlight color"
                  value={draft.highlightColor}
                  onChange={(e) => updateDraft({ highlightColor: e.target.value })}
                  className="w-6 h-5 rounded border border-slate-300 cursor-pointer bg-transparent p-0"
                />
                <span className="text-[10px] font-mono text-slate-500">{draft.highlightColor}</span>
              </span>
            </label>

            <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/60 cursor-pointer">
              <span className="text-[11px] font-semibold text-slate-700">Button Fill</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label="Button background color"
                  value={draft.buttonBgColor}
                  onChange={(e) => updateDraft({ buttonBgColor: e.target.value })}
                  className="w-6 h-5 rounded border border-slate-300 cursor-pointer bg-transparent p-0"
                />
                <span className="text-[10px] font-mono text-slate-500">{draft.buttonBgColor}</span>
              </span>
            </label>

            <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/60 cursor-pointer">
              <span className="text-[11px] font-semibold text-slate-700">Button Text</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label="Button text color"
                  value={draft.buttonTextColor}
                  onChange={(e) => updateDraft({ buttonTextColor: e.target.value })}
                  className="w-6 h-5 rounded border border-slate-300 cursor-pointer bg-transparent p-0"
                />
                <span className="text-[10px] font-mono text-slate-500">{draft.buttonTextColor}</span>
              </span>
            </label>
          </div>
        </aside>
      </div>

      {/* E. Bottom 5-Card Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Card 1: Background Settings */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">Background Settings</h2>
          </div>

          <div className="flex items-center justify-between gap-0.5 p-1 rounded-xl bg-slate-100">
            {(['solid', 'gradient', 'image', 'overlay'] as BannerBackgroundType[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateDraft({ backgroundType: mode })}
                className={`flex-1 px-1 py-1.5 rounded-lg text-[10.5px] font-bold capitalize whitespace-nowrap transition-colors ${
                  draft.backgroundType === mode
                    ? 'bg-[#16A34A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Swatch Palette */}
          <div className="flex items-center justify-between gap-1 py-0.5">
            {BANNER_GRADIENT_PRESETS.map((preset) => {
              const selected =
                draft.gradientStart.toLowerCase() === preset.start.toLowerCase() &&
                draft.gradientEnd.toLowerCase() === preset.end.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-label={`Apply ${preset.label} color theme`}
                  onClick={() => handleApplyGradientPreset(preset.id)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-105 flex items-center justify-center shrink-0 ${
                    selected ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-white shadow-xs'
                  }`}
                  style={{
                    background: `linear-gradient(${preset.direction}, ${preset.start}, ${preset.end})`,
                  }}
                >
                  {selected && <Check className="w-3 h-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>

          {draft.backgroundType === 'solid' ? (
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span className="font-semibold">Solid Color</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={draft.solidColor}
                  onChange={(e) => updateDraft({ solidColor: e.target.value })}
                  className="w-7 h-6 rounded border border-slate-300 cursor-pointer p-0"
                />
                <span className="font-mono text-[11px]">{draft.solidColor}</span>
              </span>
            </label>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="bc-grad-dir" className="text-[11px] font-semibold text-slate-700">
                  Gradient Direction
                </label>
                <select
                  id="bc-grad-dir"
                  value={draft.gradientDirection}
                  onChange={(e) => updateDraft({ gradientDirection: e.target.value })}
                  className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700"
                >
                  <option value="135deg">Diagonal ↘</option>
                  <option value="90deg">Left → Right</option>
                  <option value="180deg">Top → Bottom</option>
                  <option value="45deg">Diagonal ↗</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600">
                  <span>Start</span>
                  <input
                    type="color"
                    aria-label="Gradient start color"
                    value={draft.gradientStart}
                    onChange={(e) => updateDraft({ gradientStart: e.target.value })}
                    className="w-5 h-4 cursor-pointer p-0 border-0"
                  />
                </label>
                <label className="flex items-center justify-between px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600">
                  <span>End</span>
                  <input
                    type="color"
                    aria-label="Gradient end color"
                    value={draft.gradientEnd}
                    onChange={(e) => updateDraft({ gradientEnd: e.target.value })}
                    className="w-5 h-4 cursor-pointer p-0 border-0"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Background Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bc-bg-opacity" className="text-[11px] font-semibold text-slate-700">
                Opacity
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-600">
                {draft.backgroundOpacity}%
              </span>
            </div>
            <input
              id="bc-bg-opacity"
              type="range"
              min={20}
              max={100}
              value={draft.backgroundOpacity}
              onChange={(e) => updateDraft({ backgroundOpacity: Number(e.target.value) })}
              className="w-full accent-[#16A34A] cursor-pointer"
            />
          </div>

          {/* Image Upload & Thumbnail Preview */}
          <div className="flex items-center gap-2 pt-1">
            <div className="w-12 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              {draft.desktopImageUrl ? (
                <SafeImage
                  src={draft.desktopImageUrl}
                  alt="Desktop banner artwork"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                  None
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CloudinaryUploadField
                folder="banners"
                label="Upload Image"
                className="w-full"
                onUploaded={(asset) =>
                  updateDraft({
                    desktopImageUrl: asset.url,
                    desktopImagePublicId: asset.publicId,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPresetImages((v) => !v)}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                {showPresetImages ? 'Hide Bundled Artwork' : 'Choose Storefront Artwork'}
              </button>
              {draft.desktopImageUrl && (
                <button
                  type="button"
                  onClick={() => updateDraft({ desktopImageUrl: '', desktopImagePublicId: '' })}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-600"
                >
                  Clear Image
                </button>
              )}
            </div>

            {showPresetImages && (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {BUNDLED_BANNER_IMAGES.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() =>
                      updateDraft({ desktopImageUrl: img.url, desktopImagePublicId: '' })
                    }
                    className={`rounded-lg overflow-hidden border h-11 ${
                      draft.desktopImageUrl === img.url
                        ? 'border-[#16A34A] ring-2 ring-emerald-200'
                        : 'border-slate-200'
                    }`}
                    title={img.label}
                  >
                    <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              aria-label="Mobile image override URL"
              value={draft.mobileImageUrl}
              onChange={(e) => updateDraft({ mobileImageUrl: e.target.value })}
              placeholder="Optional mobile image URL..."
              className="w-full h-7 px-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-700"
            />
          </div>
        </section>

        {/* Card 2: Product Selection & Targeting */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-extrabold text-slate-900">Product Selection</h2>
            </div>

            <div className="space-y-1.5">
              {(
                [
                  ['none', 'No Product'],
                  ['featured', 'Featured Products'],
                  ['best_sellers', 'Best Sellers'],
                  ['latest', 'Latest Products'],
                  ['custom', 'Custom Products'],
                ] as Array<[BannerProductSelectionMode, string]>
              ).map(([mode, label]) => (
                <label
                  key={mode}
                  className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-0.5"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="productSelectionMode"
                      checked={draft.productSelectionMode === mode}
                      onChange={() => updateDraft({ productSelectionMode: mode })}
                      className="accent-[#16A34A]"
                    />
                    <span className={draft.productSelectionMode === mode ? 'font-bold text-slate-900' : ''}>
                      {label}
                    </span>
                  </span>
                  {mode === 'custom' && draft.selectedProductIds.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 tabular-nums">
                      {draft.selectedProductIds.length}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {showCategoryTargeting && categories.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-600">Target Categories (Optional)</p>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {categories.slice(0, 10).map((cat) => {
                    const active = draft.targetCategorySlugs.includes(cat.slug);
                    return (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? draft.targetCategorySlugs.filter((s) => s !== cat.slug)
                            : [...draft.targetCategorySlugs, cat.slug];
                          updateDraft({ targetCategorySlugs: next });
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                          active
                            ? 'bg-emerald-50 border-[#16A34A] text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {draft.position === 'custom_cms_page' && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-600">Target Page Slugs</p>
                {staticPages.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {staticPages.map((pg) => {
                      const active = draft.targetCustomPageSlugs.includes(pg.slug);
                      return (
                        <button
                          key={pg._id}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? draft.targetCustomPageSlugs.filter((s) => s !== pg.slug)
                              : [...draft.targetCustomPageSlugs, pg.slug];
                            updateDraft({ targetCustomPageSlugs: next });
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            active
                              ? 'bg-emerald-50 border-[#16A34A] text-emerald-800'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          /{pg.slug}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={draft.targetCustomPageSlugs.join(', ')}
                    onChange={(e) =>
                      updateDraft({
                        targetCustomPageSlugs: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="about, festival-deals"
                    className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[11px]"
                  />
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setProductPickerOpen(true)}
            className="w-full h-9 rounded-xl border border-[#16A34A] bg-emerald-50/50 hover:bg-emerald-50 text-[#15803D] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Browse Products</span>
          </button>
        </section>

        {/* Card 3: Animation Settings */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <PlayCircle className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">Animation Settings</h2>
          </div>

          <div>
            <label htmlFor="bc-anim-effect" className="block text-xs font-semibold text-slate-700 mb-1">
              Animation Effect
            </label>
            <select
              id="bc-anim-effect"
              value={draft.animationEffect}
              onChange={(e) =>
                updateDraft({
                  animationEffect: e.target.value as BannerDraftConfig['animationEffect'],
                })
              }
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
            >
              <option value="fade">Fade</option>
              <option value="slide_up">Slide Up</option>
              <option value="slide_left">Slide Left</option>
              <option value="zoom">Zoom</option>
              <option value="none">None</option>
            </select>
          </div>

          <div>
            <label htmlFor="bc-anim-speed" className="block text-xs font-semibold text-slate-700 mb-1">
              Animation Speed
            </label>
            <select
              id="bc-anim-speed"
              value={draft.animationSpeed}
              onChange={(e) =>
                updateDraft({
                  animationSpeed: e.target.value as BannerDraftConfig['animationSpeed'],
                })
              }
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
            >
              <option value="fast">Fast</option>
              <option value="normal">Normal</option>
              <option value="slow">Slow</option>
            </select>
          </div>

          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Auto Play</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.autoPlay}
                aria-label="Toggle auto play"
                onClick={() => updateDraft({ autoPlay: !draft.autoPlay })}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                  draft.autoPlay ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Loop</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.loop}
                aria-label="Toggle loop"
                onClick={() => updateDraft({ loop: !draft.loop })}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                  draft.loop ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bc-anim-delay" className="text-xs font-semibold text-slate-700">
                Animation Delay
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                {draft.animationDelaySec}s
              </span>
            </div>
            <input
              id="bc-anim-delay"
              type="range"
              min={1}
              max={15}
              value={draft.animationDelaySec}
              onChange={(e) => updateDraft({ animationDelaySec: Number(e.target.value) })}
              className="w-full accent-[#16A34A] cursor-pointer"
            />
          </div>
        </section>

        {/* Card 4: Advanced Settings & Scheduling */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">Advanced Settings</h2>
          </div>

          {[
            ['Banner Height', 'bannerHeightPx', 120, 900],
            ['Banner Width', 'bannerWidthPx', 320, 1920],
            ['Padding', 'paddingPx', 0, 96],
            ['Border Radius', 'borderRadiusPx', 0, 48],
          ].map(([label, key, minVal, maxVal]) => (
            <div key={key as string} className="flex items-center justify-between gap-2">
              <label
                htmlFor={`bc-${key as string}`}
                className="text-xs font-semibold text-slate-700"
              >
                {label}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id={`bc-${key as string}`}
                  type="number"
                  min={minVal as number}
                  max={maxVal as number}
                  value={draft[key as keyof BannerDraftConfig] as number}
                  onChange={(e) =>
                    updateDraft({
                      [key as string]: Number(e.target.value) || 0,
                      ...(key === 'bannerWidthPx' || key === 'bannerHeightPx'
                        ? { bannerSize: 'custom' }
                        : {}),
                    } as Partial<BannerDraftConfig>)
                  }
                  className="w-20 h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono tabular-nums text-right"
                />
                <span className="text-[11px] text-slate-400">px</span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-semibold text-slate-700">Box Shadow</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.boxShadow}
              aria-label="Toggle box shadow"
              onClick={() => updateDraft({ boxShadow: !draft.boxShadow })}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                draft.boxShadow ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div>
              <label htmlFor="bc-priority" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                Priority
              </label>
              <input
                id="bc-priority"
                type="number"
                min={0}
                max={999}
                value={draft.priority}
                onChange={(e) => updateDraft({ priority: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-7 px-2 rounded-lg border border-slate-200 text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="bc-status" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                Status
              </label>
              <select
                id="bc-status"
                aria-label="Banner publish status"
                value={draft.status}
                onChange={(e) => updateDraft({ status: e.target.value as 'draft' | 'published' })}
                className="w-full h-7 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">Schedule Window</span>
              {(draft.startsAt || draft.endsAt) && (
                <button
                  type="button"
                  onClick={() => updateDraft({ startsAt: null, endsAt: null })}
                  className="text-[10px] font-semibold text-red-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="datetime-local"
              aria-label="Schedule start date"
              value={toDatetimeLocalValue(draft.startsAt)}
              onChange={(e) =>
                updateDraft({
                  startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[11px] text-slate-700"
            />
            <input
              type="datetime-local"
              aria-label="Schedule end date"
              value={toDatetimeLocalValue(draft.endsAt)}
              onChange={(e) =>
                updateDraft({
                  endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[11px] text-slate-700"
            />
          </div>
        </section>

        {/* Card 5: Additional Tools */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">Additional Tools</h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => updateDraft({ overlayEnabled: !draft.overlayEnabled })}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                draft.overlayEnabled
                  ? 'border-[#16A34A] bg-emerald-50/70 text-[#15803D]'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Add Overlay</span>
            </button>

            <button
              type="button"
              onClick={() => updateDraft({ patternEnabled: !draft.patternEnabled })}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                draft.patternEnabled
                  ? 'border-[#16A34A] bg-emerald-50/70 text-[#15803D]'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Add Pattern</span>
            </button>

            <button
              type="button"
              onClick={() => updateDraft({ blurEnabled: !draft.blurEnabled })}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                draft.blurEnabled
                  ? 'border-[#16A34A] bg-emerald-50/70 text-[#15803D]'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Droplet className="w-4 h-4" />
              <span>Blur Effect</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCustomCssDraft(draft.customCss || '');
                setCustomCssModalOpen(true);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                draft.customCss.trim()
                  ? 'border-[#16A34A] bg-emerald-50/70 text-[#15803D]'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Custom CSS</span>
            </button>
          </div>

          {/* Inline Fine-Tuning Controls for Active Tools */}
          {draft.overlayEnabled && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Overlay Tint &amp; Opacity</span>
                <input
                  type="color"
                  aria-label="Overlay tint color"
                  value={draft.overlayColor}
                  onChange={(e) => updateDraft({ overlayColor: e.target.value })}
                  className="w-6 h-4 rounded p-0 border-0 cursor-pointer"
                />
              </div>
              <input
                type="range"
                min={5}
                max={85}
                aria-label="Overlay opacity"
                value={draft.overlayOpacity}
                onChange={(e) => updateDraft({ overlayOpacity: Number(e.target.value) })}
                className="w-full accent-[#16A34A]"
              />
            </div>
          )}

          {draft.patternEnabled && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700">Pattern</span>
              <select
                aria-label="Pattern style"
                value={draft.patternType}
                onChange={(e) =>
                  updateDraft({ patternType: e.target.value as BannerDraftConfig['patternType'] })
                }
                className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
              >
                <option value="dots">Dots</option>
                <option value="grid">Grid</option>
                <option value="diagonal">Diagonal Lines</option>
              </select>
            </div>
          )}

          {draft.blurEnabled && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Blur Intensity</span>
                <span className="font-mono">{draft.blurPx}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                aria-label="Backdrop blur intensity"
                value={draft.blurPx}
                onChange={(e) => updateDraft({ blurPx: Number(e.target.value) })}
                className="w-full accent-[#16A34A]"
              />
            </div>
          )}
        </section>
      </div>

      {/* F. Saved Banners & Placement Queue */}
      <SavedBannersPanel
        banners={savedBanners}
        loading={loadingQueue}
        editingBannerId={editingBannerId}
        onEdit={handleEditFromQueue}
        onPreview={(item) => {
          setEditingBannerId(item._id);
          setDraft(fromBannerRecordToDraft(item));
          if (item.resolvedProducts?.length) setCustomProducts(item.resolvedProducts);
          setPreviewModalOpen(true);
        }}
        onToggleActive={(item) => void handleToggleQueueActive(item)}
        onDuplicate={(item) => void handleDuplicateFromQueue(item)}
        onMove={(idx, dir) => void handleMoveInQueue(idx, dir)}
        onDelete={setDeleteTarget}
      />

      {/* Interactive Preview Modal */}
      <BannerPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        banner={currentBannerForModal}
        resolvedProducts={activePreviewProducts}
      />

      {/* Custom Product Picker Modal */}
      <ProductPickerModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        selectedIds={draft.selectedProductIds}
        onConfirm={(ids, picked) => {
          setCustomProducts(picked);
          updateDraft({
            productSelectionMode: 'custom',
            selectedProductIds: ids,
          });
        }}
      />

      {/* Sanitized Custom CSS Editor Modal */}
      <Modal
        open={customCssModalOpen}
        onClose={() => setCustomCssModalOpen(false)}
        title="Custom Banner CSS (Sanitized)"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Add safe inline CSS declarations (e.g. <code className="font-mono">border: 2px solid #A3E635; box-shadow: 0 20px 40px rgba(0,0,0,0.25);</code>). External URLs, <code className="font-mono">@import</code>, and script expressions are automatically stripped.
          </p>
          <textarea
            rows={5}
            value={customCssDraft}
            onChange={(e) => setCustomCssDraft(e.target.value)}
            placeholder="border: 2px solid rgba(255,255,255,0.25); letter-spacing: 0.5px;"
            className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
          />
          {cssAudit.rejectedProperties.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Ignored unsupported/unsafe entries: {cssAudit.rejectedProperties.join(', ')}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setCustomCssDraft('');
                updateDraft({ customCss: '' });
                setCustomCssModalOpen(false);
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear CSS
            </button>
            <button
              type="button"
              onClick={() => {
                updateDraft({ customCss: cssAudit.sanitizedCssText });
                setCustomCssModalOpen(false);
                dispatch(pushToast({ variant: 'success', message: 'Sanitized custom CSS applied.' }));
              }}
              className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Apply Custom CSS
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation */}
      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetConfirmed}
        title={editingBannerId ? 'Revert Unsaved Changes?' : 'Reset Banner Creator?'}
        message={
          editingBannerId
            ? 'Discard unsaved edits and reload the last saved version of this banner?'
            : 'Restore all banner styling, text, and layout controls back to the default template?'
        }
        confirmLabel="Reset"
      />

      {/* Delete Banner Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete Banner?"
        message={`Permanently delete "${deleteTarget?.name || ''}"? It will immediately stop rendering on the storefront.`}
        confirmLabel="Delete Banner"
        danger
        loading={deleting}
      />
    </div>
  );
}
