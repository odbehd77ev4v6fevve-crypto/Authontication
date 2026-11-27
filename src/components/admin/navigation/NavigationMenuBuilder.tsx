import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  GripVertical,
  Layers,
  LayoutTemplate,
  ListTree,
  Pencil,
  Plus,
  Save,
  Send,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  buildMegaMenuItemTree,
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  DEFAULT_PLACEMENT_DEFINITIONS,
  DEFAULT_RESPONSIVE_CONFIG,
  DEFAULT_SLIDER_SETTINGS,
  getMegaMenuTemplatePreset,
  MENU_ITEM_TYPES,
  MENU_ITEM_TYPE_LABELS,
  MENU_STATUSES,
  MENU_TEMPLATES,
  MENU_TYPES,
  MENU_TYPE_LABELS,
  MENU_VISIBILITIES,
  type MegaMenuColumnLayout,
  type MegaMenuSectionId,
  type MegaMenuTemplateKey,
  type NavigationItemRecord,
  type NavigationItemType,
  type NavigationMenuRecord,
  type NavigationMenuStatus,
  type NavigationMenuType,
  type NavigationMenuVisibility,
  type NavigationPlacementKey,
  type StructuredContentBlock,
} from '../../../../shared/megaMenuHelpers.ts';
import { useAppDispatch } from '../../../app/hooks.ts';
import { pushToast } from '../../../features/toast/toastSlice.ts';
import { apiRequest } from '../../../lib/api.ts';
import type { NavigationResourcesPayload } from '../../../types/domain.ts';
import { NavIconRenderer } from '../../navigation/NavIconRenderer.tsx';
import { CloudinaryUploadField } from '../../ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { Modal } from '../../ui/Modal.tsx';
import { IconPickerModal, type IconPickerValue } from './IconPickerModal.tsx';
import { LiveMenuPreviewPanel } from './LiveMenuPreviewPanel.tsx';

interface NavigationMenuBuilderProps {
  menu: NavigationMenuRecord;
  flatItems: NavigationItemRecord[];
  resources: NavigationResourcesPayload;
  onBack: () => void;
  onMenuUpdated: (menu: NavigationMenuRecord, flatItems?: NavigationItemRecord[]) => void;
}

type BuilderTab = 'general' | 'layout' | 'items' | 'preview';

