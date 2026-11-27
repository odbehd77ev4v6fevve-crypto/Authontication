import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Columns,
  Copyright,
  CreditCard,
  Eye,
  EyeOff,
  LayoutTemplate,
  ListTree,
  Loader2,
  Mail,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Share2,
  Sliders,
  Store,
} from 'lucide-react';
import {
  DEFAULT_FOOTER_CONFIG,
  cloneFooterConfig,
  type FooterConfigPayload,
  type FooterLayoutPreset,
  type StorePaymentMethodFlag,
} from '../../../shared/footerHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { FooterColumnsMenusTab } from '../../components/admin/footer/FooterColumnsMenusTab.tsx';
import { FooterLivePreviewPanel } from '../../components/admin/footer/FooterLivePreviewPanel.tsx';
import {
  FooterBottomBarTab,
  FooterPaymentsTab,
} from '../../components/admin/footer/FooterPaymentsBottomTab.tsx';
import {
  FooterNewsletterTab,
  FooterSocialTab,
} from '../../components/admin/footer/FooterSocialNewsletterTab.tsx';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { FooterAdminStatePayload } from '../../types/domain.ts';

type FooterTabKey =
  | 'general'
  | 'layout'
  | 'columns'
  | 'menus'
  | 'social'
  | 'brand'
  | 'newsletter'
  | 'payments'
  | 'bottom_bar'
  | 'advanced';

const FOOTER_TABS: Array<{ key: FooterTabKey; label: string; icon: typeof Palette }> = [
  { key: 'general', label: 'General Settings', icon: Palette },
  { key: 'layout', label: 'Footer Layout', icon: LayoutTemplate },
  { key: 'columns', label: 'Footer Columns', icon: Columns },
  { key: 'menus', label: 'Footer Menus', icon: ListTree },
  { key: 'social', label: 'Social Media', icon: Share2 },
  { key: 'brand', label: 'Brand Information', icon: Store },
  { key: 'newsletter', label: 'Newsletter', icon: Mail },
  { key: 'payments', label: 'Payment Methods', icon: CreditCard },
  { key: 'bottom_bar', label: 'Copyright & Bottom Bar', icon: Copyright },
  { key: 'advanced', label: 'Advanced Settings', icon: Sliders },
];

const LAYOUT_PRESET_CARDS: Array<{
  key: FooterLayoutPreset;
  title: string;
  desc: string;
}> = [
  {
    key: 'split_brand_newsletter',
    title: 'Split Brand + Newsletter',
    desc: 'Top newsletter banner, brand summary column alongside dynamic link columns, trust badges, and bottom bar.',
  },
  {
    key: 'multi_column_grid',
    title: 'Multi-Column Grid',
    desc: 'Clean balanced grid placing Brand + dynamic link columns side-by-side with optional newsletter.',
  },
  {
    key: 'centered_compact',
    title: 'Centered Compact',
    desc: 'Centered logo, tagline, social icons, and structured columns underneath.',
  },
  {
    key: 'minimal_bar',
    title: 'Minimal Bar',
    desc: 'Streamlined compact footer with essential links, social icons, payment pills, and copyright.',
  },
];

