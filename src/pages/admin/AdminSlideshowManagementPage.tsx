import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  GripVertical,
  Images,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Save,
  Settings,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  SLIDESHOW_PLACEMENT_META,
  SLIDESHOW_PLACEMENTS,
  type SlideAnimationSpeed,
  type SlideIndicatorStyle,
  type SlideTransitionEffect,
  type SlideshowConfig,
  type SlideshowPlacement,
  type SlideshowSlideConfig,
} from '../../../shared/slideshowHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { SlideCreatorModal } from '../../components/admin/slideshow/SlideCreatorModal.tsx';
import { PageSlideshow } from '../../components/marketing/PageSlideshow.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { Category, Product } from '../../types/domain.ts';

interface AdminSlideshowManagementPageProps {
  initialPlacement?: SlideshowPlacement | 'all';
}

export function AdminSlideshowManagementPage({
  initialPlacement = 'all',
}: AdminSlideshowManagementPageProps) {
  const dispatch = useAppDispatch();

  const [placementTab, setPlacementTab] = useState<SlideshowPlacement | 'all'>(initialPlacement);
  const [slideshows, setSlideshows] = useState<SlideshowConfig[]>([]);
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideshowSlideConfig | null>(null);
  const [deleteSlideTarget, setDeleteSlideTarget] = useState<{
    slideshowId: string;
    slide: SlideshowSlideConfig;
  } | null>(null);
  const [deletingSlide, setDeletingSlide] = useState(false);
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);

  useEffect(() => {
    setPlacementTab(initialPlacement);
  }, [initialPlacement]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [shRes, catRes, prodRes] = await Promise.all([
        apiRequest<{ slideshows: SlideshowConfig[] }>('/api/admin/slideshows'),
        apiRequest<{ categories: Category[] }>('/api/catalog/categories?all=true').catch(() => ({
          categories: [],
        })),
        apiRequest<{ products: Product[] }>('/api/catalog/products?limit=25').catch(() => ({
          products: [],
        })),
      ]);
      const list = shRes.slideshows || [];
      setSlideshows(list);
      setCategories(catRes.categories || []);
      setProducts(prodRes.products || []);
      setSelectedSlideshowId((prev) => {
        if (prev && list.some((s) => s._id === prev)) return prev;
        return list[0]?._id || '';
      });
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to load slideshows.',
        })
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredSlideshows = useMemo(() => {
    if (placementTab === 'all') return slideshows;
    return slideshows.filter((s) => s.placement === placementTab);
  }, [slideshows, placementTab]);

  useEffect(() => {
    if (filteredSlideshows.length === 0) return;
    if (!filteredSlideshows.some((s) => s._id === selectedSlideshowId)) {
      setSelectedSlideshowId(filteredSlideshows[0]._id || '');
    }
  }, [filteredSlideshows, selectedSlideshowId]);

  const activeSlideshow = useMemo(
    () =>
      filteredSlideshows.find((s) => s._id === selectedSlideshowId) ||
      filteredSlideshows[0] ||
      null,
    [filteredSlideshows, selectedSlideshowId]
  );

  const [settingsDraft, setSettingsDraft] = useState<SlideshowConfig | null>(null);

  useEffect(() => {
    if (activeSlideshow) {
      setSettingsDraft({ ...activeSlideshow });
    } else {
      setSettingsDraft(null);
    }
  }, [activeSlideshow]);

  const updateLocalSlideshow = (updated: SlideshowConfig) => {
    setSlideshows((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft?._id) return;
    setSavingSettings(true);
    try {
      const res = await apiRequest<{ slideshow: SlideshowConfig }>(
        `/api/admin/slideshows/${settingsDraft._id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: settingsDraft.name,
            isActive: settingsDraft.isActive,
            autoplay: settingsDraft.autoplay,
            infiniteLoop: settingsDraft.infiniteLoop,
            pauseOnHover: settingsDraft.pauseOnHover,
            animationSpeed: settingsDraft.animationSpeed,
            transitionEffect: settingsDraft.transitionEffect,
            transitionDurationMs: settingsDraft.transitionDurationMs,
            autoplayIntervalMs: settingsDraft.autoplayIntervalMs,
            indicatorStyle: settingsDraft.indicatorStyle,
            showIndicators: settingsDraft.showIndicators,
            showArrows: settingsDraft.showArrows,
            desktopHeightPx: settingsDraft.desktopHeightPx,
            tabletHeightPx: settingsDraft.tabletHeightPx,
            mobileHeightPx: settingsDraft.mobileHeightPx,
            borderRadiusPx: settingsDraft.borderRadiusPx,
            compactMode: settingsDraft.compactMode,
          }),
        }
      );
      if (res.slideshow) updateLocalSlideshow(res.slideshow);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'success', message: 'Slideshow configuration saved & live.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to update slideshow settings.',
        })
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSlide = async (slidePayload: SlideshowSlideConfig, slideId?: string) => {
    if (!activeSlideshow?._id) return;
    const url = slideId
      ? `/api/admin/slideshows/${activeSlideshow._id}/slides/${slideId}`
      : `/api/admin/slideshows/${activeSlideshow._id}/slides`;

    const res = await apiRequest<{ slideshow: SlideshowConfig }>(url, {
      method: slideId ? 'PATCH' : 'POST',
      body: JSON.stringify(slidePayload),
    });
    if (res.slideshow) updateLocalSlideshow(res.slideshow);
    window.dispatchEvent(new CustomEvent('novara:cms-updated'));
    dispatch(
      pushToast({
        variant: 'success',
        message: slideId ? 'Slide updated successfully.' : 'New slide added to slideshow.',
      })
    );
  };

  const handleToggleSlideActive = async (slide: SlideshowSlideConfig) => {
    if (!activeSlideshow?._id || !slide._id) return;
    try {
      const res = await apiRequest<{ slideshow: SlideshowConfig }>(
        `/api/admin/slideshows/${activeSlideshow._id}/slides/${slide._id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !slide.isActive }),
        }
      );
      if (res.slideshow) updateLocalSlideshow(res.slideshow);
      dispatch(
        pushToast({
          variant: 'success',
          message: `Slide "${slide.mainHeading}" ${!slide.isActive ? 'activated' : 'paused'}.`,
        })
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to toggle slide state.',
        })
      );
    }
  };

  const handleDuplicateSlide = async (slide: SlideshowSlideConfig) => {
    if (!activeSlideshow?._id || !slide._id) return;
    try {
      const res = await apiRequest<{ slideshow: SlideshowConfig }>(
        `/api/admin/slideshows/${activeSlideshow._id}/slides/${slide._id}/duplicate`,
        { method: 'POST' }
      );
      if (res.slideshow) updateLocalSlideshow(res.slideshow);
      dispatch(pushToast({ variant: 'success', message: 'Slide duplicated.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to duplicate slide.',
        })
      );
    }
  };

  const persistSlideOrder = async (nextSlides: SlideshowSlideConfig[]) => {
    if (!activeSlideshow?._id) return;
    const orderedSlideIds = nextSlides.map((s) => String(s._id || '')).filter(Boolean);
    if (orderedSlideIds.length === 0) return;

    const optimistic: SlideshowConfig = {
      ...activeSlideshow,
      slides: nextSlides.map((s, idx) => ({ ...s, displayOrder: idx })),
    };
    updateLocalSlideshow(optimistic);

    try {
      const res = await apiRequest<{ slideshow: SlideshowConfig }>(
        `/api/admin/slideshows/${activeSlideshow._id}/reorder`,
        {
          method: 'PATCH',
          body: JSON.stringify({ orderedSlideIds }),
        }
      );
      if (res.slideshow) updateLocalSlideshow(res.slideshow);
      dispatch(pushToast({ variant: 'success', message: 'Slide order updated.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to persist slide order.',
        })
      );
      await loadAll();
    }
  };

  const handleMoveSlide = (index: number, dir: -1 | 1) => {
    if (!activeSlideshow) return;
    const sorted = [...(activeSlideshow.slides || [])].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const [moved] = sorted.splice(index, 1);
    sorted.splice(target, 0, moved);
    void persistSlideOrder(sorted);
  };

  const handleDropSlide = (targetSlideId: string) => {
    if (!activeSlideshow || !draggedSlideId || draggedSlideId === targetSlideId) {
      setDraggedSlideId(null);
      return;
    }
    const sorted = [...(activeSlideshow.slides || [])].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
    const fromIdx = sorted.findIndex((s) => String(s._id) === draggedSlideId);
    const toIdx = sorted.findIndex((s) => String(s._id) === targetSlideId);
    setDraggedSlideId(null);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    void persistSlideOrder(sorted);
  };

  const handleConfirmDeleteSlide = async () => {
    if (!deleteSlideTarget?.slide._id) return;
    setDeletingSlide(true);
    try {
      const res = await apiRequest<{ slideshow: SlideshowConfig }>(
        `/api/admin/slideshows/${deleteSlideTarget.slideshowId}/slides/${deleteSlideTarget.slide._id}`,
        { method: 'DELETE' }
      );
      if (res.slideshow) updateLocalSlideshow(res.slideshow);
      setDeleteSlideTarget(null);
      dispatch(pushToast({ variant: 'info', message: 'Slide removed.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to delete slide.',
        })
      );
    } finally {
      setDeletingSlide(false);
    }
  };

  const sortedSlides = useMemo(
    () =>
      [...(activeSlideshow?.slides || [])].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      ),
    [activeSlideshow?.slides]
  );

  const activeMeta = activeSlideshow
    ? SLIDESHOW_PLACEMENT_META[activeSlideshow.placement]
    : null;

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <header className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] text-white flex items-center justify-center shadow-sm shrink-0">
            <Images className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Multi-Page Slideshow Manager
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Independently configure full-background slideshows for Homepage, Cart, Wishlist, and Checkout.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeMeta && (
            <Link
              to={activeMeta.targetPage}
              target="_blank"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <span>View {activeMeta.shortLabel}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          {activeSlideshow && (
            <button
              type="button"
              onClick={() => {
                setEditingSlide(null);
                setSlideModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Slide</span>
            </button>
          )}
        </div>
      </header>

      {/* Placement Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl p-2 shadow-2xs">
        <button
          type="button"
          onClick={() => setPlacementTab('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
            placementTab === 'all'
              ? 'bg-[#16A34A] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Placements ({slideshows.length})
        </button>
        {SLIDESHOW_PLACEMENTS.map((p) => {
          const meta = SLIDESHOW_PLACEMENT_META[p];
          const count =
            slideshows.find((sh) => sh.placement === p)?.slides?.length ?? 0;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlacementTab(p)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                placementTab === p
                  ? 'bg-[#16A34A] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {meta.shortLabel} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        </div>
      ) : !activeSlideshow || !settingsDraft ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm font-bold text-slate-900">No slideshow found for this placement</p>
          <p className="text-xs text-slate-500">Refresh or check database connectivity.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Placement Selector Strip when viewing "All Placements" */}
          {filteredSlideshows.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredSlideshows.map((sh) => {
                const selected = sh._id === activeSlideshow._id;
                const meta = SLIDESHOW_PLACEMENT_META[sh.placement];
                return (
                  <button
                    key={sh._id}
                    type="button"
                    onClick={() => setSelectedSlideshowId(sh._id || '')}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      selected
                        ? 'border-[#16A34A] bg-emerald-50/60 shadow-xs ring-2 ring-[#16A34A]/20'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900">{meta.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sh.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sh.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Target: <span className="font-mono text-slate-700">{sh.targetPage}</span> ·{' '}
                      {sh.slides?.length || 0} slide{(sh.slides?.length || 0) === 1 ? '' : 's'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Live Slideshow Preview */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Live Interactive Preview — {activeMeta?.label}
                </h2>
                <p className="text-xs text-slate-500">
                  Test centered Prev/Next arrows, indicator style, and responsive heights across viewports.
                </p>
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
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

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <div
                className={
                  previewViewport === 'mobile'
                    ? 'max-w-[390px] mx-auto'
                    : previewViewport === 'tablet'
                    ? 'max-w-[768px] mx-auto'
                    : 'w-full'
                }
              >
                {sortedSlides.length > 0 ? (
                  <PageSlideshow
                    placement={settingsDraft.placement}
                    slideshow={settingsDraft}
                    previewViewport={previewViewport}
                    disableNavigation
                  />
                ) : (
                  <div className="h-44 flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                    Add your first slide below to preview this slideshow.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Placement Configuration & Slide List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 4 cols: Placement Playback & Responsive Settings */}
            <section className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </span>
                  <h2 className="text-sm font-extrabold text-slate-900">Placement Settings</h2>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settingsDraft.isActive}
                  aria-label="Enable placement slideshow"
                  onClick={() =>
                    setSettingsDraft((prev) =>
                      prev ? { ...prev, isActive: !prev.isActive } : prev
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800"
                >
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                      settingsDraft.isActive ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                  </span>
                  <span>Active</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slideshow Title
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={settingsDraft.name}
                    onChange={(e) =>
                      setSettingsDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Transition
                    </label>
                    <select
                      value={settingsDraft.transitionEffect}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, transitionEffect: e.target.value as SlideTransitionEffect }
                            : prev
                        )
                      }
                      className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="zoom">Zoom</option>
                      <option value="zoom_in">Zoom In</option>
                      <option value="zoom_out">Zoom Out</option>
                      <option value="ken_burns">Ken Burns</option>
                      <option value="none">None</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Animation Speed
                    </label>
                    <select
                      value={settingsDraft.animationSpeed}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, animationSpeed: e.target.value as SlideAnimationSpeed }
                            : prev
                        )
                      }
                      className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="fast">Fast (350ms)</option>
                      <option value="normal">Normal (600ms)</option>
                      <option value="slow">Slow (950ms)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Indicator Style
                    </label>
                    <select
                      value={settingsDraft.indicatorStyle}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, indicatorStyle: e.target.value as SlideIndicatorStyle }
                            : prev
                        )
                      }
                      className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="dots">Dots</option>
                      <option value="progress">Progress Bars</option>
                      <option value="numbers">Numbers</option>
                      <option value="thumbnails">Thumbnails</option>
                      <option value="none">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Autoplay Interval (ms)
                    </label>
                    <input
                      type="number"
                      min={1500}
                      max={15000}
                      step={500}
                      value={settingsDraft.autoplayIntervalMs}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                autoplayIntervalMs: Math.max(1500, Number(e.target.value) || 5000),
                              }
                            : prev
                        )
                      }
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Desktop H
                    </label>
                    <input
                      type="number"
                      min={120}
                      max={900}
                      value={settingsDraft.desktopHeightPx}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, desktopHeightPx: Math.max(120, Number(e.target.value) || 400) }
                            : prev
                        )
                      }
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tablet H
                    </label>
                    <input
                      type="number"
                      min={120}
                      max={800}
                      value={settingsDraft.tabletHeightPx}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, tabletHeightPx: Math.max(120, Number(e.target.value) || 320) }
                            : prev
                        )
                      }
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Mobile H
                    </label>
                    <input
                      type="number"
                      min={110}
                      max={700}
                      value={settingsDraft.mobileHeightPx}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, mobileHeightPx: Math.max(110, Number(e.target.value) || 240) }
                            : prev
                        )
                      }
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {(
                    [
                      ['autoplay', 'Autoplay Carousel'],
                      ['infiniteLoop', 'Infinite Loop'],
                      ['pauseOnHover', 'Pause on Hover'],
                      ['showArrows', 'Show Centered Prev / Next Arrows'],
                      ['showIndicators', 'Show Navigation Indicators'],
                      ['compactMode', 'Compact Layout (ideal for Cart / Checkout)'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                      <span className="font-medium">{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(settingsDraft[key])}
                        onChange={(e) =>
                          setSettingsDraft((prev) =>
                            prev ? { ...prev, [key]: e.target.checked } : prev
                          )
                        }
                        className="rounded accent-[#16A34A]"
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => void handleSaveSettings()}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-60"
                >
                  {savingSettings ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{savingSettings ? 'Saving Settings...' : 'Save Placement Settings'}</span>
                </button>
              </div>
            </section>

            {/* Right 8 cols: Slide Management List & Drag/Arrow Ordering */}
            <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Slides ({sortedSlides.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Drag rows or use Up/Down controls to reorder slides. Only slides here appear on{' '}
                    <span className="font-mono text-slate-700">{activeSlideshow.targetPage}</span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSlide(null);
                    setSlideModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Slide</span>
                </button>
              </div>

              {sortedSlides.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center space-y-2">
                  <p className="text-sm font-bold text-slate-800">No slides configured yet</p>
                  <p className="text-xs text-slate-500">
                    Click &quot;New Slide&quot; to add a full-bleed background slide for{' '}
                    {activeMeta?.label}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedSlides.map((slide, idx) => (
                    <div
                      key={slide._id || idx}
                      draggable={Boolean(slide._id)}
                      onDragStart={() => setDraggedSlideId(slide._id || null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => slide._id && handleDropSlide(slide._id)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                        draggedSlideId === slide._id
                          ? 'border-[#16A34A] bg-emerald-50/50 opacity-75'
                          : 'border-slate-200 hover:border-emerald-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          title="Drag to reorder"
                          className="text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <div className="w-24 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                          <SafeImage
                            src={slide.desktopImageUrl}
                            alt={slide.altText || slide.mainHeading}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-extrabold text-slate-900 truncate max-w-[240px]">
                              {slide.internalName || slide.mainHeading}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                slide.status === 'published' && slide.isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : slide.status === 'scheduled'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {slide.isActive ? slide.status : 'inactive'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 truncate max-w-[320px]">
                            {slide.mainHeading}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[320px]">
                            Order #{idx + 1}
                            {slide.destinationUrl ? ` · Slide link: ${slide.destinationUrl}` : ''}
                            {slide.primaryButtonText ? ` · CTA: ${slide.primaryButtonText}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={slide.isActive}
                          aria-label={`Toggle active status for ${slide.mainHeading}`}
                          onClick={() => void handleToggleSlideActive(slide)}
                          className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                        >
                          <span
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                              slide.isActive ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs" />
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={idx <= 0}
                          onClick={() => handleMoveSlide(idx, -1)}
                          aria-label={`Move ${slide.mainHeading} up`}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx >= sortedSlides.length - 1}
                          onClick={() => handleMoveSlide(idx, 1)}
                          aria-label={`Move ${slide.mainHeading} down`}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSlide(slide);
                            setSlideModalOpen(true);
                          }}
                          aria-label={`Edit ${slide.mainHeading}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDuplicateSlide(slide)}
                          aria-label={`Duplicate ${slide.mainHeading}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteSlideTarget({
                              slideshowId: activeSlideshow._id!,
                              slide,
                            })
                          }
                          aria-label={`Delete ${slide.mainHeading}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {activeSlideshow && (
        <SlideCreatorModal
          open={slideModalOpen}
          onClose={() => setSlideModalOpen(false)}
          slideshow={activeSlideshow}
          initialSlide={editingSlide}
          categories={categories}
          products={products}
          onSave={handleSaveSlide}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteSlideTarget)}
        onClose={() => setDeleteSlideTarget(null)}
        onConfirm={() => void handleConfirmDeleteSlide()}
        title="Delete Slide?"
        message={`Permanently remove "${deleteSlideTarget?.slide.mainHeading || ''}" from this slideshow?`}
        confirmLabel="Delete Slide"
        danger
        loading={deletingSlide}
      />
    </div>
  );
}