function toDatetimeLocalValue(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const SECTION_LABELS: Record<MegaMenuSectionId, string> = {
  sidebar: 'Left Category Sidebar',
  grid: 'Middle Columns Grid',
  slider: 'Right Promo Slider',
};

export function NavigationMenuBuilder({
  menu,
  flatItems,
  resources,
  onBack,
  onMenuUpdated,
}: NavigationMenuBuilderProps) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<BuilderTab>('layout');
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<NavigationMenuRecord>(menu);
  const [items, setItems] = useState<NavigationItemRecord[]>(flatItems);
  const [replaceExistingActive, setReplaceExistingActive] = useState(true);
  const [targetPathsInput, setTargetPathsInput] = useState((menu.targetPaths || []).join(', '));

  // Item Tree & DnD State
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<NavigationItemRecord | null>(null);

  // Item Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavigationItemRecord | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemForm, setItemForm] = useState({
    parentId: '' as string,
    label: '',
    itemType: 'category' as NavigationItemType,
    targetId: '',
    targetSlug: '',
    url: '/shop',
    openInNewTab: false,
    iconType: 'lucide' as 'lucide' | 'svg' | 'image' | 'none',
    iconName: 'LayoutGrid',
    iconSvg: '',
    iconImageUrl: '',
    iconImagePublicId: '',
    iconColor: '#16A34A',
    iconBgColor: '#DCFCE7',
    imageUrl: '',
    imagePublicId: '',
    badgeText: '',
    badgeBgColor: '#16A34A',
    badgeTextColor: '#FFFFFF',
    description: '',
    featuredGroupLimit: 4,
    isVisible: true,
    structuredBlocks: [] as StructuredContentBlock[],
  });

  useEffect(() => {
    setDraft(menu);
    setTargetPathsInput((menu.targetPaths || []).join(', '));
  }, [menu]);

  useEffect(() => {
    setItems(flatItems);
  }, [flatItems]);

  const itemTree = useMemo(
    () => buildMegaMenuItemTree(items, { includeHidden: true, maxDepth: draft.maxDepth || 4 }),
    [items, draft.maxDepth]
  );

  const parentCategories = useMemo(
    () => resources.categories.filter((c) => !c.parentId),
    [resources.categories]
  );
  const subcategories = useMemo(
    () => resources.categories.filter((c) => Boolean(c.parentId)),
    [resources.categories]
  );

  const handleSaveMenu = async (overrideStatus?: NavigationMenuStatus) => {
    setSaving(true);
    try {
      const targetPaths = targetPathsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: draft.name,
        slug: draft.slug,
        menuType: draft.menuType,
        placement: draft.placement,
        description: draft.description || '',
        status: overrideStatus || draft.status,
        visibility: draft.visibility,
        displayOrder: Number(draft.displayOrder) || 0,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
        targetPaths,
        categoryMode: draft.categoryMode,
        includedCategoryIds: draft.includedCategoryIds || [],
        excludedCategoryIds: draft.excludedCategoryIds || [],
        maxDepth: draft.maxDepth || 4,
        megaMenuConfig: draft.megaMenuConfig,
        appearanceConfig: draft.appearanceConfig,
        responsiveConfig: draft.responsiveConfig,
        sliderSettings: draft.sliderSettings,
        replaceExistingActive,
      };

      const res = await apiRequest<{ menu: NavigationMenuRecord }>(
        `/api/navigation/admin/menus/${draft._id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(
        pushToast({
          variant: 'success',
          message: overrideStatus === 'published' ? 'Menu saved and published.' : 'Menu settings saved.',
        })
      );
      onMenuUpdated(res.menu);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save navigation menu.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (templateKey: MegaMenuTemplateKey) => {
    const preset = getMegaMenuTemplatePreset(templateKey);
    setDraft((prev) => ({
      ...prev,
      appearanceConfig: {
        ...prev.appearanceConfig,
        ...preset,
        template: templateKey,
      },
    }));
  };

  const moveSectionOrder = (index: number, delta: -1 | 1) => {
    const current = [...(draft.megaMenuConfig.sectionOrder || ['sidebar', 'grid', 'slider'])];
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    setDraft((prev) => ({
      ...prev,
      megaMenuConfig: { ...prev.megaMenuConfig, sectionOrder: current },
    }));
  };

  const toggleCategoryFilter = (field: 'includedCategoryIds' | 'excludedCategoryIds', catId: string) => {
    setDraft((prev) => {
      const current = prev[field] || [];
      const next = current.includes(catId)
        ? current.filter((id) => id !== catId)
        : [...current, catId];
      return { ...prev, [field]: next };
    });
  };

  const openCreateItemModal = (parentId = '') => {
    setEditingItem(null);
    setItemForm({
      parentId,
      label: '',
      itemType: 'category',
      targetId: '',
      targetSlug: '',
      url: '/shop',
      openInNewTab: false,
      iconType: 'lucide',
      iconName: 'LayoutGrid',
      iconSvg: '',
      iconImageUrl: '',
      iconImagePublicId: '',
      iconColor: '#16A34A',
      iconBgColor: '#DCFCE7',
      imageUrl: '',
      imagePublicId: '',
      badgeText: '',
      badgeBgColor: '#16A34A',
      badgeTextColor: '#FFFFFF',
      description: '',
      featuredGroupLimit: 4,
      isVisible: true,
      structuredBlocks: [],
    });
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: NavigationItemRecord) => {
    setEditingItem(item);
    setItemForm({
      parentId: item.parentId ? String(item.parentId) : '',
      label: item.label,
      itemType: item.itemType,
      targetId: item.targetId || '',
      targetSlug: item.targetSlug || '',
      url: item.url || '/shop',
      openInNewTab: Boolean(item.openInNewTab),
      iconType: item.iconType || 'lucide',
      iconName: item.iconName || 'LayoutGrid',
      iconSvg: item.iconSvg || '',
      iconImageUrl: item.iconImageUrl || '',
      iconImagePublicId: item.iconImagePublicId || '',
      iconColor: item.iconColor || '#16A34A',
      iconBgColor: item.iconBgColor || '#DCFCE7',
      imageUrl: item.imageUrl || '',
      imagePublicId: item.imagePublicId || '',
      badgeText: item.badgeText || '',
      badgeBgColor: item.badgeBgColor || '#16A34A',
      badgeTextColor: item.badgeTextColor || '#FFFFFF',
      description: item.description || '',
      featuredGroupLimit: item.featuredGroupLimit || 4,
      isVisible: item.isVisible ?? true,
      structuredBlocks: item.structuredBlocks || [],
    });
    setItemModalOpen(true);
  };

  const handleResourceTargetSelect = (selectedId: string) => {
    let label = itemForm.label;
    let url = itemForm.url;
    let slug = '';

    if (itemForm.itemType === 'category' || itemForm.itemType === 'subcategory') {
      const cat = resources.categories.find((c) => c._id === selectedId);
      if (cat) {
        if (!label) label = cat.name;
        slug = cat.slug;
        url = `/category/${cat.slug}`;
      }
    } else if (itemForm.itemType === 'product') {
      const prod = resources.products.find((p) => p._id === selectedId);
      if (prod) {
        if (!label) label = prod.name;
        slug = prod.slug;
        url = `/product/${prod.slug}`;
      }
    } else if (itemForm.itemType === 'brand') {
      const brand = resources.brands.find((b) => b._id === selectedId);
      if (brand) {
        if (!label) label = brand.name;
        slug = brand.slug;
        url = `/brand/${brand.slug}`;
      }
    } else if (itemForm.itemType === 'collection') {
      const col = resources.collections.find((c) => c._id === selectedId);
      if (col) {
        if (!label) label = col.title;
        slug = col.slug;
        url = `/shop?collection=${encodeURIComponent(col.slug)}`;
      }
    } else if (itemForm.itemType === 'campaign') {
      const cmp = resources.campaigns.find((c) => c._id === selectedId);
      if (cmp) {
        if (!label) label = cmp.name;
        slug = cmp.slug;
        url = `/deals?campaign=${encodeURIComponent(cmp.slug)}`;
      }
    } else if (itemForm.itemType === 'static_page') {
      const pg = resources.pages.find((p) => p._id === selectedId);
      if (pg) {
        if (!label) label = pg.title;
        slug = pg.slug;
        url = `/page/${pg.slug}`;
      }
    } else if (itemForm.itemType === 'blog') {
      const post = resources.blogs.find((b) => b._id === selectedId);
      if (post) {
        if (!label) label = post.title;
        slug = post.slug;
        url = `/blog/${post.slug}`;
      }
    }

    setItemForm((f) => ({
      ...f,
      targetId: selectedId,
      targetSlug: slug,
      label,
      url,
    }));
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemSaving(true);
    try {
      const payload = {
        ...itemForm,
        parentId: itemForm.parentId || null,
        targetId: itemForm.targetId || null,
        featuredGroupLimit: Number(itemForm.featuredGroupLimit) || 4,
      };
      const endpoint = editingItem
        ? `/api/navigation/admin/menus/${draft._id}/items/${editingItem._id}`
        : `/api/navigation/admin/menus/${draft._id}/items`;

      const res = await apiRequest<{ flatItems: NavigationItemRecord[]; menu: NavigationMenuRecord }>(
        endpoint,
        {
          method: editingItem ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      setItems(res.flatItems);
      onMenuUpdated(res.menu, res.flatItems);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      setItemModalOpen(false);
      dispatch(
        pushToast({
          variant: 'success',
          message: editingItem ? 'Menu item updated.' : 'Menu item added.',
        })
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save menu item.',
        })
      );
    } finally {
      setItemSaving(false);
    }
  };

  const handleDuplicateItem = async (itemId: string) => {
    try {
      const res = await apiRequest<{ flatItems: NavigationItemRecord[]; menu: NavigationMenuRecord }>(
        `/api/navigation/admin/menus/${draft._id}/items/${itemId}/duplicate`,
        { method: 'POST' }
      );
      setItems(res.flatItems);
      onMenuUpdated(res.menu, res.flatItems);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'success', message: 'Menu item duplicated.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Duplicate failed.',
        })
      );
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      const res = await apiRequest<{ flatItems: NavigationItemRecord[]; menu: NavigationMenuRecord }>(
        `/api/navigation/admin/menus/${draft._id}/items/${deleteItemTarget._id}`,
        { method: 'DELETE' }
      );
      setDeleteItemTarget(null);
      setItems(res.flatItems);
      onMenuUpdated(res.menu, res.flatItems);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'info', message: 'Menu item deleted.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Delete failed.',
        })
      );
    }
  };

  const persistReorder = async (
    updatedPatches: Array<{ _id: string; parentId?: string | null; displayOrder: number }>
  ) => {
    try {
      const res = await apiRequest<{ flatItems: NavigationItemRecord[]; menu: NavigationMenuRecord }>(
        `/api/navigation/admin/menus/${draft._id}/reorder`,
        {
          method: 'PUT',
          body: JSON.stringify({ items: updatedPatches }),
        }
      );
      setItems(res.flatItems);
      onMenuUpdated(res.menu, res.flatItems);
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(pushToast({ variant: 'success', message: 'Menu order saved.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Reorder failed.',
        })
      );
    }
  };

  const handleSiblingMove = (node: NavigationItemRecord, direction: -1 | 1) => {
    const pid = node.parentId ? String(node.parentId) : '';
    const siblings = items
      .filter((i) => String(i.parentId || '') === pid)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = siblings.findIndex((s) => s._id === node._id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const patches = reordered.map((s, order) => ({
      _id: s._id,
      parentId: s.parentId || null,
      displayOrder: order,
    }));
    void persistReorder(patches);
  };

  const handleDropOnItem = (targetNode: NavigationItemRecord) => {
    if (!draggedItemId || draggedItemId === targetNode._id) return;
    const draggedNode = items.find((i) => i._id === draggedItemId);
    setDraggedItemId(null);
    if (!draggedNode) return;

    const targetPid = targetNode.parentId ? String(targetNode.parentId) : null;
    const siblings = items
      .filter((i) => String(i.parentId || '') === String(targetPid || '') && i._id !== draggedNode._id)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const targetIndex = siblings.findIndex((s) => s._id === targetNode._id);
    const insertIndex = targetIndex >= 0 ? targetIndex : siblings.length;
    siblings.splice(insertIndex, 0, { ...draggedNode, parentId: targetPid });

    const patches = siblings.map((s, idx) => ({
      _id: s._id,
      parentId: targetPid,
      displayOrder: idx,
    }));
    void persistReorder(patches);
  };

  const renderTreeNodes = (nodes: NavigationItemRecord[], depth = 0) => {
    return nodes.map((node) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isCollapsed = collapsedIds[node._id];
      return (
        <div key={node._id} className="space-y-1.5">
          <div
            draggable
            onDragStart={() => setDraggedItemId(node._id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnItem(node);
            }}
            style={{ marginLeft: `${depth * 24}px` }}
            className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border bg-white transition-colors ${
              draggedItemId === node._id
                ? 'border-[#16A34A] bg-emerald-50/40'
                : 'border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="cursor-grab text-slate-400 hover:text-slate-600 shrink-0" title="Drag to reorder">
                <GripVertical className="w-4 h-4" />
              </span>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedIds((prev) => ({ ...prev, [node._id]: !prev[node._id] }))
                  }
                  className="p-0.5 rounded text-slate-500 hover:bg-slate-100"
                  aria-label="Toggle children"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}

              {node.iconType !== 'none' && (
                <span
                  style={{
                    backgroundColor: node.iconBgColor || '#DCFCE7',
                    color: node.iconColor || '#16A34A',
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                >
                  <NavIconRenderer
                    iconType={node.iconType}
                    iconName={node.iconName}
                    iconSvg={node.iconSvg}
                    iconImageUrl={node.iconImageUrl}
                    iconColor={node.iconColor}
                    sizePx={15}
                  />
                </span>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 truncate">{node.label}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                    {MENU_ITEM_TYPE_LABELS[node.itemType] || node.itemType}
                  </span>
                  {node.badgeText && (
                    <span
                      style={{
                        backgroundColor: node.badgeBgColor || '#16A34A',
                        color: node.badgeTextColor || '#FFFFFF',
                      }}
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    >
                      {node.badgeText}
                    </span>
                  )}
                  {!node.isVisible && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-400 truncate">{node.url}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleSiblingMove(node, -1)}
                title="Move up"
                aria-label={`Move ${node.label} up`}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSiblingMove(node, 1)}
                title="Move down"
                aria-label={`Move ${node.label} down`}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openCreateItemModal(node._id)}
                title="Add child item"
                aria-label={`Add child under ${node.label}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-[#15803D] text-[11px] font-semibold hover:bg-emerald-100"
              >
                <Plus className="w-3 h-3" />
                <span>Child</span>
              </button>
              <button
                type="button"
                onClick={() => openEditItemModal(node)}
                aria-label={`Edit ${node.label}`}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleDuplicateItem(node._id)}
                aria-label={`Duplicate ${node.label}`}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteItemTarget(node)}
                aria-label={`Delete ${node.label}`}
                className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {hasChildren && !isCollapsed && renderTreeNodes(node.children!, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-5">
      {/* Builder Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Menus</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 truncate">{draft.name}</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  draft.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : draft.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {draft.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">
              /{draft.slug} · {draft.placement}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveMenu()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveMenu('published')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Save & Publish</span>
          </button>
        </div>
      </div>

      {/* Builder Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['general', '1. General & Placement', Sliders],
            ['layout', '2. Visual Layout & Style', LayoutTemplate],
            ['items', `3. Menu Items (${items.length})`, ListTree],
            ['preview', '4. Live Preview', Eye],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              tab === key
                ? 'bg-[#0B1A2B] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: GENERAL & PLACEMENT */}
      {tab === 'general' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Name *</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Slug *</label>
              <input
                type="text"
                value={draft.slug}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Type</label>
              <select
                value={draft.menuType}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, menuType: e.target.value as NavigationMenuType }))
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white"
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
                value={draft.placement}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    placement: e.target.value as NavigationPlacementKey,
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {DEFAULT_PLACEMENT_DEFINITIONS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value as NavigationMenuStatus }))
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {MENU_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Visibility</label>
              <select
                value={draft.visibility}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    visibility: e.target.value as NavigationMenuVisibility,
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {MENU_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Schedule Start (Optional)
              </label>
              <input
                type="datetime-local"
                value={toDatetimeLocalValue(draft.startsAt)}
                onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value || null }))}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Schedule End (Optional)
              </label>
              <input
                type="datetime-local"
                value={toDatetimeLocalValue(draft.endsAt)}
                onChange={(e) => setDraft((d) => ({ ...d, endsAt: e.target.value || null }))}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={draft.description || ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Internal notes describing this menu placement and role..."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Route Paths (Optional, comma-separated e.g. /shop, /deals/*)
            </label>
            <input
              type="text"
              value={targetPathsInput}
              onChange={(e) => setTargetPathsInput(e.target.value)}
              placeholder="Leave empty to show everywhere for this placement"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={replaceExistingActive}
              onChange={(e) => setReplaceExistingActive(e.target.checked)}
            />
            <span>
              Automatically replace any currently active menu in single-slot placements on publish
            </span>
          </label>
        </div>
      )}

      {/* TAB 2: VISUAL MEGA MENU LAYOUT, CATEGORIES, TEMPLATES & RESPONSIVE */}
      {tab === 'layout' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Mega Menu Layout & Sections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#16A34A]" />
              <span>Mega Menu Structure & Columns</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['showSidebar', 'Left Sidebar'],
                  ['showGrid', 'Middle Grid'],
                  ['showSlider', 'Right Slider'],
                ] as const
              ).map(([field, label]) => (
                <label
                  key={field}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    draft.megaMenuConfig[field]
                      ? 'bg-emerald-50 border-[#16A34A] text-[#15803D]'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(draft.megaMenuConfig[field])}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        megaMenuConfig: { ...d.megaMenuConfig, [field]: e.target.checked },
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* Section Ordering */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">Section Display Order</p>
              <div className="grid grid-cols-3 gap-2">
                {(draft.megaMenuConfig.sectionOrder || ['sidebar', 'grid', 'slider']).map(
                  (sec, idx) => (
                    <div
                      key={sec}
                      className="flex items-center justify-between gap-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-semibold"
                    >
                      <span className="truncate">{SECTION_LABELS[sec]}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSectionOrder(idx, -1)}
                          className="p-1 rounded hover:bg-slate-200"
                          aria-label={`Move ${sec} left`}
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSectionOrder(idx, 1)}
                          className="p-1 rounded hover:bg-slate-200"
                          aria-label={`Move ${sec} right`}
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Grid Columns</label>
                <select
                  value={draft.megaMenuConfig.columns}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      megaMenuConfig: {
                        ...d.megaMenuConfig,
                        columns: e.target.value as MegaMenuColumnLayout,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="1">1 Column</option>
                  <option value="2">2 Columns (Reference)</option>
                  <option value="3">3 Columns</option>
                  <option value="4">4 Columns</option>
                  <option value="auto">Auto</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Sidebar Width (px)
                </label>
                <input
                  type="number"
                  min={180}
                  max={360}
                  value={draft.megaMenuConfig.sidebarWidthPx}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      megaMenuConfig: {
                        ...d.megaMenuConfig,
                        sidebarWidthPx: Number(e.target.value) || 235,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Slider Width (px)
                </label>
                <input
                  type="number"
                  min={220}
                  max={460}
                  value={draft.megaMenuConfig.sliderWidthPx}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      megaMenuConfig: {
                        ...d.megaMenuConfig,
                        sliderWidthPx: Number(e.target.value) || 330,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-semibold">
              {(
                [
                  ['showAllCategoriesEntry', 'Show All Entry'],
                  ['showViewAllLinks', 'Show "View All →"'],
                  ['showCategoryIcons', 'Category Icons'],
                  ['showSubcategoryIcons', 'Subcategory Thumbs'],
                  ['showProductImages', 'Featured Products'],
                  ['showHelpCard', 'Need Help Card'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="inline-flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.megaMenuConfig[field])}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        megaMenuConfig: { ...d.megaMenuConfig, [field]: e.target.checked },
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {draft.megaMenuConfig.showHelpCard && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Help Card Title
                  </label>
                  <input
                    type="text"
                    value={draft.megaMenuConfig.helpCardTitle}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        megaMenuConfig: { ...d.megaMenuConfig, helpCardTitle: e.target.value },
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Support Phone
                  </label>
                  <input
                    type="text"
                    value={draft.megaMenuConfig.helpCardPhone}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        megaMenuConfig: { ...d.megaMenuConfig, helpCardPhone: e.target.value },
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white font-mono"
                  />
                </div>
              </div>
            )}

            {/* Category Mode & DB Category Selector */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800">Catalog Category Mode</label>
                <select
                  value={draft.categoryMode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      categoryMode: e.target.value as 'auto' | 'hybrid' | 'manual',
                    }))
                  }
                  className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="auto">Auto (All Active Catalog Categories)</option>
                  <option value="hybrid">Hybrid (Categories + Custom Items)</option>
                  <option value="manual">Manual Only (Custom Menu Items)</option>
                </select>
              </div>

              {draft.categoryMode !== 'manual' && parentCategories.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">
                    Optionally pick specific parent categories to include (leave all unchecked to display every active category):
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200">
                    {parentCategories.map((cat) => {
                      const included = (draft.includedCategoryIds || []).includes(cat._id);
                      return (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => toggleCategoryFilter('includedCategoryIds', cat._id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                            included
                              ? 'bg-[#16A34A] text-white border-[#16A34A]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Templates, Appearance & Responsive */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Theme Templates, Typography & Responsive Behavior
            </h3>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">Template Preset</p>
              <div className="grid grid-cols-3 gap-2">
                {MENU_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                      draft.appearanceConfig.template === tpl
                        ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tpl.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              {(
                [
                  ['backgroundColor', 'Panel Bg'],
                  ['sidebarBgColor', 'Sidebar Bg'],
                  ['textColor', 'Text'],
                  ['activeBgColor', 'Active Pill'],
                  ['activeTextColor', 'Active Text'],
                  ['borderColor', 'Border'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span>{label}</span>
                  <input
                    type="color"
                    value={String(draft.appearanceConfig[field] || '#FFFFFF')}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        appearanceConfig: {
                          ...d.appearanceConfig,
                          template: 'custom',
                          [field]: e.target.value,
                        },
                      }))
                    }
                    className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trigger Mode</label>
                <select
                  value={draft.appearanceConfig.triggerMode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      appearanceConfig: {
                        ...d.appearanceConfig,
                        triggerMode: e.target.value as 'hover_or_click' | 'click' | 'hover',
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="hover_or_click">Hover or Click</option>
                  <option value="click">Click Only</option>
                  <option value="hover">Hover Only</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Animation</label>
                <select
                  value={draft.appearanceConfig.animation}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      appearanceConfig: {
                        ...d.appearanceConfig,
                        animation: e.target.value as 'fade' | 'slide_down' | 'scale' | 'none',
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="fade">Fade</option>
                  <option value="slide_down">Slide Down</option>
                  <option value="scale">Scale</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Max Height (px)
                </label>
                <input
                  type="number"
                  min={300}
                  max={900}
                  value={draft.appearanceConfig.maxHeightPx}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      appearanceConfig: {
                        ...d.appearanceConfig,
                        maxHeightPx: Number(e.target.value) || 540,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Responsive & Slider Playback */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-xs font-bold text-slate-800">Responsive & Slider Controls</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.responsiveConfig.desktopEnabled}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        responsiveConfig: { ...d.responsiveConfig, desktopEnabled: e.target.checked },
                      }))
                    }
                  />
                  <span>Desktop Enabled</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.responsiveConfig.mobileEnabled}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        responsiveConfig: { ...d.responsiveConfig, mobileEnabled: e.target.checked },
                      }))
                    }
                  />
                  <span>Mobile Enabled</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.responsiveConfig.showPromoSliderOnMobile}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        responsiveConfig: {
                          ...d.responsiveConfig,
                          showPromoSliderOnMobile: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Slider in Mobile</span>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mobile Drawer Mode
                  </label>
                  <select
                    value={draft.responsiveConfig.mobileDrawerMode}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        responsiveConfig: {
                          ...d.responsiveConfig,
                          mobileDrawerMode: e.target.value as 'accordion' | 'drilldown',
                        },
                      }))
                    }
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    <option value="accordion">Accordion Expand</option>
                    <option value="drilldown">Drilldown Screen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Slider Autoplay (ms)
                  </label>
                  <input
                    type="number"
                    min={1500}
                    max={20000}
                    step={500}
                    value={draft.sliderSettings.intervalMs}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sliderSettings: {
                          ...d.sliderSettings,
                          intervalMs: Number(e.target.value) || 4500,
                        },
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div className="flex flex-col justify-center gap-1 text-xs font-semibold">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.sliderSettings.autoplay}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          sliderSettings: { ...d.sliderSettings, autoplay: e.target.checked },
                        }))
                      }
                    />
                    <span>Autoplay</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.sliderSettings.pauseOnHover}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          sliderSettings: { ...d.sliderSettings, pauseOnHover: e.target.checked },
                        }))
                      }
                    />
                    <span>Pause on Hover</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MENU ITEMS & NESTED TREE DRAG-AND-DROP */}
      {tab === 'items' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Menu Items & Nested Hierarchy
              </h3>
              <p className="text-xs text-slate-500">
                Drag items or use Up/Down controls to persist ordering immediately. Add nested child items up to depth {draft.maxDepth}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreateItemModal('')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Root Item</span>
            </button>
          </div>

          {itemTree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No custom menu items yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {draft.categoryMode === 'auto'
                  ? 'This menu currently pulls live catalog categories automatically. Add custom items if you switch to Hybrid or Manual mode.'
                  : 'Add categories, subcategories, products, brands, campaigns, or custom links to populate this menu.'}
              </p>
              <button
                type="button"
                onClick={() => openCreateItemModal('')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-bold mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Item</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">{renderTreeNodes(itemTree)}</div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE PREVIEW */}
      {tab === 'preview' && <LiveMenuPreviewPanel menu={draft} />}

      {/* Add / Edit Item Modal */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingItem ? 'Edit Navigation Item' : 'Add Navigation Item'}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Type</label>
              <select
                value={itemForm.itemType}
                onChange={(e) =>
                  setItemForm((f) => ({
                    ...f,
                    itemType: e.target.value as NavigationItemType,
                    targetId: '',
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white"
              >
                {MENU_ITEM_TYPES.map((typeKey) => (
                  <option key={typeKey} value={typeKey}>
                    {MENU_ITEM_TYPE_LABELS[typeKey]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Item</label>
              <select
                value={itemForm.parentId}
                onChange={(e) => setItemForm((f) => ({ ...f, parentId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="">Top Level (Root)</option>
                {items
                  .filter((i) => !editingItem || i._id !== editingItem._id)
                  .map((i) => (
                    <option key={i._id} value={i._id}>
                      {i.parentId ? `↳ ${i.label}` : i.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Dynamic Resource Picker based on itemType */}
          {(itemForm.itemType === 'category' ||
            itemForm.itemType === 'subcategory' ||
            itemForm.itemType === 'product' ||
            itemForm.itemType === 'brand' ||
            itemForm.itemType === 'collection' ||
            itemForm.itemType === 'campaign' ||
            itemForm.itemType === 'static_page' ||
            itemForm.itemType === 'blog') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Existing {MENU_ITEM_TYPE_LABELS[itemForm.itemType]}
              </label>
              <select
                value={itemForm.targetId}
                onChange={(e) => handleResourceTargetSelect(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="">-- Choose from database --</option>
                {itemForm.itemType === 'category' &&
                  parentCategories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                {itemForm.itemType === 'subcategory' &&
                  subcategories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                {itemForm.itemType === 'product' &&
                  resources.products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                {itemForm.itemType === 'brand' &&
                  resources.brands.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                {itemForm.itemType === 'collection' &&
                  resources.collections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                {itemForm.itemType === 'campaign' &&
                  resources.campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                {itemForm.itemType === 'static_page' &&
                  resources.pages.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title}
                    </option>
                  ))}
                {itemForm.itemType === 'blog' &&
                  resources.blogs.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.title}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Label *</label>
              <input
                type="text"
                required
                value={itemForm.label}
                onChange={(e) => setItemForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Electronics"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination URL *</label>
              <input
                type="text"
                required
                value={itemForm.url}
                onChange={(e) => setItemForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="/shop"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>

          {/* Icon + Badge + Thumbnail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    backgroundColor: itemForm.iconBgColor || '#DCFCE7',
                    color: itemForm.iconColor || '#16A34A',
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200"
                >
                  <NavIconRenderer
                    iconType={itemForm.iconType}
                    iconName={itemForm.iconName}
                    iconSvg={itemForm.iconSvg}
                    iconImageUrl={itemForm.iconImageUrl}
                    iconColor={itemForm.iconColor}
                    sizePx={18}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Menu Icon</p>
                  <p className="text-[11px] text-slate-500">
                    {itemForm.iconType === 'none' ? 'No icon' : `${itemForm.iconType}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIconPickerOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Choose Icon
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Badge Label (Optional)
                </label>
                <input
                  type="text"
                  value={itemForm.badgeText}
                  onChange={(e) => setItemForm((f) => ({ ...f, badgeText: e.target.value }))}
                  placeholder="HOT, -50%, NEW"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bg</label>
                <input
                  type="color"
                  value={itemForm.badgeBgColor}
                  onChange={(e) => setItemForm((f) => ({ ...f, badgeBgColor: e.target.value }))}
                  className="w-8 h-8 rounded border border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subtitle / Description (Optional)
              </label>
              <input
                type="text"
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short helper line..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <CloudinaryUploadField
                folder="navigation"
                label="Upload Card Image (Optional)"
                onUploaded={(asset) =>
                  setItemForm((f) => ({
                    ...f,
                    imageUrl: asset.url,
                    imagePublicId: asset.publicId,
                  }))
                }
              />
            </div>
          </div>

          {itemForm.itemType === 'custom_content' && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">Structured Content Blocks</p>
                <button
                  type="button"
                  onClick={() =>
                    setItemForm((f) => ({
                      ...f,
                      structuredBlocks: [
                        ...f.structuredBlocks,
                        {
                          blockType: 'banner_card',
                          title: 'Curated Highlight',
                          body: 'Explore handpicked offers.',
                          ctaText: 'Browse Now',
                          ctaUrl: '/shop',
                        },
                      ],
                    }))
                  }
                  className="text-xs font-bold text-[#16A34A] hover:underline"
                >
                  + Add Block
                </button>
              </div>
              {itemForm.structuredBlocks.map((block, bIdx) => (
                <div key={bIdx} className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-white border border-slate-200">
                  <input
                    type="text"
                    placeholder="Title"
                    value={block.title || ''}
                    onChange={(e) =>
                      setItemForm((f) => ({
                        ...f,
                        structuredBlocks: f.structuredBlocks.map((b, i) =>
                          i === bIdx ? { ...b, title: e.target.value } : b
                        ),
                      }))
                    }
                    className="h-8 px-2 rounded border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="CTA Link (/shop)"
                    value={block.ctaUrl || ''}
                    onChange={(e) =>
                      setItemForm((f) => ({
                        ...f,
                        structuredBlocks: f.structuredBlocks.map((b, i) =>
                          i === bIdx ? { ...b, ctaUrl: e.target.value } : b
                        ),
                      }))
                    }
                    className="h-8 px-2 rounded border border-slate-200 text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Body text"
                    value={block.body || ''}
                    onChange={(e) =>
                      setItemForm((f) => ({
                        ...f,
                        structuredBlocks: f.structuredBlocks.map((b, i) =>
                          i === bIdx ? { ...b, body: e.target.value } : b
                        ),
                      }))
                    }
                    className="col-span-2 h-8 px-2 rounded border border-slate-200 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-5 text-xs font-semibold">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={itemForm.isVisible}
                onChange={(e) => setItemForm((f) => ({ ...f, isVisible: e.target.checked }))}
              />
              <span>Visible on Storefront</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={itemForm.openInNewTab}
                onChange={(e) => setItemForm((f) => ({ ...f, openInNewTab: e.target.checked }))}
              />
              <span>Open in New Tab</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setItemModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={itemSaving}
              className="px-5 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {itemSaving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </Modal>

      <IconPickerModal
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        value={{
          iconType: itemForm.iconType,
          iconName: itemForm.iconName,
          iconSvg: itemForm.iconSvg,
          iconImageUrl: itemForm.iconImageUrl,
          iconImagePublicId: itemForm.iconImagePublicId,
          iconColor: itemForm.iconColor,
          iconBgColor: itemForm.iconBgColor,
        }}
        onApply={(next: IconPickerValue) => setItemForm((f) => ({ ...f, ...next }))}
      />

      <ConfirmDialog
        open={Boolean(deleteItemTarget)}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleConfirmDeleteItem}
        title="Delete Menu Item"
        message={`Delete "${deleteItemTarget?.label || ''}" and any nested child items underneath it?`}
        confirmLabel="Delete Item"
        danger
      />
    </div>
  );
}
