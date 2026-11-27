import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { computeCartOrderSummary } from '../../shared/cartHelpers.ts';
import type { ShippingConfig } from '../../shared/pricing.ts';
import { useAppDispatch, useAppSelector } from '../app/hooks.ts';
import { CartHeroBanner } from '../components/cart/CartHeroBanner.tsx';
import { CartItemsSection } from '../components/cart/CartItemsSection.tsx';
import { CartOrderSummary } from '../components/cart/CartOrderSummary.tsx';
import { CartRecommendationsCarousel } from '../components/cart/CartRecommendationsCarousel.tsx';
import { BannerRenderer } from '../components/marketing/BannerRenderer.tsx';
import { PageSlideshow } from '../components/marketing/PageSlideshow.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { SeoHead } from '../components/ui/SeoHead.tsx';
import { ProductQuickViewModal } from '../components/wishlist/ProductQuickViewModal.tsx';
import { openAuthModal } from '../features/auth/authSlice.ts';
import {
  applyServerCoupon,
  clearGuestCart,
  clearServerCart,
  removeServerCoupon,
  updateGuestCartQty,
  updateServerCartQty,
} from '../features/cart/cartSlice.ts';
import { pushToast } from '../features/toast/toastSlice.ts';
import { apiRequest } from '../lib/api.ts';
import type {
  CartHeroBannerConfig,
  HomepageConfig,
  Product,
  StoreSettings,
} from '../types/domain.ts';

interface CartPageProps {
  homepage?: HomepageConfig | null;
  storeSettings?: StoreSettings | null;
}

