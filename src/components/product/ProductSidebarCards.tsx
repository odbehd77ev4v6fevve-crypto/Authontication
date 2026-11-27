import { ArrowRight, Headphones, MapPin, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDistrictsByDivision, getDivisions, resolveZoneFromLocation } from '../../../shared/bangladeshLocations.ts';
import { calculateShippingCharge, DEFAULT_SHIPPING_CONFIG } from '../../../shared/pricing.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import { formatBdt } from '../../lib/api.ts';
import type { HomepageConfig, PromotionalPlacement, StoreSettings } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface ProductSidebarCardsProps {
  storeSettings: StoreSettings | null;
  homepage: HomepageConfig | null;
  sidebarPromo: PromotionalPlacement | null;
  productCodEligible: boolean;
  estDivisionCode: string;
  estDistrictCode: string;
  onChangeDivision: (divisionCode: string) => void;
  onChangeDistrict: (districtCode: string) => void;
  orderValue: number;
}

export function ProductSidebarCards({
  storeSettings,
  homepage,
  sidebarPromo,
  productCodEligible,
  estDivisionCode,
  estDistrictCode,
  onChangeDivision,
  onChangeDistrict,
  orderValue,
}: ProductSidebarCardsProps) {
  const shippingCfg = storeSettings?.shipping || DEFAULT_SHIPPING_CONFIG;
  const freeThreshold = shippingCfg.freeShippingThreshold ?? 999;

  const divisions = getDivisions();
  const districts = getDistrictsByDivision(estDivisionCode);
  const selectedDistrict = districts.find((d) => d.code === estDistrictCode) || districts[0];
  const zone = resolveZoneFromLocation(selectedDistrict?.code || estDistrictCode);
  const estimatedShipping = calculateShippingCharge(orderValue, zone, 'standard', shippingCfg);

  const trustReturnPoint = homepage?.trustPoints?.find((t) => t.icon === 'rotate');
  const trustSupportPoint = homepage?.trustPoints?.find((t) => t.icon === 'headphones');
  const trustSecurePoint = homepage?.trustPoints?.find((t) => t.icon === 'shield');

  const trustCards = [
    {
      icon: Truck,
      title: 'Free Shipping',
      subtitle:
        freeThreshold > 0
          ? `On orders over ${formatBdt(freeThreshold)}`
          : 'Nationwide delivery across Bangladesh',
      to: '/policies/shipping',
    },
    {
      icon: RotateCcw,
      title: trustReturnPoint?.title || 'Easy Return',
      subtitle: trustReturnPoint?.subtitle || '7 Days Return Policy',
      to: '/policies/return',
    },
    {
      icon: ShieldCheck,
      title: trustSecurePoint?.title || 'Secure Payment',
      subtitle: productCodEligible
        ? '100% secure · COD & SSLCommerz'
        : '100% secure online payment',
      to: '/policies/terms',
    },
    {
      icon: Headphones,
      title: trustSupportPoint?.title || '24/7 Support',
      subtitle: storeSettings?.supportPhone
        ? `Call ${storeSettings.supportPhone}`
        : trustSupportPoint?.subtitle || 'Always here to help',
      to: '/contact',
    },
  ];

  const safePromoHref = sanitizeHref(sidebarPromo?.destinationUrl);

  return (
    <aside className="space-y-3">
      {/* 4 Dynamic Trust Cards */}
      <div className="space-y-2.5">
        {trustCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.to}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-emerald-300 transition-colors shadow-2xs"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 text-[#15803D] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {card.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{card.subtitle}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Compact Bangladesh Delivery Estimator */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
          <span>Delivery Estimate (Bangladesh)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Delivery Division"
            value={estDivisionCode}
            onChange={(e) => onChangeDivision(e.target.value)}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700"
          >
            {divisions.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Delivery District"
            value={selectedDistrict?.code || ''}
            onChange={(e) => onChangeDistrict(e.target.value)}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700"
          >
            {districts.map((dist) => (
              <option key={dist.code} value={dist.code}>
                {dist.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-2 rounded-lg">
          <span className="text-slate-600">
            {zone === 'dhaka_metro' ? '1–2 business days' : '2–5 business days'}
          </span>
          <span className="font-bold text-[#15803D] tabular-nums">
            {estimatedShipping === 0 ? 'FREE' : formatBdt(estimatedShipping)}
          </span>
        </div>
      </div>

      {/* Admin-Configured Product Sidebar Promo Placement */}
      {sidebarPromo && safePromoHref && (
        <div
          className={`rounded-2xl overflow-hidden border p-4 space-y-3 shadow-xs ${
            sidebarPromo.layoutStyle === 'dark_emerald_banner'
              ? 'bg-[#062E22] border-emerald-900 text-white'
              : sidebarPromo.layoutStyle === 'soft_sage_banner'
              ? 'bg-gradient-to-br from-[#F0FBF3] to-[#E1F6E8] border-emerald-200/80 text-slate-900'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold leading-snug">{sidebarPromo.title}</h3>
            {sidebarPromo.subtitle && (
              <p
                className={`text-xs leading-relaxed ${
                  sidebarPromo.layoutStyle === 'dark_emerald_banner'
                    ? 'text-emerald-100'
                    : 'text-slate-600'
                }`}
              >
                {sidebarPromo.subtitle}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between gap-2">
            <Link
              to={safePromoHref}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-colors shrink-0 ${
                sidebarPromo.layoutStyle === 'dark_emerald_banner'
                  ? 'bg-white text-[#062E22] hover:bg-emerald-50'
                  : 'bg-[#15803D] text-white hover:bg-[#166534]'
              }`}
            >
              <span>{sidebarPromo.ctaText || 'Shop Now'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {sidebarPromo.imageUrl && (
              <SafeImage
                src={sidebarPromo.imageUrl}
                alt={sidebarPromo.altText || sidebarPromo.title}
                className="w-24 h-24 object-contain rounded-xl shrink-0"
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
