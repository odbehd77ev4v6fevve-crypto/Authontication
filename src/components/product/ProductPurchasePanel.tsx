import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Heart,
  Minus,
  Play,
  Plus,
  ShoppingCart,
  Star,
} from 'lucide-react';
import {
  computeDiscountAndSavings,
  computeProductStockState,
  extractVariantAttributeGroups,
  isOptionValueAvailable,
  parseSafeProductVideoUrl,
} from '../../../shared/productDetailHelpers.ts';
import { formatBdt } from '../../lib/api.ts';
import type { Product, ProductVariant } from '../../types/domain.ts';

interface ProductPurchasePanelProps {
  product: Product;
  activeVariants: ProductVariant[];
  activeVariant: ProductVariant | null;
  selectedOptions: Record<string, string>;
  onSelectOption: (key: string, value: string) => void;
  onSelectVariantDirect: (variantId: string) => void;
  availableStock: number;
  quantity: number;
  maxQuantityCap: number;
  onQuantityChange: (nextQty: number) => void;
  currentPrice: number;
  reviewTotal: number;
  averageRating: number;
  verifiedReviewCount: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onOpenVideo: () => void;
  notifyEmail: string;
  onNotifyEmailChange: (email: string) => void;
  onBackInStockSubmit: (e: React.FormEvent) => void;
}

