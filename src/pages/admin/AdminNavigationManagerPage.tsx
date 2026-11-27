import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckSquare,
  Copy,
  Eye,
  Globe,
  GripVertical,
  ImagePlus,
  Layers,
  LayoutGrid,
  ListChecks,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  DEFAULT_PLACEMENT_DEFINITIONS,
  DEFAULT_RESPONSIVE_CONFIG,
  DEFAULT_SLIDER_SETTINGS,
  getMegaMenuTemplatePreset,
  MENU_PLACEMENTS,
  MENU_STATUSES,
  MENU_TYPES,
  MENU_TYPE_LABELS,
  type MegaMenuSlideRecord,
  type NavigationItemRecord,
  type NavigationMenuRecord,
  type NavigationMenuStatus,
  type NavigationMenuType,
  type NavigationPlacementKey,
} from '../../../shared/megaMenuHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { MegaMenuSlideModal } from '../../components/admin/navigation/MegaMenuSlideModal.tsx';
import { NavigationMenuBuilder } from '../../components/admin/navigation/NavigationMenuBuilder.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type {
  NavigationAdminStatsPayload,
  NavigationResourcesPayload,
} from '../../types/domain.ts';

type ManagerTab = 'dashboard' | 'menus' | 'builder' | 'slides' | 'placements';

interface PlacementWithMenus {
  key: NavigationPlacementKey;
  label: string;
  description: string;
  allowMultipleActive: boolean;
  defaultMenuType: NavigationMenuType;
  assignedMenus: Array<{
    _id: string;
    name: string;
    slug: string;
    menuType: string;
    status: string;
    updatedAt?: string;
  }>;
}

const EMPTY_RESOURCES: NavigationResourcesPayload = {
  categories: [],
  products: [],
  brands: [],
  collections: [],
  campaigns: [],
  pages: [],
  blogs: [],
};

