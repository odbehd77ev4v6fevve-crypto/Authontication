import { ArrowLeft, Minus, Plus, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getEffectiveCartItemMaxQty } from '../../../shared/cartHelpers.ts';
import { computeProductStockState } from '../../../shared/productDetailHelpers.ts';
import { formatBdt } from '../../lib/api.ts';
import type { CartItem } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface CartItemsSectionProps {
  items: CartItem[];
  updatingItemKey: string | null;
  clearing: boolean;
  onUpdateQty: (productId: string, variantId: string | null, nextQty: number) => void;
  onRemoveItem: (productId: string, variantId: string | null) => void;
  onRequestClearCart: () => void;
}

export function CartItemsSection({
  items,
  updatingItemKey,
  clearing,
  onUpdateQty,
  onRemoveItem,
  onRequestClearCart,
}: CartItemsSectionProps) {
  const itemCountLabel = items.length === 1 ? '1 Item' : `${items.length} Items`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShoppingCart className="w-5 h-5 text-[#16A34A]" />
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            Your Cart{' '}
            <span className="font-medium text-slate-500 text-sm sm:text-base">
              ({itemCountLabel})
            </span>
          </h2>
        </div>

        <button
          type="button"
          disabled={clearing || items.length === 0}
          onClick={onRequestClearCart}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 disabled:opacity-45 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50/70"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{clearing ? 'Clearing...' : 'Clear Cart'}</span>
        </button>
      </div>

      {/* Item Rows */}
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const itemKey = `${item.productId}-${item.variantId || 'base'}`;
          const isUpdating = updatingItemKey === itemKey || clearing;
          const stockState = computeProductStockState({
            availableStock: item.availableStock,
            lowStockThreshold: item.lowStockThreshold,
            allowBackorders: item.allowBackorders,
          });
          const effectiveCap = getEffectiveCartItemMaxQty({
            availableStock: item.availableStock,
            maxOrderQuantity: item.maxOrderQuantity,
            allowBackorders: item.allowBackorders,
          });
          const optionEntries = Object.entries(item.selectedOptions || {}).filter(
            ([k, v]) => k && v
          );
          const ratingCount = Number(item.ratingCount || 0);
          const ratingAverage = Number(item.ratingAverage || 0);
          const lineTotal = item.unitPrice * item.quantity;

          const statusDotClass =
            stockState.status === 'in_stock'
              ? 'bg-[#16A34A]'
              : stockState.status === 'limited_stock'
              ? 'bg-amber-500'
              : stockState.status === 'pre_order'
              ? 'bg-blue-500'
              : 'bg-red-500';
          const statusTextClass =
            stockState.status === 'in_stock'
              ? 'text-[#16A34A]'
              : stockState.status === 'limited_stock'
              ? 'text-amber-700'
              : stockState.status === 'pre_order'
              ? 'text-blue-700'
              : 'text-red-600';

          return (
            <div
              key={itemKey}
              className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5"
            >
              {/* Thumbnail + Info */}
              <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                <Link
                  to={`/product/${item.slug}`}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-50 border border-slate-100 shrink-0 overflow-hidden block"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    fallbackLabel={item.name}
                    className="w-full h-full object-contain p-2"
                  />
                </Link>

                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    to={`/product/${item.slug}`}
                    className="text-sm sm:text-base font-bold text-slate-900 hover:text-[#16A34A] line-clamp-2 leading-snug block"
                  >
                    {item.name}
                  </Link>

                  {/* Variant Options */}
                  {optionEntries.length > 0 ? (
                    <p className="text-xs text-slate-500">
                      {optionEntries.map(([k, v], idx) => (
                        <span key={k}>
                          {idx > 0 && ' · '}
                          <span className="font-medium text-slate-600">{k}:</span> {v}
                        </span>
                      ))}
                    </p>
                  ) : item.variantTitle ? (
                    <p className="text-xs text-slate-500">{item.variantTitle}</p>
                  ) : null}

                  {/* Truthful Rating Row */}
                  <div className="flex items-center gap-1.5 text-xs pt-0.5">
                    {ratingCount > 0 ? (
                      <>
                        <div className="flex items-center gap-0.5 text-amber-400" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Star
                              key={starIdx}
                              className={`w-3.5 h-3.5 ${
                                starIdx <= Math.round(ratingAverage)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-slate-200 text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {ratingAverage.toFixed(1)}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400">No reviews yet</span>
                    )}
                  </div>

                  {/* Stock Status */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusTextClass}`}>
                      <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
                      <span>{stockState.label}</span>
                    </span>
                    {item.staleWarning && (
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        {item.staleWarning}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Price, Qty Stepper, Line Subtotal, Remove */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                {/* Unit Price */}
                <div className="text-left sm:text-right min-w-[76px]">
                  <p className="text-sm sm:text-base font-extrabold text-[#16A34A] tabular-nums">
                    {formatBdt(item.unitPrice)}
                  </p>
                  {item.originalPrice && item.originalPrice > item.unitPrice && (
                    <p className="text-xs text-slate-400 line-through tabular-nums">
                      {formatBdt(item.originalPrice)}
                    </p>
                  )}
                </div>

                {/* Quantity Stepper */}
                <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <button
                    type="button"
                    aria-label={`Decrease quantity for ${item.name}`}
                    disabled={isUpdating || item.quantity <= 1}
                    onClick={() => onUpdateQty(item.productId, item.variantId, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-35 rounded-l-xl transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span
                    className="w-8 text-center text-xs sm:text-sm font-bold text-slate-900 tabular-nums"
                    aria-label={`Quantity for ${item.name}`}
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase quantity for ${item.name}`}
                    disabled={isUpdating || item.quantity >= effectiveCap}
                    onClick={() => onUpdateQty(item.productId, item.variantId, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-35 rounded-r-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Subtotal */}
                <div className="text-right min-w-[84px] hidden md:block">
                  <p className="text-base font-extrabold text-[#16A34A] tabular-nums">
                    {formatBdt(lineTotal)}
                  </p>
                </div>

                {/* Remove Item */}
                <button
                  type="button"
                  disabled={isUpdating}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemoveItem(item.productId, item.variantId)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Footer Continue Shopping */}
      <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/40">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#16A34A] hover:text-[#16A34A] text-slate-800 text-xs sm:text-sm font-semibold transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>
      </div>
    </div>
  );
}
