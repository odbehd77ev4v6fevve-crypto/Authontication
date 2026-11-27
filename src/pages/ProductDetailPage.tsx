import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_BD_LOCATION,
  getDistrictsByDivision,
} from '../../shared/bangladeshLocations.ts';
import {
  clampPurchaseQuantity,
  extractVariantAttributeGroups,
  findMatchingVariant,
  parseSafeProductVideoUrl,
} from '../../shared/productDetailHelpers.ts';
import { useAppDispatch, useAppSelector } from '../app/hooks.ts';
import { ProductDetailsTabs, type ProductDetailTabKey } from '../components/product/ProductDetailsTabs.tsx';
import { ProductGallery } from '../components/product/ProductGallery.tsx';
import { ProductPurchasePanel } from '../components/product/ProductPurchasePanel.tsx';
import { ProductReviewsSection } from '../components/product/ProductReviewsSection.tsx';
import { ProductSidebarCards } from '../components/product/ProductSidebarCards.tsx';
import { RelatedProductsCarousel } from '../components/product/RelatedProductsCarousel.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { SeoHead } from '../components/ui/SeoHead.tsx';
import { AdvertisementBanner } from '../components/marketing/AdvertisementBanner.tsx';
import { BannerRenderer } from '../components/marketing/BannerRenderer.tsx';
import { openAuthModal, updateUserState } from '../features/auth/authSlice.ts';
import { addGuestCartItem, addToServerCart, setCartDrawerOpen } from '../features/cart/cartSlice.ts';
import { pushToast } from '../features/toast/toastSlice.ts';
import { toggleGuestWishlistItem } from '../features/wishlist/wishlistSlice.ts';
import { apiRequest } from '../lib/api.ts';
import type {
  HomepageConfig,
  Product,
  PromotionalPlacement,
  ReviewItem,
  StoreSettings,
} from '../types/domain.ts';

interface ProductDetailPageProps {
  homepage?: HomepageConfig | null;
  activePromotions?: PromotionalPlacement[];
  storeSettings?: StoreSettings | null;
}

