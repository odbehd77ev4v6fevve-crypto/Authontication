import { useEffect, useRef, useState } from 'react';
import { Package, Search, ShoppingBag, Tag, Ticket, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, formatBdt } from '../../lib/api.ts';

interface GlobalSearchResult {
  products: Array<{ _id: string; name: string; sku: string; slug: string; basePrice: number }>;
  categories: Array<{ _id: string; name: string; slug: string }>;
  orders: Array<{ _id: string; orderNumber: string; customerName: string; totalAmount: number; orderStatus: string }>;
  customers: Array<{ _id: string; name: string; email: string; phone?: string }>;
  coupons: Array<{ _id: string; code: string; type: string; value: number }>;
}

export function GlobalSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState<GlobalSearchResult>({
    products: [],
    categories: [],
    orders: [],
    customers: [],
    coupons: [],
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setErrorMsg('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ products: [], categories: [], orders: [], customers: [], coupons: [] });
      setErrorMsg('');
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      setErrorMsg('');
      apiRequest<GlobalSearchResult>(`/api/support/admin/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => setResults(res))
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Search unavailable.');
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const totalMatches =
    results.products.length +
    results.orders.length +
    results.customers.length +
    results.categories.length +
    results.coupons.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-start justify-center p-4 sm:pt-20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin Global Search"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, SKUs, orders (#NVR), customers, categories, or coupons..."
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-3 space-y-4">
          {!query.trim() ? (
            <div className="py-10 text-center text-xs text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">Instant Admin Resource Search</p>
              <p>Type a product name, SKU, order number, customer email/phone, or coupon code.</p>
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Searching database...</div>
          ) : errorMsg ? (
            <div className="py-8 text-center text-xs text-red-600">{errorMsg}</div>
          ) : totalMatches === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {results.orders.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Orders
                  </p>
                  {results.orders.map((o) => (
                    <button
                      key={o._id}
                      type="button"
                      onClick={() => go('/admin/orders')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left text-xs"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-mono">{o.orderNumber}</span> · {o.customerName}
                      </span>
                      <span className="font-mono text-slate-600">
                        {formatBdt(o.totalAmount)} ({o.orderStatus})
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.products.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Products
                  </p>
                  {results.products.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => go('/admin/products')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left text-xs"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        <span>{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{p.sku}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">
                        {formatBdt(p.basePrice)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.customers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Customers
                  </p>
                  {results.customers.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => go('/admin/customers')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left text-xs"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>{c.name}</span>
                      </span>
                      <span className="text-slate-500">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.categories.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Categories
                  </p>
                  {results.categories.map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => go('/admin/taxonomy')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left text-xs"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span>{cat.name}</span>
                      </span>
                      <span className="font-mono text-slate-400">/{cat.slug}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.coupons.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Coupons
                  </p>
                  {results.coupons.map((cp) => (
                    <button
                      key={cp._id}
                      type="button"
                      onClick={() => go('/admin/marketing/coupons')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left text-xs"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-mono">{cp.code}</span>
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {cp.type === 'percentage' ? `${cp.value}%` : formatBdt(cp.value)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
