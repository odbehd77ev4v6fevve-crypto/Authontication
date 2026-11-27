import { useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { apiRequest } from '../../../lib/api.ts';
import type { BannerResolvedProduct, Product } from '../../../types/domain.ts';
import { Modal } from '../../ui/Modal.tsx';
import { SafeImage } from '../../ui/SafeImage.tsx';

interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onConfirm: (ids: string[], products: BannerResolvedProduct[]) => void;
}

export function ProductPickerModal({
  open,
  onClose,
  selectedIds,
  onConfirm,
}: ProductPickerModalProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (open) {
      setDraftIds(selectedIds);
    }
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: '24' });
    if (query.trim()) params.set('q', query.trim());

    apiRequest<{ products: Product[] }>(`/api/catalog/products?${params.toString()}`)
      .then((res) => {
        if (active) setProducts(res.products || []);
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, query]);

  const toggleId = (id: string) => {
    setDraftIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handleSaveSelection = () => {
    const picked = products
      .filter((p) => draftIds.includes(p._id))
      .map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        basePrice: p.basePrice,
        salePrice: p.salePrice,
        flashSalePrice: p.flashSalePrice,
        images: p.images,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
      }));
    onConfirm(draftIds, picked);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Browse & Attach Products to Banner"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search catalog products by name or keyword..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
            {draftIds.length} / 4 selected
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-10 text-center bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-700">No catalog products available</p>
            <p className="text-xs text-slate-500 mt-1">
              Ensure MongoDB is connected and published products exist in your catalog.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {products.map((prod) => {
              const selected = draftIds.includes(prod._id);
              return (
                <button
                  key={prod._id}
                  type="button"
                  onClick={() => toggleId(prod._id)}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'border-[#16A34A] bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SafeImage
                      src={prod.images?.[0]?.url}
                      alt={prod.name}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        ৳{Number(prod.effectivePrice || prod.basePrice).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-[#16A34A] text-white'
                        : 'border border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSelection}
            className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
          >
            Use Selected Products
          </button>
        </div>
      </div>
    </Modal>
  );
}
