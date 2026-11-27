import { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { requiresVariantSelection } from '../../../shared/wishlistHelpers.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { updateUserState } from '../../features/auth/authSlice.ts';
import {
  addGuestCartItem,
  addToServerCart,
  setCartDrawerOpen,
} from '../../features/cart/cartSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { toggleGuestWishlistItem } from '../../features/wishlist/wishlistSlice.ts';
import { apiRequest, formatBdt } from '../../lib/api.ts';
import type { Product } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface CartRecommendationsCarouselProps {
  products: Product[];
  loading?: boolean;
  onSelectVariantProduct: (product: Product) => void;
  onItemAdded?: () => void;
}

export function CartRecommendationsCarousel({
  products,
  loading = false,
  onSelectVariantProduct,
  onItemAdded,
}: CartRecommendationsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const guestWishlistIds = useAppSelector((s) => s.wishlist.guestIds);
  const [addingId, setAddingId] = useState<string | null>(null);

  const scrollByAmount = (direction: 'prev' | 'next') => {
    if (!trackRef.current) return;
    const width = trackRef.current.clientWidth;
    trackRef.current.scrollBy({
      left: direction === 'next' ? width * 0.75 : -width * 0.75,
      behavior: 'smooth',
    });
  };

  const handleToggleWishlist = async (product: Product) => {
    if (!user) {
      const wasSaved = guestWishlistIds.includes(product._id);
      dispatch(toggleGuestWishlistItem(product._id));
      dispatch(
        pushToast({
          variant: 'success',
          message: wasSaved ? 'Removed from your wishlist.' : 'Saved to your wishlist.',
        })
      );
      return;
    }
    try {
      const res = await apiRequest<{ added: boolean; wishlist: string[] }>(
        '/api/users/wishlist/toggle',
        {
          method: 'POST',
          body: JSON.stringify({ productId: product._id }),
        }
      );
      dispatch(updateUserState({ ...user, wishlist: res.wishlist }));
      dispatch(
        pushToast({
          variant: 'success',
          message: res.added ? 'Saved to your wishlist.' : 'Removed from your wishlist.',
        })
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to update wishlist.',
        })
      );
    }
  };

  const handleAddProduct = async (product: Product) => {
    if (product.availableStock <= 0 && !product.allowBackorders) {
      dispatch(pushToast({ variant: 'warning', message: 'This item is currently out of stock.' }));
      return;
    }

    if (requiresVariantSelection(product)) {
      onSelectVariantProduct(product);
      return;
    }

    setAddingId(product._id);
    try {
      if (user) {
        await dispatch(
          addToServerCart({
            productId: product._id,
            variantId: null,
            quantity: 1,
          })
        ).unwrap();
      } else {
        dispatch(
          addGuestCartItem({
            productId: product._id,
            variantId: null,
            slug: product.slug,
            sku: product.sku,
            name: product.name,
            variantTitle: null,
            selectedOptions: {},
            imageUrl: product.images?.[0]?.url || '',
            quantity: 1,
            unitPrice: product.effectivePrice,
            originalPrice: product.originalPrice,
            availableStock: product.availableStock,
            lowStockThreshold: product.lowStockThreshold,
            allowBackorders: product.allowBackorders,
            maxOrderQuantity: product.maxOrderQuantity,
            ratingAverage: product.ratingAverage,
            ratingCount: product.ratingCount,
            categoryId: product.categoryId?._id,
            codEligible: product.codEligible,
          })
        );
      }

      dispatch(pushToast({ variant: 'success', message: `${product.name} added to your cart.` }));
      dispatch(setCartDrawerOpen(true));
      onItemAdded?.();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to add item to cart.',
        })
      );
    } finally {
      setAddingId(null);
    }
  };

  if (!loading && (!products || products.length === 0)) {
    return null;
  }

  return (
    <section aria-label="You May Also Like" className="space-y-5 pt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Star className="w-5 h-5 fill-[#22C55E] text-[#22C55E]" />
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">You May Also Like</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByAmount('prev')}
              aria-label="Previous recommendations"
              className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('next')}
              aria-label="Next recommendations"
              className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#16A34A] hover:text-[#15803D] whitespace-nowrap"
          >
            <span>View More</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory"
        >
          {products.map((product) => {
            const isWishlisted = user
              ? Boolean(user.wishlist?.includes(product._id))
              : guestWishlistIds.includes(product._id);
            const hasVariants = requiresVariantSelection(product);
            const outOfStock = product.availableStock <= 0 && !product.allowBackorders;
            const isAdding = addingId === product._id;

            return (
              <article
                key={product._id}
                className="w-[47%] sm:w-[31.5%] md:w-[23.5%] lg:w-[calc(20%-12.8px)] min-w-[185px] shrink-0 snap-start bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div>
                  <div className="relative aspect-square rounded-xl bg-slate-50 overflow-hidden mb-3">
                    <Link to={`/product/${product.slug}`} className="block w-full h-full">
                      <SafeImage
                        src={product.images?.[0]?.url}
                        alt={product.name}
                        fallbackLabel={product.name}
                        className="w-full h-full object-contain p-3 transition-transform duration-300 hover:scale-105"
                      />
                    </Link>

                    {product.discountPercent > 0 && (
                      <span
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[11px] font-bold text-white tabular-nums ${
                          product.isFlashSaleActive ? 'bg-red-600' : 'bg-[#16A34A]'
                        }`}
                      >
                        -{product.discountPercent}%
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleToggleWishlist(product)}
                      aria-label={
                        isWishlisted
                          ? `Remove ${product.name} from wishlist`
                          : `Save ${product.name} to wishlist`
                      }
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-500 hover:border-red-200 shadow-2xs transition-colors"
                    >
                      <Heart
                        className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`}
                      />
                    </button>
                  </div>

                  <Link
                    to={`/product/${product.slug}`}
                    className="block text-sm font-bold text-slate-900 hover:text-[#16A34A] line-clamp-2 min-h-[2.5rem] leading-snug"
                  >
                    {product.name}
                  </Link>

                  <div className="mt-1.5 min-h-[1.25rem] flex items-center gap-1 text-xs">
                    {product.ratingCount > 0 ? (
                      <>
                        <div className="flex items-center gap-0.5 text-amber-400" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Star
                              key={starIdx}
                              className={`w-3 h-3 ${
                                starIdx <= Math.round(product.ratingAverage)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-slate-200 text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-bold text-slate-700 tabular-nums">
                          {product.ratingAverage.toFixed(1)}
                        </span>
                        <span className="text-slate-400 tabular-nums">({product.ratingCount})</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400 truncate">
                        {product.brandId?.name || product.categoryId?.name || 'Verified Authentic'}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-[#16A34A] tabular-nums">
                      {formatBdt(product.effectivePrice)}
                    </span>
                    {product.originalPrice && product.originalPrice > product.effectivePrice && (
                      <span className="text-xs text-slate-400 line-through tabular-nums">
                        {formatBdt(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={outOfStock || isAdding}
                  onClick={() => void handleAddProduct(product)}
                  className="mt-3 w-full py-2.5 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>
                    {outOfStock
                      ? 'Out of Stock'
                      : isAdding
                      ? 'Adding...'
                      : hasVariants
                      ? 'Select Option'
                      : 'Add to Cart'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
