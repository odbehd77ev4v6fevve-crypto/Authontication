import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BANNER_POSITION_OPTIONS } from '../../../../shared/bannerHelpers.ts';
import type { DynamicBannerRecord } from '../../../types/domain.ts';
import { SafeImage } from '../../ui/SafeImage.tsx';

interface SavedBannersPanelProps {
  banners: DynamicBannerRecord[];
  loading: boolean;
  editingBannerId: string | null;
  onEdit: (banner: DynamicBannerRecord) => void;
  onPreview: (banner: DynamicBannerRecord) => void;
  onToggleActive: (banner: DynamicBannerRecord) => void;
  onDuplicate: (banner: DynamicBannerRecord) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onDelete: (banner: DynamicBannerRecord) => void;
}

export function SavedBannersPanel({
  banners,
  loading,
  editingBannerId,
  onEdit,
  onPreview,
  onToggleActive,
  onDuplicate,
  onMove,
  onDelete,
}: SavedBannersPanelProps) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'draft'>('all');

  const positionLabelMap = useMemo(
    () => new Map(BANNER_POSITION_OPTIONS.map((p) => [p.value, p.label])),
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banners.filter((b) => {
      if (positionFilter !== 'all' && b.position !== positionFilter) return false;
      if (statusFilter === 'active' && (!b.isActive || b.status !== 'published')) return false;
      if (statusFilter === 'inactive' && b.isActive) return false;
      if (statusFilter === 'draft' && b.status !== 'draft') return false;
      if (q) {
        const matches =
          b.name.toLowerCase().includes(q) ||
          b.mainHeading.toLowerCase().includes(q) ||
          (positionLabelMap.get(b.position as never) || b.position).toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [banners, search, positionFilter, statusFilter, positionLabelMap]);

  return (
    <section
      aria-label="Saved Storefront Banners"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Saved Banners &amp; Placement Queue
          </h2>
          <p className="text-xs text-slate-500">
            Manage order, scheduling, active status, and click any banner to load it into the live editor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search banners..."
              aria-label="Search saved banners"
              className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-600"
            />
          </div>

          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            aria-label="Filter by placement position"
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="all">All Positions</option>
            {BANNER_POSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by banner status"
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active &amp; Published</option>
            <option value="inactive">Disabled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center space-y-1.5">
          <p className="text-sm font-bold text-slate-800">No banners found</p>
          <p className="text-xs text-slate-500">
            Design your campaign in the Banner Creator above and click Save Banner to publish it to the storefront.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500">
                <th className="py-2.5 pr-3">Banner</th>
                <th className="py-2.5 px-3">Placement</th>
                <th className="py-2.5 px-3 text-right">Order</th>
                <th className="py-2.5 px-3 text-right">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((item) => {
                const realIdx = banners.findIndex((b) => b._id === item._id);
                const isEditing = editingBannerId === item._id;
                const posLabel = positionLabelMap.get(item.position as never) || item.position;
                return (
                  <tr
                    key={item._id}
                    className={`transition-colors ${
                      isEditing ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-16 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center"
                          style={{
                            background:
                              item.backgroundType === 'solid'
                                ? item.solidColor
                                : `linear-gradient(${item.gradientDirection || '135deg'}, ${item.gradientStart}, ${item.gradientEnd})`,
                          }}
                        >
                          {item.desktopImageUrl ? (
                            <SafeImage
                              src={item.desktopImageUrl}
                              alt={item.altText || item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-white px-1 truncate">
                              {item.aspectRatio}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[220px]">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                            {item.mainHeading} · {item.aspectRatio}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                      {posLabel}
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.displayOrder}
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.priority}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.isActive}
                        aria-label={`Toggle active status for ${item.name}`}
                        onClick={() => onToggleActive(item)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"
                      >
                        <span
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                            item.isActive ? 'bg-[#16A34A] justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                        </span>
                        <span>
                          {item.status === 'draft'
                            ? 'Draft'
                            : item.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </button>
                    </td>

                    <td className="py-3 pl-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={realIdx <= 0}
                          onClick={() => onMove(realIdx, -1)}
                          aria-label={`Move ${item.name} up`}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={realIdx === -1 || realIdx >= banners.length - 1}
                          onClick={() => onMove(realIdx, 1)}
                          aria-label={`Move ${item.name} down`}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPreview(item)}
                          aria-label={`Preview ${item.name}`}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          aria-label={`Edit ${item.name}`}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicate(item)}
                          aria-label={`Duplicate ${item.name}`}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          aria-label={`Delete ${item.name}`}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