export function AdminFooterManagerPage({ initialTab = 'general' }: { initialTab?: FooterTabKey }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<FooterTabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [draft, setDraft] = useState<FooterConfigPayload>(cloneFooterConfig(DEFAULT_FOOTER_CONFIG));
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [version, setVersion] = useState(1);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [storePaymentMethods, setStorePaymentMethods] = useState<StorePaymentMethodFlag[]>([]);
  const [resources, setResources] = useState<FooterAdminStatePayload['resources']>({
    pages: [],
    categories: [],
    blogs: [],
  });

  const loadFooterAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<FooterAdminStatePayload>('/api/footer/admin');
      setDraft(data.draft);
      setStatus(data.status);
      setVersion(data.version);
      setPublishedAt(data.publishedAt);
      setStorePaymentMethods(data.storePaymentMethods || []);
      setResources(data.resources || { pages: [], categories: [], blogs: [] });
      setHasUnsavedChanges(false);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          title: 'Footer CMS Load Error',
          message: err instanceof Error ? err.message : 'Unable to load footer configuration.',
        })
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadFooterAdmin();
  }, [loadFooterAdmin]);

  const updateDraft = (updater: (prev: FooterConfigPayload) => FooterConfigPayload) => {
    setDraft((prev) => updater(prev));
    setHasUnsavedChanges(true);
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await apiRequest<FooterAdminStatePayload>('/api/footer/admin/draft', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      setDraft(res.draft);
      setStatus(res.status);
      setVersion(res.version);
      setPublishedAt(res.publishedAt);
      setHasUnsavedChanges(false);
      dispatch(
        pushToast({
          variant: 'success',
          title: 'Draft Saved',
          message: 'Footer draft updated. Publish when ready to push changes live.',
        })
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          title: 'Save Draft Failed',
          message: err instanceof Error ? err.message : 'Failed to save draft.',
        })
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await apiRequest<FooterAdminStatePayload>('/api/footer/admin/publish', {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      setDraft(res.draft);
      setStatus(res.status);
      setVersion(res.version);
      setPublishedAt(res.publishedAt);
      setHasUnsavedChanges(false);
      window.dispatchEvent(new Event('novara:cms-updated'));
      dispatch(
        pushToast({
          variant: 'success',
          title: 'Footer Published',
          message: `Version ${res.version} is now live on the storefront.`,
        })
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          title: 'Publish Failed',
          message: err instanceof Error ? err.message : 'Failed to publish footer.',
        })
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      const res = await apiRequest<FooterAdminStatePayload>('/api/footer/admin/reset', {
        method: 'POST',
        body: JSON.stringify({ publish: false }),
      });
      setDraft(res.draft);
      setHasUnsavedChanges(false);
      setResetConfirmOpen(false);
      dispatch(
        pushToast({
          variant: 'info',
          title: 'Draft Reset',
          message: 'Footer draft restored to defaults. Click Publish to apply live.',
        })
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          title: 'Reset Failed',
          message: err instanceof Error ? err.message : 'Failed to reset defaults.',
        })
      );
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-900">
              Dynamic Footer Management
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                status === 'published'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {status === 'published' ? `Live v${version}` : 'Draft Mode'}
            </span>
            {hasUnsavedChanges && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                Unsaved Draft Changes
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure layout, unlimited columns, links, social profiles, brand details, newsletter, payment badges, and copyright bar.
            {publishedAt && ` Last published: ${new Date(publishedAt).toLocaleString()}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
          </button>
          <button
            type="button"
            onClick={() => void loadFooterAdmin()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            disabled={savingDraft}
            onClick={() => void handleSaveDraft()}
            data-testid="footer-save-draft-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-bold disabled:opacity-60"
          >
            {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            disabled={publishing}
            onClick={() => void handlePublish()}
            data-testid="footer-publish-btn"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-60"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Publish Changes</span>
          </button>
        </div>
      </div>

      {/* Live Preview */}
      {showPreview && (
        <FooterLivePreviewPanel
          config={draft}
          storePaymentMethods={storePaymentMethods}
        />
      )}

      {/* 10-Tab Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs flex items-center gap-1 overflow-x-auto">
        {FOOTER_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              data-testid={`footer-tab-${t.key}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#16A34A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: General Settings */}
      {tab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  General Appearance &amp; Colors
                </h2>
                <p className="text-xs text-slate-500">
                  Customize storefront footer status, surface colors, gradient, typography, spacing, borders, and shadow.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-900 px-3 py-1.5 rounded-xl bg-slate-100">
                <input
                  type="checkbox"
                  checked={draft.general.enabled}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, enabled: e.target.checked },
                    }))
                  }
                />
                <span>Enable Storefront Footer</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs font-semibold text-slate-700">
              {(
                [
                  ['backgroundColor', 'Background'],
                  ['textColor', 'Body Text'],
                  ['headingColor', 'Headings'],
                  ['linkColor', 'Links'],
                  ['linkHoverColor', 'Link Hover'],
                  ['accentColor', 'Accent'],
                  ['borderColor', 'Borders'],
                ] as const
              ).map(([field, lbl]) => (
                <label key={field} className="flex flex-col gap-1.5">
                  <span>{lbl}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.general[field]}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          general: { ...d.general, [field]: e.target.value },
                        }))
                      }
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-slate-500">
                      {draft.general[field]}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            {/* Gradient Controls */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={draft.general.backgroundGradientEnabled}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, backgroundGradientEnabled: e.target.checked },
                    }))
                  }
                />
                <span>Use Background Gradient</span>
              </label>
              {draft.general.backgroundGradientEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-slate-700">
                    <input
                      type="color"
                      value={draft.general.backgroundGradientStart}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          general: { ...d.general, backgroundGradientStart: e.target.value },
                        }))
                      }
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                    <span>Start Color</span>
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-slate-700">
                    <input
                      type="color"
                      value={draft.general.backgroundGradientEnd}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          general: { ...d.general, backgroundGradientEnd: e.target.value },
                        }))
                      }
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                    <span>End Color</span>
                  </label>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Gradient Direction
                    </label>
                    <input
                      type="text"
                      value={draft.general.backgroundGradientDirection}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          general: {
                            ...d.general,
                            backgroundGradientDirection: e.target.value,
                          },
                        }))
                      }
                      placeholder="135deg"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Typography, Dimensions & Spacing */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Font Family</label>
                <select
                  value={draft.general.fontFamily}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: {
                        ...d.general,
                        fontFamily: e.target.value as FooterConfigPayload['general']['fontFamily'],
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="Manrope">Manrope</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Outfit">Outfit</option>
                  <option value="Inter">Inter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Heading Weight</label>
                <select
                  value={draft.general.headingFontWeight}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: {
                        ...d.general,
                        headingFontWeight: e.target.value as FooterConfigPayload['general']['headingFontWeight'],
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="500">Medium (500)</option>
                  <option value="600">Semibold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extrabold (800)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Heading Size ({draft.general.headingSizePx}px)
                </label>
                <input
                  type="number"
                  min={12}
                  max={24}
                  value={draft.general.headingSizePx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, headingSizePx: Number(e.target.value) || 14 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Body Size ({draft.general.bodySizePx}px)
                </label>
                <input
                  type="number"
                  min={11}
                  max={18}
                  value={draft.general.bodySizePx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, bodySizePx: Number(e.target.value) || 13 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Width</label>
                <select
                  value={draft.general.maxWidth}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: {
                        ...d.general,
                        maxWidth: e.target.value as FooterConfigPayload['general']['maxWidth'],
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="container">Container (1280px)</option>
                  <option value="1280px">1280px</option>
                  <option value="1440px">Wide (1440px)</option>
                  <option value="full">Full Width</option>
                  <option value="custom">Custom px</option>
                </select>
              </div>
              {draft.general.maxWidth === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custom Max px</label>
                  <input
                    type="number"
                    min={960}
                    max={1920}
                    value={draft.general.customMaxWidthPx}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        general: { ...d.general, customMaxWidthPx: Number(e.target.value) || 1280 },
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Top Padding (px)</label>
                <input
                  type="number"
                  min={12}
                  max={120}
                  value={draft.general.paddingTopPx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, paddingTopPx: Number(e.target.value) || 48 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bottom Padding (px)</label>
                <input
                  type="number"
                  min={12}
                  max={120}
                  value={draft.general.paddingBottomPx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, paddingBottomPx: Number(e.target.value) || 40 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Column Gap (px)</label>
                <input
                  type="number"
                  min={12}
                  max={64}
                  value={draft.general.columnGapPx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, columnGapPx: Number(e.target.value) || 32 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Section Gap (px)</label>
                <input
                  type="number"
                  min={12}
                  max={64}
                  value={draft.general.sectionGapPx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, sectionGapPx: Number(e.target.value) || 28 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Top Border (px)</label>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={draft.general.borderTopWidthPx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, borderTopWidthPx: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Border Radius (px)</label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={draft.general.borderRadiusPx}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, borderRadiusPx: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shadow</label>
                <select
                  value={draft.general.shadow}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: {
                        ...d.general,
                        shadow: e.target.value as FooterConfigPayload['general']['shadow'],
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="none">None</option>
                  <option value="sm">Subtle</option>
                  <option value="md">Medium</option>
                  <option value="lg">Elevated</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Footer Layout */}
      {tab === 'layout' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Footer Layout Template</h2>
              <p className="text-xs text-slate-500">
                Choose how brand info, dynamic link columns, and newsletter arrange across breakpoints.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LAYOUT_PRESET_CARDS.map((card) => {
                const selected = draft.general.layoutPreset === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() =>
                      updateDraft((d) => ({
                        ...d,
                        general: { ...d.general, layoutPreset: card.key },
                      }))
                    }
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-[#16A34A] bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900">{card.title}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{card.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Responsive Breakpoint &amp; Column Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Desktop Columns
                </label>
                <select
                  value={draft.general.desktopColumns}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, desktopColumns: Number(e.target.value) },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} Columns
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tablet Columns
                </label>
                <select
                  value={draft.general.tabletColumns}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: {
                        ...d.general,
                        tabletColumns: Number(e.target.value) as 1 | 2 | 3,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value={1}>1 Column</option>
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Columns
                </label>
                <select
                  value={draft.general.mobileColumns}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, mobileColumns: Number(e.target.value) as 1 | 2 },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value={1}>1 Column</option>
                  <option value={2}>2 Columns</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Behavior
                </label>
                <select
                  value={draft.general.mobileLayoutMode}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: {
                        ...d.general,
                        mobileLayoutMode: e.target.value as 'accordion' | 'stacked',
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="accordion">Collapsible Accordion</option>
                  <option value="stacked">Stacked Expanded</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-2 text-xs font-semibold text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.general.desktopEnabled}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, desktopEnabled: e.target.checked },
                    }))
                  }
                />
                <span>Show on Desktop</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.general.tabletEnabled}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, tabletEnabled: e.target.checked },
                    }))
                  }
                />
                <span>Show on Tablet</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.general.mobileEnabled}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      general: { ...d.general, mobileEnabled: e.target.checked },
                    }))
                  }
                />
                <span>Show on Mobile</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3 & 4: Footer Columns & Footer Menus */}
      {(tab === 'columns' || tab === 'menus') && (
        <FooterColumnsMenusTab
          mode={tab}
          columns={draft.columns}
          resources={resources}
          onChangeColumns={(nextCols) =>
            updateDraft((d) => ({ ...d, columns: nextCols }))
          }
        />
      )}

      {/* TAB 5: Social Media */}
      {tab === 'social' && (
        <FooterSocialTab
          social={draft.social}
          onChange={(nextSocial) => updateDraft((d) => ({ ...d, social: nextSocial }))}
        />
      )}

      {/* TAB 6: Brand Information */}
      {tab === 'brand' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Brand &amp; Contact Information</h2>
              <p className="text-xs text-slate-500">
                Upload primary/alternative footer logos and edit company contact details.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={draft.brand.enabled}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, enabled: e.target.checked },
                  }))
                }
              />
              <span>Enable Brand Section</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs font-extrabold text-slate-800">Primary Footer Logo</p>
              {draft.brand.logoUrl && (
                <SafeImage
                  src={draft.brand.logoUrl}
                  alt="Primary Footer Logo"
                  className="h-10 w-auto object-contain bg-slate-900 rounded p-1.5"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <CloudinaryUploadField
                  folder="footer"
                  label="Upload Primary Logo"
                  onUploaded={(asset) =>
                    updateDraft((d) => ({
                      ...d,
                      brand: { ...d.brand, logoUrl: asset.url, logoPublicId: asset.publicId },
                    }))
                  }
                />
                {draft.brand.logoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((d) => ({
                        ...d,
                        brand: { ...d.brand, logoUrl: '', logoPublicId: '' },
                      }))
                    }
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="text"
                value={draft.brand.logoUrl}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, logoUrl: e.target.value },
                  }))
                }
                placeholder="https://... or /assets/..."
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs font-extrabold text-slate-800">Alternative / Fallback Logo</p>
              {draft.brand.altLogoUrl && (
                <SafeImage
                  src={draft.brand.altLogoUrl}
                  alt="Alternative Logo"
                  className="h-10 w-auto object-contain bg-slate-900 rounded p-1.5"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <CloudinaryUploadField
                  folder="footer"
                  label="Upload Alt Logo"
                  onUploaded={(asset) =>
                    updateDraft((d) => ({
                      ...d,
                      brand: { ...d.brand, altLogoUrl: asset.url, altLogoPublicId: asset.publicId },
                    }))
                  }
                />
                {draft.brand.altLogoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((d) => ({
                        ...d,
                        brand: { ...d.brand, altLogoUrl: '', altLogoPublicId: '' },
                      }))
                    }
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="text"
                value={draft.brand.altLogoUrl}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, altLogoUrl: e.target.value },
                  }))
                }
                placeholder="https://..."
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store / Brand Name</label>
              <input
                type="text"
                value={draft.brand.storeName}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, storeName: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tagline</label>
              <input
                type="text"
                value={draft.brand.tagline}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, tagline: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Logo Height ({draft.brand.logoHeightPx}px)
              </label>
              <input
                type="number"
                min={20}
                max={96}
                value={draft.brand.logoHeightPx}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, logoHeightPx: Number(e.target.value) || 36 },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand Description</label>
              <textarea
                rows={2}
                value={draft.brand.description}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, description: e.target.value },
                  }))
                }
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Support Email</label>
              <input
                type="email"
                value={draft.brand.contactEmail}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, contactEmail: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={draft.brand.contactPhone}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, contactPhone: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Business Hours</label>
              <input
                type="text"
                value={draft.brand.businessHours}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, businessHours: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Business Address</label>
              <input
                type="text"
                value={draft.brand.businessAddress}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, businessAddress: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registration / Trade Info
              </label>
              <input
                type="text"
                value={draft.brand.registrationInfo}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    brand: { ...d.brand, registrationInfo: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.brand.showLogo}
                onChange={(e) =>
                  updateDraft((d) => ({ ...d, brand: { ...d.brand, showLogo: e.target.checked } }))
                }
              />
              <span>Show Logo</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.brand.showTagline}
                onChange={(e) =>
                  updateDraft((d) => ({ ...d, brand: { ...d.brand, showTagline: e.target.checked } }))
                }
              />
              <span>Show Tagline</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.brand.showDescription}
                onChange={(e) =>
                  updateDraft((d) => ({ ...d, brand: { ...d.brand, showDescription: e.target.checked } }))
                }
              />
              <span>Show Description</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.brand.showContactInfo}
                onChange={(e) =>
                  updateDraft((d) => ({ ...d, brand: { ...d.brand, showContactInfo: e.target.checked } }))
                }
              />
              <span>Show Contact Details</span>
            </label>
          </div>
        </div>
      )}

      {/* TAB 7: Newsletter */}
      {tab === 'newsletter' && (
        <FooterNewsletterTab
          newsletter={draft.newsletter}
          onChange={(nextNl) => updateDraft((d) => ({ ...d, newsletter: nextNl }))}
        />
      )}

      {/* TAB 8: Payment Methods */}
      {tab === 'payments' && (
        <FooterPaymentsTab
          payments={draft.payments}
          trustBadges={draft.trustBadges}
          storePaymentMethods={storePaymentMethods}
          onChangePayments={(nextPay) => updateDraft((d) => ({ ...d, payments: nextPay }))}
          onChangeTrustBadges={(nextTrust) => updateDraft((d) => ({ ...d, trustBadges: nextTrust }))}
        />
      )}

      {/* TAB 9: Copyright & Bottom Bar */}
      {tab === 'bottom_bar' && (
        <FooterBottomBarTab
          bottomBar={draft.bottomBar}
          onChange={(nextBar) => updateDraft((d) => ({ ...d, bottomBar: nextBar }))}
        />
      )}

      {/* TAB 10: Advanced Settings */}
      {tab === 'advanced' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Advanced Footer Controls</h2>
            <p className="text-xs text-slate-500">
              Scoped CSS overrides (sanitized automatically), interaction toggles, and editorial notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-semibold text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.advanced.showDividerAboveBottomBar}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    advanced: { ...d.advanced, showDividerAboveBottomBar: e.target.checked },
                  }))
                }
              />
              <span>Show Divider Above Bottom Bar</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.advanced.enableHoverAnimations}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    advanced: { ...d.advanced, enableHoverAnimations: e.target.checked },
                  }))
                }
              />
              <span>Enable Link &amp; Social Hover Motion</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.advanced.backToTopEnabled}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    advanced: { ...d.advanced, backToTopEnabled: e.target.checked },
                  }))
                }
              />
              <span>Show Back-to-Top Button</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Scoped Custom CSS (applied to footer container)
            </label>
            <textarea
              rows={4}
              value={draft.advanced.customCss}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  advanced: { ...d.advanced, customCss: e.target.value },
                }))
              }
              placeholder="letter-spacing: 0.01em;"
              className="w-full p-3 rounded-lg border border-slate-200 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Internal Admin Notes
            </label>
            <textarea
              rows={2}
              value={draft.advanced.notes}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  advanced: { ...d.advanced, notes: e.target.value },
                }))
              }
              placeholder="Seasonal campaign notes or revision reminders..."
              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={() => void handleResetDefaults()}
        loading={resetting}
        title="Reset Footer Draft to Defaults"
        message="This will overwrite your current footer draft (columns, links, colors, newsletter, and bottom bar) with the default configuration. Live storefront remains unchanged until you publish."
        confirmLabel="Reset Draft"
        danger
      />
    </div>
  );
}