export function ProductDetailPage({
  homepage = null,
  activePromotions = [],
  storeSettings = null,
}: ProductDetailPageProps) {
  const { slug } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const guestWishlistIds = useAppSelector((s) => s.wishlist.guestIds);

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [qaTotal, setQaTotal] = useState(0);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<ProductDetailTabKey>('description');
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delivery estimator
  const [estDivisionCode, setEstDivisionCode] = useState(DEFAULT_BD_LOCATION.divisionCode);
  const [estDistrictCode, setEstDistrictCode] = useState(DEFAULT_BD_LOCATION.districtCode);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);

  // Back in stock
  const [notifyEmail, setNotifyEmail] = useState(user?.email || '');

  useEffect(() => {
    if (user?.email) {
      setNotifyEmail((prev) => prev || user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setActiveTab('description');
    setReviewPage(1);

    apiRequest<{ product: Product; relatedProducts: Product[]; qaTotal?: number }>(
      `/api/catalog/products/${slug}`
    )
      .then((res) => {
        setProduct(res.product);
        setRelatedProducts(res.relatedProducts || []);
        setQaTotal(res.qaTotal || 0);
        setSelectedImageIdx(0);
        setQuantity(1);

        const activeVars = (res.product.variants || []).filter((v) => v.isActive !== false);
        const firstActiveVariant =
          activeVars.find((v) => v.stockOnHand - v.reservedStock > 0) || activeVars[0] || null;
        setSelectedVariantId(firstActiveVariant ? firstActiveVariant._id : null);
        setSelectedOptions(firstActiveVariant?.options ? { ...firstActiveVariant.options } : {});
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load product.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const loadReviews = useCallback(
    async (productId: string) => {
      try {
        const res = await apiRequest<{
          reviews: ReviewItem[];
          total: number;
          averageRating: number;
          distribution: Record<number, number>;
          totalPages: number;
        }>(`/api/reviews/product/${productId}?sort=${reviewSort}&page=${reviewPage}&limit=6`);
        setReviews(res.reviews || []);
        setReviewTotal(res.total || 0);
        setAverageRating(res.averageRating || 0);
        setDistribution(res.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
        setReviewTotalPages(Math.max(1, res.totalPages || 1));
      } catch {
        // Ignore transient review fetch errors
      }
    },
    [reviewSort, reviewPage]
  );

  useEffect(() => {
    if (product?._id) {
      void loadReviews(product._id);
    }
  }, [product?._id, loadReviews]);

  const activeVariants = useMemo(
    () => (product?.variants || []).filter((v) => v.isActive !== false),
    [product?.variants]
  );

  const activeVariant = useMemo(
    () => activeVariants.find((v) => v._id === selectedVariantId) || null,
    [activeVariants, selectedVariantId]
  );

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const list = [...(product.images || [])];
    if (activeVariant?.image?.url) {
      const existingIdx = list.findIndex((i) => i.url === activeVariant.image?.url);
      if (existingIdx === -1) {
        return [activeVariant.image, ...list];
      }
    }
    return list;
  }, [product, activeVariant]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="h-4 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 aspect-square rounded-2xl bg-slate-100 animate-pulse" />
          <div className="lg:col-span-4 space-y-4">
            <div className="h-8 bg-slate-100 rounded w-3/4 animate-pulse" />
            <div className="h-6 bg-slate-100 rounded w-1/3 animate-pulse" />
            <div className="h-44 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="lg:col-span-3 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Product Not Found</h1>
        <p className="text-sm text-slate-500">
          {error || 'This product may have been archived or removed.'}
        </p>
        <Link
          to="/shop"
          className="inline-block px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-sm font-semibold"
        >
          Back to Catalog
        </Link>
      </div>
    );
  }

  const availableStock = activeVariant
    ? Math.max(0, activeVariant.stockOnHand - activeVariant.reservedStock)
    : product.availableStock;
  const currentPrice = activeVariant?.price ?? product.effectivePrice;
  const mainImage = galleryImages[selectedImageIdx] || galleryImages[0];

  const maxQuantityCap = clampPurchaseQuantity({
    requested: 50,
    availableStock,
    maxOrderQuantity: product.maxOrderQuantity,
    allowBackorders: product.allowBackorders,
  });
  const effectiveQuantity = clampPurchaseQuantity({
    requested: quantity,
    availableStock,
    maxOrderQuantity: product.maxOrderQuantity,
    allowBackorders: product.allowBackorders,
  });

  const isWishlisted = user
    ? Boolean(user.wishlist?.includes(product._id))
    : guestWishlistIds.includes(product._id);

  const sidebarPromo =
    activePromotions.find((p) => p.placementSlot === 'product_sidebar') || null;
  const verifiedReviewCount = reviews.filter((r) => r.verifiedPurchase).length;
  const videoEmbed = parseSafeProductVideoUrl(product.videoUrl);

  const handleSelectOption = (key: string, value: string) => {
    const nextOpts = { ...selectedOptions, [key]: value };
    const matched = findMatchingVariant(activeVariants, nextOpts);
    if (matched) {
      setSelectedOptions({ ...(matched.options || nextOpts) });
      setSelectedVariantId(matched._id);
    } else {
      const fallback = activeVariants.find((v) => (v.options || {})[key] === value);
      if (fallback) {
        setSelectedOptions({ ...(fallback.options || nextOpts) });
        setSelectedVariantId(fallback._id);
      } else {
        setSelectedOptions(nextOpts);
      }
    }
    setSelectedImageIdx(0);
    setQuantity(1);
  };

  const handleSelectVariantDirect = (variantId: string) => {
    const target = activeVariants.find((v) => v._id === variantId);
    setSelectedVariantId(variantId);
    setSelectedOptions(target?.options ? { ...target.options } : {});
    setSelectedImageIdx(0);
    setQuantity(1);
  };

  const handleAddOrBuy = async (buyNow: boolean) => {
    if (availableStock <= 0 && !product.allowBackorders) {
      dispatch(
        pushToast({ variant: 'warning', message: 'Selected option is currently out of stock.' })
      );
      return;
    }

    if (activeVariants.length > 0) {
      const attributeGroups = extractVariantAttributeGroups(activeVariants);
      const missingGroup = attributeGroups.find((g) => !selectedOptions[g.name]);
      if (missingGroup || !activeVariant) {
        dispatch(
          pushToast({
            variant: 'warning',
            message: missingGroup
              ? `Please select ${missingGroup.name}.`
              : 'Please select an available variant option.',
          })
        );
        return;
      }
    }

    if (user) {
      try {
        await dispatch(
          addToServerCart({
            productId: product._id,
            variantId: activeVariant?._id || null,
            quantity: effectiveQuantity,
          })
        ).unwrap();
        if (buyNow) {
          navigate('/checkout');
        } else {
          dispatch(pushToast({ variant: 'success', message: 'Added to your cart.' }));
          dispatch(setCartDrawerOpen(true));
        }
      } catch (err) {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to add item.',
          })
        );
      }
    } else {
      dispatch(
        addGuestCartItem({
          productId: product._id,
          variantId: activeVariant?._id || null,
          slug: product.slug,
          sku: activeVariant?.sku || product.sku,
          name: product.name,
          variantTitle: activeVariant?.title || null,
          selectedOptions: activeVariant?.options || {},
          imageUrl: mainImage?.url || '',
          quantity: effectiveQuantity,
          unitPrice: currentPrice,
          originalPrice: product.originalPrice,
          availableStock,
          lowStockThreshold: activeVariant?.lowStockThreshold ?? product.lowStockThreshold,
          allowBackorders: product.allowBackorders,
          maxOrderQuantity: product.maxOrderQuantity,
          ratingAverage: reviewTotal > 0 ? averageRating : product.ratingAverage,
          ratingCount: reviewTotal > 0 ? reviewTotal : product.ratingCount,
          categoryId: product.categoryId?._id,
          codEligible: product.codEligible,
        })
      );
      if (buyNow) {
        dispatch(openAuthModal({ mode: 'login', returnTo: '/checkout' }));
        dispatch(
          pushToast({
            variant: 'info',
            message: 'Please sign in or register to complete your purchase.',
          })
        );
      } else {
        dispatch(pushToast({ variant: 'success', message: 'Added to your cart.' }));
        dispatch(setCartDrawerOpen(true));
      }
    }
  };

  const handleBackInStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/catalog/products/${product._id}/back-in-stock`,
        {
          method: 'POST',
          body: JSON.stringify({ email: notifyEmail }),
        }
      );
      dispatch(pushToast({ variant: 'success', message: res.message }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to opt in.',
        })
      );
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      const wasSaved = guestWishlistIds.includes(product._id);
      dispatch(toggleGuestWishlistItem(product._id));
      dispatch(
        pushToast({
          variant: 'success',
          message: wasSaved ? 'Removed from wishlist.' : 'Saved to wishlist.',
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
          message: res.added ? 'Saved to wishlist.' : 'Removed from wishlist.',
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

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: activeVariant?.sku || product.sku,
    description: product.shortDescription || product.description,
    image: galleryImages.map((g) => g.url),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BDT',
      price: currentPrice,
      availability:
        availableStock > 0
          ? 'https://schema.org/InStock'
          : product.allowBackorders
          ? 'https://schema.org/PreOrder'
          : 'https://schema.org/OutOfStock',
    },
  };
  if (product.brandId?.name) {
    structuredData.brand = {
      '@type': 'Brand',
      name: product.brandId.name,
    };
  }
  if (reviewTotal > 0) {
    structuredData.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: averageRating,
      reviewCount: reviewTotal,
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8 sm:space-y-10">
      <SeoHead
        title={product.seoTitle || `${product.name} – NOVARA COMMERCE`}
        description={
          product.seoDescription ||
          product.shortDescription ||
          product.description.slice(0, 155)
        }
        canonicalUrl={product.canonicalUrl}
        ogImage={product.ogImage?.url || mainImage?.url}
        structuredData={structuredData}
      />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link to="/" className="hover:text-[#15803D] font-medium">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        {product.categoryId && (
          <>
            <Link
              to={`/category/${product.categoryId.slug}`}
              className="hover:text-[#15803D] font-medium"
            >
              {product.categoryId.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </>
        )}
        {product.subcategoryId && product.subcategoryId._id !== product.categoryId?._id && (
          <>
            <Link
              to={`/category/${product.subcategoryId.slug}`}
              className="hover:text-[#15803D] font-medium"
            >
              {product.subcategoryId.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </>
        )}
        <span className="text-slate-900 font-semibold truncate max-w-xs sm:max-w-md">
          {product.name}
        </span>
      </nav>

      {/* Primary 3-Column Product Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <ProductGallery
            images={galleryImages}
            productName={product.name}
            selectedIndex={selectedImageIdx}
            onSelectIndex={setSelectedImageIdx}
            discountPercent={product.discountPercent}
            isFlashSaleActive={product.isFlashSaleActive}
          />
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <ProductPurchasePanel
            product={product}
            activeVariants={activeVariants}
            activeVariant={activeVariant}
            selectedOptions={selectedOptions}
            onSelectOption={handleSelectOption}
            onSelectVariantDirect={handleSelectVariantDirect}
            availableStock={availableStock}
            quantity={effectiveQuantity}
            maxQuantityCap={maxQuantityCap}
            onQuantityChange={setQuantity}
            currentPrice={currentPrice}
            reviewTotal={reviewTotal}
            averageRating={averageRating}
            verifiedReviewCount={verifiedReviewCount}
            isWishlisted={isWishlisted}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={() => void handleAddOrBuy(false)}
            onBuyNow={() => void handleAddOrBuy(true)}
            onOpenVideo={() => setVideoModalOpen(true)}
            notifyEmail={notifyEmail}
            onNotifyEmailChange={setNotifyEmail}
            onBackInStockSubmit={handleBackInStock}
          />
        </div>

        <div className="lg:col-span-3">
          <ProductSidebarCards
            storeSettings={storeSettings}
            homepage={homepage}
            sidebarPromo={sidebarPromo}
            productCodEligible={product.codEligible}
            estDivisionCode={estDivisionCode}
            estDistrictCode={estDistrictCode}
            onChangeDivision={(nextDiv) => {
              setEstDivisionCode(nextDiv);
              const nextDistricts = getDistrictsByDivision(nextDiv);
              if (nextDistricts[0]) setEstDistrictCode(nextDistricts[0].code);
            }}
            onChangeDistrict={setEstDistrictCode}
            orderValue={currentPrice * effectiveQuantity}
          />
        </div>
      </div>

      {/* Structured Product Details Tabs */}
      <ProductDetailsTabs
        product={product}
        storeSettings={storeSettings}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        reviews={reviews}
        reviewTotal={reviewTotal}
        averageRating={averageRating}
        qaTotal={qaTotal}
        onQaCountUpdated={setQaTotal}
        onOpenVideo={() => setVideoModalOpen(true)}
      />

      <AdvertisementBanner placement="product_detail" />
      <BannerRenderer
        position="product_detail_page"
        categorySlug={product.categoryId?.slug}
      />

      {/* Customer Reviews Breakdown & Cards */}
      <ProductReviewsSection
        productId={product._id}
        productName={product.name}
        reviews={reviews}
        reviewTotal={reviewTotal}
        averageRating={averageRating}
        distribution={distribution}
        reviewSort={reviewSort}
        onSortChange={(nextSort) => {
          setReviewSort(nextSort);
          setReviewPage(1);
        }}
        page={reviewPage}
        totalPages={reviewTotalPages}
        onPageChange={setReviewPage}
        onReloadReviews={() => void loadReviews(product._id)}
      />

      {/* Related Products Horizontal Carousel */}
      <RelatedProductsCarousel
        products={relatedProducts}
        categorySlug={product.categoryId?.slug}
      />

      {/* Safe Product Video Player Modal */}
      {videoEmbed.valid && videoEmbed.embedUrl && (
        <Modal
          open={videoModalOpen}
          onClose={() => setVideoModalOpen(false)}
          title={`${product.name} — Product Video`}
          maxWidthClass="max-w-3xl"
        >
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950">
            {videoEmbed.type === 'direct' ? (
              <video
                src={videoEmbed.embedUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <iframe
                src={videoEmbed.embedUrl}
                title={`${product.name} product video`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
