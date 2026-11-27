import { CheckCircle2, Play, RotateCcw, ShieldCheck, Star, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseSafeProductVideoUrl } from '../../../shared/productDetailHelpers.ts';
import { DEFAULT_SHIPPING_CONFIG } from '../../../shared/pricing.ts';
import { formatBdt } from '../../lib/api.ts';
import type { Product, ReviewItem, StoreSettings } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';
import { ProductQaTab } from './ProductQaTab.tsx';

export type ProductDetailTabKey = 'description' | 'specs' | 'reviews' | 'questions' | 'shipping';

interface ProductDetailsTabsProps {
  product: Product;
  storeSettings: StoreSettings | null;
  activeTab: ProductDetailTabKey;
  onTabChange: (tab: ProductDetailTabKey) => void;
  reviews: ReviewItem[];
  reviewTotal: number;
  averageRating: number;
  qaTotal: number;
  onQaCountUpdated: (count: number) => void;
  onOpenVideo: () => void;
}

export function ProductDetailsTabs({
  product,
  storeSettings,
  activeTab,
  onTabChange,
  reviews,
  reviewTotal,
  averageRating,
  qaTotal,
  onQaCountUpdated,
  onOpenVideo,
}: ProductDetailsTabsProps) {
  const videoEmbed = parseSafeProductVideoUrl(product.videoUrl);
  const shippingCfg = storeSettings?.shipping || DEFAULT_SHIPPING_CONFIG;

  const specGroups = product.specificationGroups || [];
  const flatAttributes = Object.entries(product.attributes || {});

  const tabs: Array<{ key: ProductDetailTabKey; label: string }> = [
    { key: 'description', label: 'Description' },
    { key: 'specs', label: 'Specifications' },
    { key: 'reviews', label: `Reviews (${reviewTotal})` },
    { key: 'questions', label: `Questions (${qaTotal})` },
    { key: 'shipping', label: 'Shipping & Returns' },
  ];

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
      {/* Tab Strip */}
      <div
        role="tablist"
        aria-label="Product information sections"
        className="flex items-center border-b border-slate-200 overflow-x-auto px-4 sm:px-6 gap-2"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.key)}
              className={`px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-[#15803D] text-[#15803D]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="p-5 sm:p-7 text-sm text-slate-700 leading-relaxed">
        {activeTab === 'description' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className={videoEmbed.valid ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
              <div className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
                {product.description}
              </div>

              {product.features && product.features.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Admin-configured Video Preview Card */}
            {videoEmbed.valid && (
              <div className="lg:col-span-5">
                <button
                  type="button"
                  onClick={onOpenVideo}
                  className="block group relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 text-left shadow-sm"
                >
                  <SafeImage
                    src={product.videoThumbnail?.url || product.images?.[0]?.url}
                    alt={`${product.name} product video`}
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 z-10 bg-slate-950/55 group-hover:bg-slate-950/45 transition-colors flex flex-col items-center justify-center p-4 text-center">
                    <span className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-slate-900 ml-0.5" />
                    </span>
                    <span className="mt-3 text-sm font-bold text-white drop-shadow-xs">
                      Watch Product Video
                    </span>
                    <span className="text-xs font-medium text-slate-100 mt-0.5 drop-shadow-xs">
                      See it in action
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="space-y-6">
            {specGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {specGroups.map((group, gIdx) => (
                  <div
                    key={`${group.groupTitle}-${gIdx}`}
                    className="rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      {group.groupTitle}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.items.map((item, idx) => (
                        <div
                          key={`${item.label}-${idx}`}
                          className="px-4 py-2.5 grid grid-cols-5 gap-3 text-xs sm:text-sm"
                        >
                          <span className="col-span-2 font-semibold text-slate-800">
                            {item.label}
                          </span>
                          <span className="col-span-3 text-slate-600">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {flatAttributes.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden max-w-3xl">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Product Attributes
                </div>
                <div className="divide-y divide-slate-100">
                  {flatAttributes.map(([k, v]) => (
                    <div key={k} className="px-4 py-2.5 grid grid-cols-5 gap-3 text-xs sm:text-sm">
                      <span className="col-span-2 font-semibold text-slate-800">{k}</span>
                      <span className="col-span-3 text-slate-600">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {specGroups.length === 0 && flatAttributes.length === 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden max-w-2xl divide-y divide-slate-100">
                <div className="px-4 py-2.5 grid grid-cols-3 gap-4 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-800">SKU</span>
                  <span className="col-span-2 font-mono text-slate-600">{product.sku}</span>
                </div>
                {product.brandId?.name && (
                  <div className="px-4 py-2.5 grid grid-cols-3 gap-4 text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800">Brand</span>
                    <span className="col-span-2 text-slate-600">{product.brandId.name}</span>
                  </div>
                )}
                <div className="px-4 py-2.5 grid grid-cols-3 gap-4 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-800">Category</span>
                  <span className="col-span-2 text-slate-600">
                    {product.categoryId?.name || 'General'}
                  </span>
                </div>
                {product.warrantyInfo && (
                  <div className="px-4 py-2.5 grid grid-cols-3 gap-4 text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800">Warranty</span>
                    <span className="col-span-2 text-slate-600">{product.warrantyInfo}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {reviewTotal > 0 ? averageRating.toFixed(1) : '—'}
                </span>
                <div>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          reviewTotal > 0 && i < Math.round(averageRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {reviewTotal} approved customer review{reviewTotal === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <a
                href="#reviews"
                className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold"
              >
                View Full Breakdown & Write Review
              </a>
            </div>

            {reviews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reviews.slice(0, 4).map((r) => (
                  <div key={r._id} className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{r.userName}</span>
                      <span className="font-bold text-amber-500 tabular-nums">{r.rating}.0 ★</span>
                    </div>
                    {r.title && <p className="text-xs font-semibold text-slate-800">{r.title}</p>}
                    <p className="text-xs text-slate-600 line-clamp-3">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <ProductQaTab productId={product._id} onCountUpdated={onQaCountUpdated} />
        )}

        {activeTab === 'shipping' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Truck className="w-4 h-4 text-[#16A34A]" />
                <span>Bangladesh Delivery</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.shippingInfo ||
                  storeSettings?.policies?.shippingPolicy ||
                  `Dhaka Metro: ${formatBdt(shippingCfg.dhakaMetroCharge)} · Suburb: ${formatBdt(
                    shippingCfg.dhakaSuburbCharge
                  )} · Nationwide: ${formatBdt(shippingCfg.outsideDhakaCharge)}. Free standard delivery on orders over ${formatBdt(
                    shippingCfg.freeShippingThreshold
                  )}.`}
              </p>
              {product.deliveryNotes && (
                <p className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                  {product.deliveryNotes}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <RotateCcw className="w-4 h-4 text-[#16A34A]" />
                <span>Return & Replacement</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.returnPolicyInfo ||
                  storeSettings?.policies?.returnPolicy ||
                  'Customers in Bangladesh may request a return or replacement within 7 days of delivery for eligible unused items in original packaging.'}
              </p>
              <Link to="/policies/return" className="inline-block text-xs font-semibold text-[#15803D] hover:underline">
                Read full return policy
              </Link>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Warranty & Authenticity</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.warrantyInfo ||
                  'Covered under official NOVARA COMMERCE product authenticity guarantee.'}
              </p>
              <p className="text-[11px] text-slate-500">
                Payment: {product.codEligible ? 'Cash on Delivery & Online Payment' : 'Prepaid Online Payment Only'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