export function ProductPurchasePanel({
  product,
  activeVariants,
  activeVariant,
  selectedOptions,
  onSelectOption,
  onSelectVariantDirect,
  availableStock,
  quantity,
  maxQuantityCap,
  onQuantityChange,
  currentPrice,
  reviewTotal,
  averageRating,
  verifiedReviewCount,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
  onOpenVideo,
  notifyEmail,
  onNotifyEmailChange,
  onBackInStockSubmit,
}: ProductPurchasePanelProps) {
  const stockState = computeProductStockState({
    availableStock,
    lowStockThreshold: activeVariant?.lowStockThreshold ?? product.lowStockThreshold,
    allowBackorders: product.allowBackorders,
  });

  const { discountPercent, savingsAmount } = computeDiscountAndSavings(
    currentPrice,
    product.originalPrice
  );

  const attributeGroups = extractVariantAttributeGroups(activeVariants);
  const videoEmbed = parseSafeProductVideoUrl(product.videoUrl);
  const canPurchase = availableStock > 0 || Boolean(product.allowBackorders);

  const statusToneClass =
    stockState.status === 'in_stock'
      ? 'text-[#15803D]'
      : stockState.status === 'limited_stock'
      ? 'text-amber-700'
      : stockState.status === 'pre_order'
      ? 'text-blue-700'
      : 'text-red-600';

  const statusDotClass =
    stockState.status === 'in_stock'
      ? 'bg-[#16A34A]'
      : stockState.status === 'limited_stock'
      ? 'bg-amber-500'
      : stockState.status === 'pre_order'
      ? 'bg-blue-600'
      : 'bg-red-500';

  return (
    <div className="space-y-4">
      {/* Stock Status + Brand/SKU Meta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${statusToneClass}`}>
          <span className={`w-2 h-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
          <span>{stockState.label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {product.brandId?.name && (
            <span className="font-semibold text-slate-700">{product.brandId.name}</span>
          )}
          <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
            SKU: {activeVariant?.sku || product.sku}
          </span>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 leading-tight tracking-tight">
          {product.name}
        </h1>
        {product.nameBn && (
          <p className="text-sm text-slate-500 mt-1">{product.nameBn}</p>
        )}
      </div>

      {/* Rating & Video Trigger Row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {reviewTotal > 0 ? (
          <a
            href="#reviews"
            className="inline-flex items-center gap-1.5 hover:underline focus:outline-none"
          >
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-bold text-slate-900 tabular-nums">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-slate-500 tabular-nums">
              ({reviewTotal} Review{reviewTotal === 1 ? '' : 's'})
            </span>
          </a>
        ) : (
          <a href="#reviews" className="text-slate-500 hover:text-emerald-700">
            Be the first to review
          </a>
        )}

        {videoEmbed.valid && (
          <>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <button
              type="button"
              onClick={onOpenVideo}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-800 hover:text-[#15803D] transition-colors"
            >
              <span className="w-5 h-5 rounded-md bg-slate-900 text-white inline-flex items-center justify-center">
                <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
              </span>
              <span>Watch Video</span>
            </button>
          </>
        )}
      </div>

      {/* Truthful Verified Purchase Highlight (only shown when real verified reviews exist) */}
      {verifiedReviewCount > 0 && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
          <span className="tabular-nums">
            {verifiedReviewCount} verified buyer review{verifiedReviewCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Price Block */}
      <div className="pt-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl sm:text-[28px] font-extrabold text-[#15803D] tabular-nums tracking-tight leading-none">
            {formatBdt(currentPrice)}
          </span>
          {product.originalPrice && product.originalPrice > currentPrice && (
            <>
              <span className="text-base text-slate-400 line-through tabular-nums">
                {formatBdt(product.originalPrice)}
              </span>
              {discountPercent > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#15803D] text-white text-[11px] font-bold tabular-nums">
                  Save {discountPercent}%
                </span>
              )}
              {savingsAmount > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                  ({formatBdt(savingsAmount)} off)
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Short Description */}
      {product.shortDescription && (
        <p className="text-sm text-slate-600 leading-relaxed">{product.shortDescription}</p>
      )}

      {/* Key Highlights Checklist */}
      {product.features && product.features.length > 0 && (
        <ul className="space-y-1.5 pt-0.5">
          {product.features.slice(0, 6).map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Dynamic Multi-Attribute Variant Selector */}
      {activeVariants.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          {attributeGroups.length > 0 ? (
            attributeGroups.map((group) => (
              <div key={group.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    {group.name}:{' '}
                    <span className="font-semibold text-slate-900">
                      {selectedOptions[group.name] || ''}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.values.map((val) => {
                    const isSelected = selectedOptions[group.name] === val;
                    const availability = isOptionValueAvailable(
                      activeVariants,
                      selectedOptions,
                      group.name,
                      val
                    );
                    const disabled = !availability.exists || (!availability.inStock && !product.allowBackorders);

                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={!availability.exists}
                        onClick={() => onSelectOption(group.name, val)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'border-[#16A34A] bg-emerald-50 text-[#15803D] ring-1 ring-[#16A34A]/30'
                            : disabled
                            ? 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Select Option</p>
              <div className="flex flex-wrap gap-2">
                {activeVariants.map((variant) => {
                  const vAvail = Math.max(0, variant.stockOnHand - variant.reservedStock);
                  const active = variant._id === activeVariant?._id;
                  return (
                    <button
                      key={variant._id}
                      type="button"
                      onClick={() => onSelectVariantDirect(variant._id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#16A34A] bg-emerald-50 text-[#15803D]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      } ${vAvail <= 0 && !product.allowBackorders ? 'opacity-50' : ''}`}
                    >
                      {variant.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quantity & Wishlist Row + Primary CTAs */}
      {canPurchase ? (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Qty:</span>
              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  className="p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-l-lg"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3.5 text-sm font-bold tabular-nums min-w-[2.25rem] text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= maxQuantityCap}
                  onClick={() => onQuantityChange(Math.min(maxQuantityCap, quantity + 1))}
                  className="p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-r-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleWishlist}
              className={`flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg border text-xs font-semibold transition-colors ${
                isWishlisted
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onAddToCart}
              className="w-full py-3 px-5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{stockState.status === 'pre_order' ? 'Pre-order Now' : 'Add to Cart'}</span>
            </button>

            <button
              type="button"
              onClick={onBuyNow}
              className="w-full py-3 px-5 rounded-xl bg-[#0B1A2B] hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <span>Buy Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <form
            onSubmit={onBackInStockSubmit}
            className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5"
          >
            <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Bell className="w-4 h-4" />
              <span>Out of stock — Notify me when restocked</span>
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={notifyEmail}
                onChange={(e) => onNotifyEmailChange(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Notify Me
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={onToggleWishlist}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
            <span>{isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
          </button>
        </div>
      )}

      {/* Authentic Payment Methods Strip */}
      <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold text-slate-600">
        {product.codEligible && (
          <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-emerald-800 whitespace-nowrap">
            Cash on Delivery
          </span>
        )}
        <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[#E2136E] whitespace-nowrap">
          bKash
        </span>
        <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[#F7941D] whitespace-nowrap">
          Nagad
        </span>
        <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[#1A1F71] whitespace-nowrap">
          VISA
        </span>
        <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[#EB001B] whitespace-nowrap">
          Mastercard
        </span>
      </div>
    </div>
  );
}