export function CartPage({ homepage = null, storeSettings = null }: CartPageProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const {
    items,
    subtotal,
    discountAmount,
    appliedCouponCode,
    couponMessage,
    summary: serverSummary,
    loading,
  } = useAppSelector((s) => s.cart);

  const [couponInput, setCouponInput] = useState('');
  const [updatingItemKey, setUpdatingItemKey] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const [cartBanner, setCartBanner] = useState<CartHeroBannerConfig | null>(null);
  const [bannerShipping, setBannerShipping] = useState<ShippingConfig | null>(
    storeSettings?.shipping || null
  );
  const [bannerTaxRate, setBannerTaxRate] = useState<number>(storeSettings?.taxRate ?? 0);
  const [bannerTaxSettings, setBannerTaxSettings] = useState<StoreSettings['taxSettings'] | null>(
    storeSettings?.taxSettings || null
  );
  const [trustPoints, setTrustPoints] = useState(homepage?.trustPoints || []);

  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [hasCartSlideshow, setHasCartSlideshow] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<{
      banner: CartHeroBannerConfig | null;
      trustPoints?: Array<{ title: string; subtitle: string; icon: string }>;
      shipping?: ShippingConfig;
      taxRate?: number;
      taxSettings?: StoreSettings['taxSettings'];
    }>('/api/cms/public/cart-banner')
      .then((res) => {
        if (!active) return;
        setCartBanner(res.banner || null);
        if (res.shipping) setBannerShipping(res.shipping);
        if (typeof res.taxRate === 'number') setBannerTaxRate(res.taxRate);
        if (res.taxSettings) setBannerTaxSettings(res.taxSettings);
        if (Array.isArray(res.trustPoints) && res.trustPoints.length > 0) {
          setTrustPoints(res.trustPoints);
        }
      })
      .catch(() => {
        // Fallback hero design renders gracefully when CMS request is unavailable
      });

    return () => {
      active = false;
    };
  }, []);

  const cartProductIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.productId))).sort(),
    [items]
  );

  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const res = await apiRequest<{ products: Product[] }>('/api/cart/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          excludeIds: cartProductIds,
          limit: 10,
        }),
      });
      setRecommendations(res.products || []);
    } catch {
      setRecommendations([]);
    } finally {
      setRecsLoading(false);
    }
  }, [cartProductIds]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const effectiveShippingConfig = bannerShipping || storeSettings?.shipping || null;
  const effectiveTaxRate =
    typeof bannerTaxRate === 'number' ? bannerTaxRate : storeSettings?.taxRate ?? 0;
  const effectiveTaxSettings = bannerTaxSettings || storeSettings?.taxSettings || null;

  const computedSummary = useMemo(() => {
    if (user && serverSummary) {
      return serverSummary;
    }
    return computeCartOrderSummary({
      subtotal,
      discountAmount,
      shippingConfig: effectiveShippingConfig,
      taxRate: effectiveTaxRate,
      taxSettings: effectiveTaxSettings,
      itemCount: items.length,
    });
  }, [
    user,
    serverSummary,
    subtotal,
    discountAmount,
    effectiveShippingConfig,
    effectiveTaxRate,
    effectiveTaxSettings,
    items.length,
  ]);

  const hasUnavailableItems = useMemo(
    () => items.some((item) => item.availableStock <= 0 && !item.allowBackorders),
    [items]
  );

  const handleQty = async (productId: string, variantId: string | null, qty: number) => {
    const key = `${productId}-${variantId || 'base'}`;
    if (updatingItemKey === key) return;
    setUpdatingItemKey(key);

    try {
      if (user) {
        await dispatch(updateServerCartQty({ productId, variantId, quantity: qty })).unwrap();
      } else {
        dispatch(updateGuestCartQty({ productId, variantId, quantity: qty }));
      }
      if (qty === 0) {
        dispatch(pushToast({ variant: 'info', message: 'Item removed from cart.' }));
      }
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to update cart quantity.',
        })
      );
    } finally {
      setUpdatingItemKey(null);
    }
  };

  const handleConfirmClearCart = async () => {
    setClearing(true);
    try {
      if (user) {
        await dispatch(clearServerCart()).unwrap();
      } else {
        dispatch(clearGuestCart());
      }
      setClearConfirmOpen(false);
      dispatch(pushToast({ variant: 'info', message: 'Shopping cart cleared.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to clear cart.',
        })
      );
    } finally {
      setClearing(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    if (!user) {
      dispatch(openAuthModal({ mode: 'login', returnTo: '/cart' }));
      dispatch(pushToast({ variant: 'info', message: 'Sign in to validate and apply coupons.' }));
      return;
    }
    try {
      await dispatch(applyServerCoupon(couponInput.trim())).unwrap();
      dispatch(pushToast({ variant: 'success', message: 'Coupon applied to your cart.' }));
      setCouponInput('');
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Invalid or ineligible coupon.',
        })
      );
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await dispatch(removeServerCoupon()).unwrap();
      dispatch(pushToast({ variant: 'info', message: 'Coupon removed.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to remove coupon.',
        })
      );
    }
  };

  const handleProceed = () => {
    if (hasUnavailableItems) {
      dispatch(
        pushToast({
          variant: 'warning',
          message: 'Please remove out-of-stock items before checking out.',
        })
      );
      return;
    }
    if (!user) {
      dispatch(openAuthModal({ mode: 'login', returnTo: '/checkout' }));
      dispatch(
        pushToast({
          variant: 'info',
          message: 'Please sign in or register to proceed to checkout.',
        })
      );
      return;
    }
    navigate('/checkout');
  };

  const mergedHomepage = useMemo(
    () =>
      homepage
        ? { ...homepage, trustPoints: trustPoints.length > 0 ? trustPoints : homepage.trustPoints }
        : trustPoints.length > 0
        ? ({ trustPoints } as HomepageConfig)
        : null,
    [homepage, trustPoints]
  );

  return (
    <div className="bg-[#F8FAFC] min-h-[70vh]">
      <SeoHead title="Shopping Cart – NOVARA COMMERCE" noindex />

      {/* Dynamic Multi-Page Cart Slideshow or Fallback CMS Cart Hero */}
      <PageSlideshow
        placement="cart"
        onAvailabilityChange={setHasCartSlideshow}
        className="max-w-7xl mx-auto px-4 pt-6"
      />
      {!hasCartSlideshow && <CartHeroBanner banner={cartBanner} />}

      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10 space-y-10">
        <BannerRenderer position="cart_page" />
        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 sm:p-14 text-center shadow-2xs max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#16A34A] flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Your shopping cart is empty
            </h2>
            <p className="text-sm text-slate-500 mt-2 mb-6 max-w-md mx-auto">
              Explore electronics, fashion, books, beauty, and home essentials across Bangladesh with fast nationwide delivery.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold shadow-sm transition-colors"
              >
                <span>Browse Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/deals"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-slate-200 bg-white hover:border-[#16A34A] hover:text-[#16A34A] text-slate-700 text-sm font-semibold transition-colors"
              >
                <span>View Flash Deals</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            <div className="lg:col-span-8">
              <CartItemsSection
                items={items}
                updatingItemKey={updatingItemKey}
                clearing={clearing}
                onUpdateQty={(productId, variantId, nextQty) =>
                  void handleQty(productId, variantId, nextQty)
                }
                onRemoveItem={(productId, variantId) =>
                  void handleQty(productId, variantId, 0)
                }
                onRequestClearCart={() => setClearConfirmOpen(true)}
              />
            </div>

            <aside className="lg:col-span-4 lg:sticky lg:top-24">
              <CartOrderSummary
                summary={computedSummary}
                appliedCouponCode={appliedCouponCode}
                couponMessage={couponMessage}
                couponInput={couponInput}
                onCouponInputChange={setCouponInput}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={() => void handleRemoveCoupon()}
                onProceedToCheckout={handleProceed}
                hasUnavailableItems={hasUnavailableItems}
                loading={loading}
                homepage={mergedHomepage}
              />
            </aside>
          </div>
        )}

        {/* Dynamic "You May Also Like" Horizontal Product Carousel */}
        <CartRecommendationsCarousel
          products={recommendations}
          loading={recsLoading}
          onSelectVariantProduct={setQuickViewProduct}
          onItemAdded={() => void loadRecommendations()}
        />
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => void handleConfirmClearCart()}
        title="Clear Shopping Cart?"
        message="This will remove all items and any applied promo code from your cart."
        confirmLabel="Clear Cart"
        danger
        loading={clearing}
      />

      {/* Variant Quick View Modal for Multi-Variant Recommendations */}
      <ProductQuickViewModal
        product={quickViewProduct}
        open={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
}