export function AdminNavigationManagerPage({ initialTab = 'dashboard' }: { initialTab?: ManagerTab }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<ManagerTab>(initialTab);
  const [loading, setLoading] = useState(true);

  const [statsData, setStatsData] = useState<NavigationAdminStatsPayload | null>(null);
  const [menus, setMenus] = useState<Array<NavigationMenuRecord & { slideCount?: number }>>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [slides, setSlides] = useState<MegaMenuSlideRecord[]>([]);
  const [placements, setPlacements] = useState<PlacementWithMenus[]>([]);
  const [resources, setResources] = useState<NavigationResourcesPayload>(EMPTY_RESOURCES);

  // Filters & Sorting for All Menus
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlacement, setFilterPlacement] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name' | 'displayOrder'>('updatedAt');
  const [page, setPage] = useState(1);
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);

  // Active Builder State
  const [activeMenu, setActiveMenu] = useState<NavigationMenuRecord | null>(null);
  const [activeMenuFlatItems, setActiveMenuFlatItems] = useState<NavigationItemRecord[]>([]);

  // Modals & Confirmations
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    menuType: 'category_mega_menu' as NavigationMenuType,
    placement: 'all_categories' as NavigationPlacementKey,
    categoryMode: 'auto' as 'auto' | 'hybrid' | 'manual',
    status: 'draft' as NavigationMenuStatus,
    description: '',
    replaceExistingActive: true,
  });

  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<MegaMenuSlideRecord | null>(null);
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'menu' | 'slide' | 'bulk_menus';
    id: string;
    label: string;
  } | null>(null);

  const loadMenusList = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      sortBy,
    });
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (filterPlacement) params.set('placement', filterPlacement);
    if (filterType) params.set('menuType', filterType);
    if (filterStatus) params.set('status', filterStatus);

    const res = await apiRequest<{
      menus: Array<NavigationMenuRecord & { slideCount?: number }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/navigation/admin/menus?${params.toString()}`);

    setMenus(res.menus || []);
    if (res.pagination) setPagination(res.pagination);
  }, [page, sortBy, searchQuery, filterPlacement, filterType, filterStatus]);

  const loadOverviewAndCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, slidesRes, placementsRes, resourcesRes] = await Promise.all([
        apiRequest<NavigationAdminStatsPayload>('/api/navigation/admin/stats').catch(() => null),
        apiRequest<{ slides: MegaMenuSlideRecord[] }>('/api/navigation/admin/slides').catch(() => ({ slides: [] })),
        apiRequest<{ placements: PlacementWithMenus[] }>('/api/navigation/admin/placements').catch(() => ({
          placements: [],
        })),
        apiRequest<NavigationResourcesPayload>('/api/navigation/admin/resources').catch(() => EMPTY_RESOURCES),
      ]);
      if (statsRes) setStatsData(statsRes);
      setSlides(slidesRes.slides || []);
      setPlacements(placementsRes.placements || []);
      setResources(resourcesRes || EMPTY_RESOURCES);
      await loadMenusList().catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [loadMenusList]);

  useEffect(() => {
    void loadOverviewAndCatalog();
  }, [loadOverviewAndCatalog]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMenusList().catch(() => {});
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadMenusList]);

  const openMenuBuilder = async (menuId: string) => {
    try {
      const res = await apiRequest<{ menu: NavigationMenuRecord; flatItems: NavigationItemRecord[] }>(
        `/api/navigation/admin/menus/${menuId}`
      );
      setActiveMenu(res.menu);
      setActiveMenuFlatItems(res.flatItems || []);
      setTab('builder');
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to load menu details.',
        })
      );
    }
  };

  const handleCreateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const appearance = getMegaMenuTemplatePreset('modern_green');
      const res = await apiRequest<{ menu: NavigationMenuRecord }>('/api/navigation/admin/menus', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          megaMenuConfig: DEFAULT_MEGA_MENU_LAYOUT,
          appearanceConfig: appearance || DEFAULT_MEGA_MENU_APPEARANCE,
          responsiveConfig: DEFAULT_RESPONSIVE_CONFIG,
          sliderSettings: DEFAULT_SLIDER_SETTINGS,
        }),
      });
      setCreateOpen(false);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'success', message: 'Navigation menu created.' }));
      await loadOverviewAndCatalog();
      setActiveMenu(res.menu);
      setActiveMenuFlatItems([]);
      setTab('builder');
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to create menu.',
        })
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicateMenu = async (menuId: string) => {
    try {
      const res = await apiRequest<{ menu: NavigationMenuRecord }>(
        `/api/navigation/admin/menus/${menuId}/duplicate`,
        { method: 'POST' }
      );
      dispatch(pushToast({ variant: 'success', message: `Duplicated as "${res.menu.name}".` }));
      await loadOverviewAndCatalog();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Duplicate failed.',
        })
      );
    }
  };

  const handleTogglePublish = async (m: NavigationMenuRecord) => {
    const isPublished = m.status === 'published' || m.status === 'scheduled';
    try {
      await apiRequest(`/api/navigation/admin/menus/${m._id}/${isPublished ? 'unpublish' : 'publish'}`, {
        method: 'POST',
        body: JSON.stringify({ replaceExistingActive: true }),
      });
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(
        pushToast({
          variant: 'success',
          message: isPublished ? 'Menu moved to draft.' : 'Menu published to storefront.',
        })
      );
      await loadOverviewAndCatalog();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Status update failed.',
        })
      );
    }
  };

  const handleBulkMenuAction = async (action: 'publish' | 'unpublish' | 'delete') => {
    if (selectedMenuIds.length === 0) return;
    if (action === 'delete') {
      setDeleteTarget({
        kind: 'bulk_menus',
        id: 'bulk',
        label: `${selectedMenuIds.length} selected menus`,
      });
      return;
    }
    try {
      await Promise.all(
        selectedMenuIds.map((id) =>
          apiRequest(`/api/navigation/admin/menus/${id}/${action}`, {
            method: 'POST',
            body: JSON.stringify({ replaceExistingActive: true }),
          })
        )
      );
      setSelectedMenuIds([]);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(
        pushToast({
          variant: 'success',
          message: `Updated ${selectedMenuIds.length} menu(s).`,
        })
      );
      await loadOverviewAndCatalog();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Bulk action failed.',
        })
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'menu') {
        await apiRequest(`/api/navigation/admin/menus/${deleteTarget.id}`, { method: 'DELETE' });
        if (activeMenu?._id === deleteTarget.id) {
          setActiveMenu(null);
          setTab('menus');
        }
      } else if (deleteTarget.kind === 'bulk_menus') {
        await Promise.all(
          selectedMenuIds.map((id) =>
            apiRequest(`/api/navigation/admin/menus/${id}`, { method: 'DELETE' })
          )
        );
        setSelectedMenuIds([]);
      } else if (deleteTarget.kind === 'slide') {
        await apiRequest(`/api/navigation/admin/slides/${deleteTarget.id}`, { method: 'DELETE' });
      }
      setDeleteTarget(null);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'info', message: `${deleteTarget.label} deleted.` }));
      await loadOverviewAndCatalog();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Delete failed.',
        })
      );
    }
  };

  const persistSlidesOrder = async (nextSlides: MegaMenuSlideRecord[]) => {
    setSlides(nextSlides);
    try {
      const res = await apiRequest<{ slides: MegaMenuSlideRecord[] }>(
        '/api/navigation/admin/slides/reorder',
        {
          method: 'PUT',
          body: JSON.stringify({ orderedIds: nextSlides.map((s) => s._id) }),
        }
      );
      setSlides(res.slides);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'success', message: 'Slide display order saved.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to reorder slides.',
        })
      );
    }
  };

  const handleMoveSlide = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= slides.length) return;
    const copy = [...slides];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    void persistSlidesOrder(copy);
  };

  const handleToggleSlideActive = async (slide: MegaMenuSlideRecord) => {
    try {
      await apiRequest(`/api/navigation/admin/slides/${slide._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      await loadOverviewAndCatalog();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to update slide.',
        })
      );
    }
  };

  const handleDuplicateSlide = async (slide: MegaMenuSlideRecord) => {
    try {
      await apiRequest('/api/navigation/admin/slides', {
        method: 'POST',
        body: JSON.stringify({
          menuIds: slide.menuIds || [],
          internalName: `${slide.internalName} (Copy)`,
          badgeText: slide.badgeText,
          mainHeading: slide.mainHeading,
          highlightText: slide.highlightText,
          discountText: slide.discountText,
          description: slide.description,
          ctaLabel: slide.ctaLabel,
          ctaUrl: slide.ctaUrl,
          openInNewTab: slide.openInNewTab,
          desktopImageUrl: slide.desktopImageUrl,
          mobileImageUrl: slide.mobileImageUrl,
          altText: slide.altText,
          imagePosition: slide.imagePosition,
          textColor: slide.textColor,
          highlightColor: slide.highlightColor,
          buttonBgColor: slide.buttonBgColor,
          buttonTextColor: slide.buttonTextColor,
          badgeBgColor: slide.badgeBgColor,
          badgeTextColor: slide.badgeTextColor,
          textAlign: slide.textAlign,
          overlayColor: slide.overlayColor,
          overlayOpacity: slide.overlayOpacity,
          borderRadiusPx: slide.borderRadiusPx,
          priority: slide.priority,
          displayOrder: slides.length,
          isActive: false,
          status: 'draft',
        }),
      });
      dispatch(pushToast({ variant: 'success', message: 'Slide duplicated as draft.' }));
      await loadOverviewAndCatalog();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to duplicate slide.',
        })
      );
    }
  };

  const placementRows =
    placements.length > 0
      ? placements
      : DEFAULT_PLACEMENT_DEFINITIONS.map((def) => ({
          ...def,
          assignedMenus: menus.filter((m) => m.placement === def.key),
        }));

  return (
    <div className="space-y-6">
      {/* Page Title & Primary Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Navigation & Mega Menu Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Design multi-column storefront mega menus, nested dropdowns, category hierarchies, and promotional sliders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingSlide(null);
              setSlideModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            <ImagePlus className="w-4 h-4 text-[#16A34A]" />
            <span>New Promo Slide</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateForm({
                name: '',
                slug: '',
                menuType: 'category_mega_menu',
                placement: 'all_categories',
                categoryMode: 'auto',
                status: 'draft',
                description: '',
                replaceExistingActive: true,
              });
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Menu</span>
          </button>
        </div>
      </div>

      {/* Navigation Manager Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            ['dashboard', 'Dashboard', BarChart3],
            ['menus', `All Menus (${pagination.total || menus.length})`, ListChecks],
            ['builder', activeMenu ? `Builder: ${activeMenu.name}` : 'Visual Builder', Layers],
            ['slides', `Promo Slides (${slides.length})`, Sparkles],
            ['placements', 'Placements', MapPin],
          ] as const
        ).map(([key, label, Icon]) => {
          const disabled = key === 'builder' && !activeMenu;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === key
                  ? 'bg-[#16A34A] text-white shadow-xs'
                  : disabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[180px]">{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
            {[
              { label: 'Total Menus', value: statsData?.stats.totalMenus ?? menus.length },
              { label: 'Active Menus', value: statsData?.stats.activeMenus ?? 0 },
              { label: 'Draft Menus', value: statsData?.stats.draftMenus ?? 0 },
              { label: 'Total Menu Items', value: statsData?.stats.totalMenuItems ?? 0 },
              { label: 'Mega Menus', value: statsData?.stats.megaMenus ?? 0 },
              {
                label: 'Active Promo Slides',
                value: statsData?.stats.activePromotionalSlides ?? 0,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs"
              >
                <p className="text-[11px] font-semibold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                  {loading ? '—' : kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">Placements Coverage</h2>
                <button
                  type="button"
                  onClick={() => setTab('placements')}
                  className="text-xs font-bold text-[#16A34A] hover:underline"
                >
                  Manage Placements
                </button>
              </div>
              <div className="space-y-2.5">
                {(statsData?.menusByPlacement || []).map((row) => {
                  const def = DEFAULT_PLACEMENT_DEFINITIONS.find((d) => d.key === row.placement);
                  return (
                    <div
                      key={row.placement}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {def?.label || row.placement}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">{row.placement}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {row.active} active
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">
                          {row.total} total
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">Recently Updated Menus</h2>
                <button
                  type="button"
                  onClick={() => setTab('menus')}
                  className="text-xs font-bold text-[#16A34A] hover:underline"
                >
                  View All Menus
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {(statsData?.recentMenus || menus.slice(0, 5)).map((rm) => (
                  <div
                    key={rm._id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{rm.name}</p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            rm.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rm.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {rm.placement} · {MENU_TYPE_LABELS[rm.menuType as NavigationMenuType] || rm.menuType} ·{' '}
                        {rm.itemCount ?? 0} custom items
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openMenuBuilder(rm._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#15803D] hover:bg-emerald-100 text-xs font-bold"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Open Builder</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL MENUS TABLE */}
      {tab === 'menus' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setPage(1);
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search menus by name or slug..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <select
              value={filterPlacement}
              onChange={(e) => {
                setPage(1);
                setFilterPlacement(e.target.value);
              }}
              aria-label="Filter by placement"
              className="h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="">All Placements</option>
              {MENU_PLACEMENTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => {
                setPage(1);
                setFilterType(e.target.value);
              }}
              aria-label="Filter by menu type"
              className="h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="">All Types</option>
              {MENU_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MENU_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setPage(1);
                setFilterStatus(e.target.value);
              }}
              aria-label="Filter by status"
              className="h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="">All Statuses</option>
              {MENU_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updatedAt' | 'name' | 'displayOrder')}
              aria-label="Sort menus"
              className="h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="updatedAt">Sort: Recently Updated</option>
              <option value="name">Sort: Name</option>
              <option value="displayOrder">Sort: Display Order</option>
            </select>
          </div>

          {selectedMenuIds.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-900">
                {selectedMenuIds.length} menu(s) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleBulkMenuAction('publish')}
                  className="px-3 py-1.5 rounded-lg bg-[#16A34A] text-white font-bold"
                >
                  Publish Selected
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkMenuAction('unpublish')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold"
                >
                  Move to Draft
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkMenuAction('delete')}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all menus"
                      checked={menus.length > 0 && selectedMenuIds.length === menus.length}
                      onChange={(e) =>
                        setSelectedMenuIds(e.target.checked ? menus.map((m) => m._id) : [])
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Menu Name & Slug</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Placement</th>
                  <th className="px-4 py-3 text-center font-semibold">Items / Slides</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menus.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No navigation menus match the current filters.
                    </td>
                  </tr>
                ) : (
                  menus.map((m) => {
                    const isPublished = m.status === 'published' || m.status === 'scheduled';
                    return (
                      <tr key={m._id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${m.name}`}
                            checked={selectedMenuIds.includes(m._id)}
                            onChange={(e) =>
                              setSelectedMenuIds((prev) =>
                                e.target.checked
                                  ? [...prev, m._id]
                                  : prev.filter((id) => id !== m._id)
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{m.name}</p>
                          <p className="font-mono text-[11px] text-slate-400">/{m.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {MENU_TYPE_LABELS[m.menuType] || m.menuType}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {m.placement}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-slate-800">{m.itemCount ?? 0}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-emerald-700 font-semibold">{m.slideCount ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              m.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void openMenuBuilder(m._id)}
                              title="Edit in Visual Builder"
                              aria-label={`Edit ${m.name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[#15803D] hover:bg-emerald-100 font-bold"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Builder</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleTogglePublish(m)}
                              title={isPublished ? 'Move to Draft' : 'Publish'}
                              aria-label={isPublished ? `Unpublish ${m.name}` : `Publish ${m.name}`}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              {isPublished ? (
                                <Globe className="w-3.5 h-3.5 text-[#16A34A]" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDuplicateMenu(m._id)}
                              title="Duplicate menu"
                              aria-label={`Duplicate ${m.name}`}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: 'menu', id: m._id, label: m.name })
                              }
                              title="Delete menu"
                              aria-label={`Delete ${m.name}`}
                              className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} menus)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VISUAL BUILDER */}
      {tab === 'builder' && activeMenu && (
        <NavigationMenuBuilder
          menu={activeMenu}
          flatItems={activeMenuFlatItems}
          resources={resources}
          onBack={() => setTab('menus')}
          onMenuUpdated={(updated, nextFlat) => {
            setActiveMenu(updated);
            if (nextFlat) setActiveMenuFlatItems(nextFlat);
            void loadOverviewAndCatalog();
          }}
        />
      )}

      {/* TAB 4: PROMOTIONAL SLIDES MANAGER */}
      {tab === 'slides' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Mega Menu Promotional Slides
              </h2>
              <p className="text-xs text-slate-500">
                Drag cards or use arrows to reorder. Slides assigned to active mega menus automatically power the right promotional carousel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingSlide(null);
                setSlideModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Promotional Slide</span>
            </button>
          </div>

          {slides.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No promotional slides created yet</p>
              <p className="text-xs text-slate-500">
                Add promotional slides to showcase deals inside your mega menus (sliders stay hidden on the storefront until at least one active slide exists).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slides.map((slide, idx) => (
                <div
                  key={slide._id}
                  draggable
                  onDragStart={() => setDraggedSlideId(slide._id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggedSlideId || draggedSlideId === slide._id) return;
                    const fromIdx = slides.findIndex((s) => s._id === draggedSlideId);
                    setDraggedSlideId(null);
                    if (fromIdx < 0) return;
                    const next = [...slides];
                    const [moved] = next.splice(fromIdx, 1);
                    next.splice(idx, 0, moved);
                    void persistSlidesOrder(next);
                  }}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex gap-4 items-start"
                >
                  <div className="w-24 h-24 rounded-xl bg-emerald-50 border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {slide.desktopImageUrl ? (
                      <SafeImage
                        src={slide.desktopImageUrl}
                        alt={slide.mainHeading}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Sparkles className="w-6 h-6 text-[#16A34A]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="cursor-grab text-slate-400">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          <p className="text-xs font-extrabold text-slate-900 truncate">
                            {slide.internalName}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              slide.isActive && slide.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {slide.isActive ? slide.status : 'Paused'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#15803D] mt-0.5 truncate">
                          {slide.mainHeading} {slide.highlightText}
                        </p>
                        {slide.discountText && (
                          <p className="text-[11px] text-slate-600 truncate">
                            {slide.discountText} · CTA: {slide.ctaLabel} → {slide.ctaUrl}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slide.isActive}
                          onChange={() => void handleToggleSlideActive(slide)}
                        />
                        <span>Active</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, -1)}
                          aria-label="Move slide up"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, 1)}
                          aria-label="Move slide down"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSlide(slide);
                            setSlideModalOpen(true);
                          }}
                          aria-label={`Edit ${slide.internalName}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDuplicateSlide(slide)}
                          aria-label={`Duplicate ${slide.internalName}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              kind: 'slide',
                              id: slide._id,
                              label: slide.internalName,
                            })
                          }
                          aria-label={`Delete ${slide.internalName}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PLACEMENTS */}
      {tab === 'placements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {placementRows.map((pl) => (
            <div
              key={pl.key}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">{pl.label}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                    {pl.allowMultipleActive ? 'Multi-Active Allowed' : 'Single Active Slot'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{pl.description}</p>
                <p className="text-[11px] font-mono text-emerald-700">placement: {pl.key}</p>
              </div>

              <div className="space-y-2">
                {pl.assignedMenus.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No menus assigned yet.</p>
                ) : (
                  pl.assignedMenus.map((am) => (
                    <div
                      key={am._id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{am.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {am.status.toUpperCase()} · {am.menuType}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openMenuBuilder(am._id)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[#15803D] font-bold hover:bg-emerald-50"
                      >
                        Configure
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreateForm({
                    name: '',
                    slug: '',
                    menuType: pl.defaultMenuType,
                    placement: pl.key,
                    categoryMode: pl.key === 'all_categories' ? 'auto' : 'manual',
                    status: 'draft',
                    description: pl.description,
                    replaceExistingActive: true,
                  });
                  setCreateOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-emerald-400 text-[#15803D] bg-emerald-50/50 hover:bg-emerald-50 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Menu for {pl.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Menu Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Navigation Menu"
        description="Configure a new storefront mega menu, dropdown, or responsive navigation bar."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleCreateMenu} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Name *</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  }))
                }
                placeholder="e.g. Festive Mega Menu"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slug *</label>
              <input
                type="text"
                required
                value={createForm.slug}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
                  }))
                }
                placeholder="festive-mega-menu"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Type</label>
              <select
                value={createForm.menuType}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, menuType: e.target.value as NavigationMenuType }))
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
              >
                {MENU_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {MENU_TYPE_LABELS[mt]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Placement</label>
              <select
                value={createForm.placement}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    placement: e.target.value as NavigationPlacementKey,
                  }))
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
              >
                {DEFAULT_PLACEMENT_DEFINITIONS.map((pl) => (
                  <option key={pl.key} value={pl.key}>
                    {pl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category Source</label>
              <select
                value={createForm.categoryMode}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    categoryMode: e.target.value as 'auto' | 'hybrid' | 'manual',
                  }))
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="auto">Auto Sync Catalog Categories</option>
                <option value="hybrid">Hybrid (Categories + Custom)</option>
                <option value="manual">Manual Custom Items Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
              <select
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, status: e.target.value as NavigationMenuStatus }))
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="draft">Draft</option>
                <option value="published">Published Immediately</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {creating ? 'Creating...' : 'Create & Open Builder'}
            </button>
          </div>
        </form>
      </Modal>

      <MegaMenuSlideModal
        open={slideModalOpen}
        onClose={() => setSlideModalOpen(false)}
        slide={editingSlide}
        menus={menus}
        defaultMenuId={activeMenu?._id}
        onSaved={() => void loadOverviewAndCatalog()}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message={`Permanently delete ${deleteTarget?.label || ''}?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
