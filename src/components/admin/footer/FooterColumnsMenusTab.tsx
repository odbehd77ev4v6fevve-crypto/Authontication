import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  FOOTER_LINK_TYPES,
  FOOTER_VISIBILITIES,
  moveArrayItem,
  type FooterColumnConfig,
  type FooterMenuItemConfig,
  type FooterSubMenuItemConfig,
} from '../../../../shared/footerHelpers.ts';
import type { FooterAdminStatePayload } from '../../../types/domain.ts';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { Modal } from '../../ui/Modal.tsx';
import { NavIconRenderer } from '../../navigation/NavIconRenderer.tsx';
import { IconPickerModal, type IconPickerValue } from '../navigation/IconPickerModal.tsx';

interface FooterColumnsMenusTabProps {
  mode: 'columns' | 'menus';
  columns: FooterColumnConfig[];
  resources: FooterAdminStatePayload['resources'];
  onChangeColumns: (nextColumns: FooterColumnConfig[]) => void;
  onColumnApiAdd?: (col: Omit<FooterColumnConfig, 'id'>) => Promise<void>;
  onColumnApiDuplicate?: (columnId: string) => Promise<void>;
  onColumnApiDelete?: (columnId: string) => Promise<void>;
  onColumnsApiReorder?: (orderedIds: string[]) => Promise<void>;
}

const DEFAULT_INTERNAL_ROUTES = [
  { label: 'Homepage', url: '/' },
  { label: 'Shop All Products', url: '/shop' },
  { label: 'Hot Deals', url: '/deals' },
  { label: 'Blog & Guides', url: '/blog' },
  { label: 'FAQ', url: '/faq' },
  { label: 'Contact Us', url: '/contact' },
  { label: 'Track Order', url: '/track-order' },
  { label: 'Shopping Cart', url: '/cart' },
  { label: 'My Account', url: '/account' },
  { label: 'My Orders', url: '/account/orders' },
  { label: 'Wishlist', url: '/account/wishlist' },
  { label: 'Saved Addresses', url: '/account/addresses' },
  { label: 'About Us', url: '/policies/about' },
  { label: 'Return Policy', url: '/policies/return' },
  { label: 'Shipping Info', url: '/policies/shipping' },
  { label: 'Privacy Policy', url: '/policies/privacy' },
  { label: 'Terms & Conditions', url: '/policies/terms' },
];

function createEmptyColumn(order: number): FooterColumnConfig {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'New Footer Column',
    iconType: 'none',
    iconName: 'LayoutGrid',
    iconSvg: '',
    iconImageUrl: '',
    iconColor: '#4ADE80',
    description: '',
    isVisible: true,
    isActive: true,
    displayOrder: order,
    width: '1fr',
    customWidthPx: 220,
    alignment: 'left',
    customStyleCss: '',
    items: [],
  };
}

function createEmptyItem(order: number): FooterMenuItemConfig {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: 'New Link',
    iconType: 'none',
    iconName: 'ChevronRight',
    iconSvg: '',
    iconImageUrl: '',
    linkType: 'internal_route',
    targetSlug: '',
    url: '/shop',
    target: '_self',
    openInNewTab: false,
    displayOrder: order,
    isActive: true,
    visibility: 'all',
    description: '',
    badgeText: '',
    children: [],
  };
}

export function FooterColumnsMenusTab({
  mode,
  columns,
  resources,
  onChangeColumns,
}: FooterColumnsMenusTabProps) {
  const sortedCols = [...columns].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const [selectedColId, setSelectedColId] = useState<string>(sortedCols[0]?.id || '');

  // Column modal state
  const [editingCol, setEditingCol] = useState<FooterColumnConfig | null>(null);
  const [isNewCol, setIsNewCol] = useState(false);
  const [deletingCol, setDeletingCol] = useState<FooterColumnConfig | null>(null);

  // Menu item modal state
  const [editingItem, setEditingItem] = useState<FooterMenuItemConfig | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<FooterMenuItemConfig | null>(null);

  // Icon picker state
  const [iconTarget, setIconTarget] = useState<'column' | 'item' | null>(null);

  // Drag states
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);

  const activeCol = sortedCols.find((c) => c.id === selectedColId) || sortedCols[0] || null;

  const commitColumns = (next: FooterColumnConfig[]) => {
    const normalized = next.map((c, idx) => ({ ...c, displayOrder: idx }));
    onChangeColumns(normalized);
  };

  const handleSaveColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol || !editingCol.title.trim()) return;
    if (isNewCol) {
      if (sortedCols.length >= 8) return;
      commitColumns([...sortedCols, editingCol]);
      setSelectedColId(editingCol.id);
    } else {
      commitColumns(sortedCols.map((c) => (c.id === editingCol.id ? editingCol : c)));
    }
    setEditingCol(null);
  };

  const handleDuplicateColumn = (col: FooterColumnConfig) => {
    if (sortedCols.length >= 8) return;
    const newId = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const dup: FooterColumnConfig = {
      ...col,
      id: newId,
      title: `${col.title} (Copy)`,
      displayOrder: sortedCols.length,
      items: col.items.map((it, idx) => ({
        ...it,
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        children: (it.children || []).map((s, sIdx) => ({
          ...s,
          id: `sub-${Date.now()}-${idx}-${sIdx}`,
        })),
      })),
    };
    commitColumns([...sortedCols, dup]);
    setSelectedColId(newId);
  };

  const handleMoveCol = (idx: number, delta: number) => {
    const moved = moveArrayItem(sortedCols, idx, idx + delta);
    commitColumns(moved);
  };

  const handleDropCol = (targetId: string) => {
    if (!dragColId || dragColId === targetId) return;
    const fromIdx = sortedCols.findIndex((c) => c.id === dragColId);
    const toIdx = sortedCols.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    commitColumns(moveArrayItem(sortedCols, fromIdx, toIdx));
    setDragColId(null);
  };

  const updateActiveColItems = (nextItems: FooterMenuItemConfig[]) => {
    if (!activeCol) return;
    const reindexed = nextItems.map((it, idx) => ({ ...it, displayOrder: idx }));
    commitColumns(sortedCols.map((c) => (c.id === activeCol.id ? { ...c, items: reindexed } : c)));
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !activeCol || !editingItem.label.trim() || !editingItem.url.trim()) return;
    const finalItem: FooterMenuItemConfig = {
      ...editingItem,
      target: editingItem.openInNewTab ? '_blank' : '_self',
    };
    const currentItems = activeCol.items || [];
    if (isNewItem) {
      updateActiveColItems([...currentItems, finalItem]);
    } else {
      updateActiveColItems(currentItems.map((it) => (it.id === finalItem.id ? finalItem : it)));
    }
    setEditingItem(null);
  };

  const handleMoveItem = (idx: number, delta: number) => {
    if (!activeCol) return;
    updateActiveColItems(moveArrayItem(activeCol.items || [], idx, idx + delta));
  };

  const handleDropItem = (targetItemId: string) => {
    if (!activeCol || !dragItemId || dragItemId === targetItemId) return;
    const list = activeCol.items || [];
    const fromIdx = list.findIndex((i) => i.id === dragItemId);
    const toIdx = list.findIndex((i) => i.id === targetItemId);
    if (fromIdx === -1 || toIdx === -1) return;
    updateActiveColItems(moveArrayItem(list, fromIdx, toIdx));
    setDragItemId(null);
  };

  const applyResourceChoice = (slugOrUrl: string, labelGuess?: string) => {
    if (!editingItem) return;
    let url = slugOrUrl;
    if (editingItem.linkType === 'static_page') url = `/page/${slugOrUrl}`;
    else if (editingItem.linkType === 'category') url = `/category/${slugOrUrl}`;
    else if (editingItem.linkType === 'blog') url = `/blog/${slugOrUrl}`;
    setEditingItem((prev) =>
      prev
        ? {
            ...prev,
            targetSlug: slugOrUrl,
            url,
            label: !prev.label || prev.label === 'New Link' ? labelGuess || prev.label : prev.label,
          }
        : prev
    );
  };

  const addSubItem = () => {
    if (!editingItem) return;
    const nextSub: FooterSubMenuItemConfig = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: 'Sub Link',
      url: '/shop',
      openInNewTab: false,
      displayOrder: (editingItem.children || []).length,
      isActive: true,
    };
    setEditingItem({
      ...editingItem,
      children: [...(editingItem.children || []), nextSub],
    });
  };

  const currentIconPickerVal: IconPickerValue =
    iconTarget === 'column' && editingCol
      ? {
          iconType: editingCol.iconType,
          iconName: editingCol.iconName,
          iconSvg: editingCol.iconSvg || '',
          iconImageUrl: editingCol.iconImageUrl || '',
          iconImagePublicId: '',
          iconColor: editingCol.iconColor || '#4ADE80',
          iconBgColor: '#DCFCE7',
        }
      : {
          iconType: editingItem?.iconType || 'none',
          iconName: editingItem?.iconName || 'ChevronRight',
          iconSvg: editingItem?.iconSvg || '',
          iconImageUrl: editingItem?.iconImageUrl || '',
          iconImagePublicId: '',
          iconColor: '#16A34A',
          iconBgColor: '#DCFCE7',
        };

  return (
    <div className="space-y-6">
      {/* Column Management Section */}
      {mode === 'columns' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Footer Columns ({sortedCols.length}/8)
              </h2>
              <p className="text-xs text-slate-500">
                Drag and drop columns or use arrows to reorder. Each column holds its own menu items.
              </p>
            </div>
            <button
              type="button"
              disabled={sortedCols.length >= 8}
              onClick={() => {
                setIsNewCol(true);
                setEditingCol(createEmptyColumn(sortedCols.length));
              }}
              data-testid="add-footer-column-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Column</span>
            </button>
          </div>

          {sortedCols.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No footer columns yet. Click &ldquo;Add Column&rdquo; to create your first link column.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedCols.map((col, idx) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() => setDragColId(col.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropCol(col.id)}
                  data-testid={`footer-column-row-${col.id}`}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
                    selectedColId === col.id
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {col.iconType !== 'none' && (
                          <NavIconRenderer
                            iconType={col.iconType}
                            iconName={col.iconName}
                            iconSvg={col.iconSvg}
                            iconImageUrl={col.iconImageUrl}
                            iconColor={col.iconColor}
                            sizePx={15}
                          />
                        )}
                        <span className="text-sm font-bold text-slate-900">{col.title}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {col.items.length} links
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold capitalize">
                          {col.alignment} · {col.width}
                        </span>
                        {(!col.isActive || !col.isVisible) && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Hidden
                          </span>
                        )}
                      </div>
                      {col.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{col.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        commitColumns(
                          sortedCols.map((c) =>
                            c.id === col.id ? { ...c, isVisible: !c.isVisible } : c
                          )
                        )
                      }
                      title={col.isVisible ? 'Hide column' : 'Show column'}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      {col.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCol(idx, -1)}
                      title="Move up"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedCols.length - 1}
                      onClick={() => handleMoveCol(idx, 1)}
                      title="Move down"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={sortedCols.length >= 8}
                      onClick={() => handleDuplicateColumn(col)}
                      title="Duplicate column"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewCol(false);
                        setEditingCol({ ...col });
                      }}
                      title="Edit column"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCol(col)}
                      title="Delete column"
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Column Menu Items Manager */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {mode === 'menus' ? 'Footer Menu Items' : 'Selected Column Links'}
              </h2>
              <p className="text-xs text-slate-500">
                Select a column to manage, sort, or add internal, static page, category, blog, or external links.
              </p>
            </div>
            <select
              value={activeCol?.id || ''}
              onChange={(e) => setSelectedColId(e.target.value)}
              aria-label="Select footer column"
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
            >
              {sortedCols.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.items.length})
                </option>
              ))}
            </select>
          </div>

          {activeCol && (
            <button
              type="button"
              disabled={(activeCol.items?.length || 0) >= 20}
              onClick={() => {
                setIsNewItem(true);
                setEditingItem(createEmptyItem(activeCol.items?.length || 0));
              }}
              data-testid="add-footer-menu-item-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Menu Item</span>
            </button>
          )}
        </div>

        {!activeCol ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Create a footer column first before adding menu items.
          </p>
        ) : activeCol.items.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
            No menu links in <strong>{activeCol.title}</strong> yet.
          </div>
        ) : (
          <div className="space-y-2">
            {[...activeCol.items]
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              .map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragItemId(item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropItem(item.id)}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                    {item.iconType !== 'none' && (
                      <NavIconRenderer
                        iconType={item.iconType}
                        iconName={item.iconName}
                        iconSvg={item.iconSvg}
                        iconImageUrl={item.iconImageUrl}
                        sizePx={14}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                        <span className="text-[11px] font-mono text-slate-500 truncate max-w-[220px]">
                          {item.url}
                        </span>
                        {item.badgeText && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {item.badgeText}
                          </span>
                        )}
                        {item.visibility !== 'all' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">
                            {item.visibility}
                          </span>
                        )}
                        {!item.isActive && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Inactive
                          </span>
                        )}
                      </div>
                      {item.children && item.children.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          +{item.children.length} nested sub-link(s)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveItem(idx, -1)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === activeCol.items.length - 1}
                      onClick={() => handleMoveItem(idx, 1)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewItem(false);
                        setEditingItem({ ...item, children: [...(item.children || [])] });
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Add/Edit Column Modal */}
      <Modal
        open={Boolean(editingCol)}
        onClose={() => setEditingCol(null)}
        title={isNewCol ? 'Add Footer Column' : 'Edit Footer Column'}
        maxWidthClass="max-w-lg"
      >
        {editingCol && (
          <form onSubmit={handleSaveColumn} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Column Title</label>
                <input
                  type="text"
                  required
                  value={editingCol.title}
                  onChange={(e) => setEditingCol({ ...editingCol, title: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Description
                </label>
                <input
                  type="text"
                  value={editingCol.description || ''}
                  onChange={(e) => setEditingCol({ ...editingCol, description: e.target.value })}
                  placeholder="Short helper text under column heading"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alignment</label>
                <select
                  value={editingCol.alignment}
                  onChange={(e) =>
                    setEditingCol({
                      ...editingCol,
                      alignment: e.target.value as FooterColumnConfig['alignment'],
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Column Width</label>
                <select
                  value={editingCol.width}
                  onChange={(e) =>
                    setEditingCol({
                      ...editingCol,
                      width: e.target.value as FooterColumnConfig['width'],
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="auto">Auto</option>
                  <option value="1fr">Standard (1fr)</option>
                  <option value="1.25fr">Medium (1.25fr)</option>
                  <option value="1.5fr">Wide (1.5fr)</option>
                  <option value="2fr">Extra Wide (2fr)</option>
                  <option value="custom">Custom Width (px)</option>
                </select>
              </div>
              {editingCol.width === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Width (px)
                  </label>
                  <input
                    type="number"
                    min={140}
                    max={520}
                    value={editingCol.customWidthPx}
                    onChange={(e) =>
                      setEditingCol({
                        ...editingCol,
                        customWidthPx: Number(e.target.value) || 220,
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              )}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setIconTarget('column')}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>
                    {editingCol.iconType === 'none'
                      ? 'Add Column Icon'
                      : `Icon: ${editingCol.iconType}`}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-5 text-xs font-semibold text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingCol.isVisible}
                  onChange={(e) => setEditingCol({ ...editingCol, isVisible: e.target.checked })}
                />
                <span>Visible</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingCol.isActive}
                  onChange={(e) => setEditingCol({ ...editingCol, isActive: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCol(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isNewCol ? 'Create Column' : 'Update Column'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add/Edit Menu Item Modal */}
      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={isNewItem ? 'Add Footer Menu Item' : 'Edit Footer Menu Item'}
        maxWidthClass="max-w-xl"
      >
        {editingItem && (
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Menu Label</label>
                <input
                  type="text"
                  required
                  value={editingItem.label}
                  onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Link Type</label>
                <select
                  value={editingItem.linkType}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      linkType: e.target.value as FooterMenuItemConfig['linkType'],
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  {FOOTER_LINK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Resource Picker based on linkType */}
              {editingItem.linkType === 'internal_route' && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Quick Pick Storefront Route
                  </label>
                  <select
                    value={
                      DEFAULT_INTERNAL_ROUTES.some((r) => r.url === editingItem.url)
                        ? editingItem.url
                        : ''
                    }
                    onChange={(e) => {
                      const found = DEFAULT_INTERNAL_ROUTES.find((r) => r.url === e.target.value);
                      if (found) applyResourceChoice(found.url, found.label);
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50"
                  >
                    <option value="">-- Choose a storefront route --</option>
                    {DEFAULT_INTERNAL_ROUTES.map((r) => (
                      <option key={r.url} value={r.url}>
                        {r.label} ({r.url})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingItem.linkType === 'static_page' && resources.pages.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Select Static Page
                  </label>
                  <select
                    value={editingItem.targetSlug || ''}
                    onChange={(e) => {
                      const pg = resources.pages.find((p) => p.slug === e.target.value);
                      if (pg) applyResourceChoice(pg.slug, pg.title);
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50"
                  >
                    <option value="">-- Select static page --</option>
                    {resources.pages.map((p) => (
                      <option key={p._id} value={p.slug}>
                        {p.title} (/page/{p.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingItem.linkType === 'category' && resources.categories.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Select Category
                  </label>
                  <select
                    value={editingItem.targetSlug || ''}
                    onChange={(e) => {
                      const cat = resources.categories.find((c) => c.slug === e.target.value);
                      if (cat) applyResourceChoice(cat.slug, cat.name);
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50"
                  >
                    <option value="">-- Select category --</option>
                    {resources.categories.map((c) => (
                      <option key={c._id} value={c.slug}>
                        {c.name} (/category/{c.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingItem.linkType === 'blog' && resources.blogs.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Select Blog Post
                  </label>
                  <select
                    value={editingItem.targetSlug || ''}
                    onChange={(e) => {
                      const bp = resources.blogs.find((b) => b.slug === e.target.value);
                      if (bp) applyResourceChoice(bp.slug, bp.title);
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50"
                  >
                    <option value="">-- Select blog post --</option>
                    {resources.blogs.map((b) => (
                      <option key={b._id} value={b.slug}>
                        {b.title} (/blog/{b.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination URL
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.url}
                  onChange={(e) => setEditingItem({ ...editingItem, url: e.target.value })}
                  placeholder="/policies/privacy or https://..."
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Visibility</label>
                <select
                  value={editingItem.visibility}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      visibility: e.target.value as FooterMenuItemConfig['visibility'],
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  {FOOTER_VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {v === 'all'
                        ? 'Everyone (All Visitors)'
                        : v === 'guest'
                        ? 'Guests Only'
                        : 'Authenticated Customers'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Badge Text
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={editingItem.badgeText || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, badgeText: e.target.value })}
                  placeholder="New / Hot"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Description
                </label>
                <input
                  type="text"
                  maxLength={180}
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="Optional caption under link"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Optional Sub-items */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Nested Sub-Links ({editingItem.children?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={addSubItem}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Sub-Link</span>
                </button>
              </div>
              {(editingItem.children || []).map((sub, sIdx) => (
                <div key={sub.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={sub.label}
                    onChange={(e) => {
                      const next = [...(editingItem.children || [])];
                      next[sIdx] = { ...sub, label: e.target.value };
                      setEditingItem({ ...editingItem, children: next });
                    }}
                    placeholder="Label"
                    className="col-span-5 h-8 px-2 rounded border border-slate-200 text-xs bg-white"
                  />
                  <input
                    type="text"
                    value={sub.url}
                    onChange={(e) => {
                      const next = [...(editingItem.children || [])];
                      next[sIdx] = { ...sub, url: e.target.value };
                      setEditingItem({ ...editingItem, children: next });
                    }}
                    placeholder="/path"
                    className="col-span-6 h-8 px-2 rounded border border-slate-200 text-xs font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        children: (editingItem.children || []).filter((_, i) => i !== sIdx),
                      })
                    }
                    className="col-span-1 p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editingItem.isActive}
                    onChange={(e) => setEditingItem({ ...editingItem, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editingItem.openInNewTab}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, openInNewTab: e.target.checked })
                    }
                  />
                  <span>Open in New Tab</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setIconTarget('item')}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>{editingItem.iconType === 'none' ? 'Add Icon' : `Icon: ${editingItem.iconType}`}</span>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isNewItem ? 'Add Menu Item' : 'Save Menu Item'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <IconPickerModal
        open={Boolean(iconTarget)}
        onClose={() => setIconTarget(null)}
        value={currentIconPickerVal}
        onApply={(val) => {
          if (iconTarget === 'column' && editingCol) {
            setEditingCol({
              ...editingCol,
              iconType: val.iconType,
              iconName: val.iconName,
              iconSvg: val.iconSvg,
              iconImageUrl: val.iconImageUrl,
              iconColor: val.iconColor,
            });
          } else if (iconTarget === 'item' && editingItem) {
            setEditingItem({
              ...editingItem,
              iconType: val.iconType,
              iconName: val.iconName,
              iconSvg: val.iconSvg,
              iconImageUrl: val.iconImageUrl,
            });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingCol)}
        onClose={() => setDeletingCol(null)}
        onConfirm={() => {
          if (deletingCol) {
            commitColumns(sortedCols.filter((c) => c.id !== deletingCol.id));
            setDeletingCol(null);
          }
        }}
        title="Delete Footer Column"
        message={`Remove "${deletingCol?.title}" and all ${deletingCol?.items.length || 0} menu items inside it?`}
        confirmLabel="Delete Column"
        danger
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => {
          if (deletingItem && activeCol) {
            updateActiveColItems(activeCol.items.filter((i) => i.id !== deletingItem.id));
            setDeletingItem(null);
          }
        }}
        title="Delete Menu Item"
        message={`Delete "${deletingItem?.label}" from ${activeCol?.title}?`}
        confirmLabel="Delete Item"
        danger
      />
    </div>
  );
}
