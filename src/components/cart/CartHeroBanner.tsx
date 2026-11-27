import { ArrowRight, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isSafeDestinationUrl } from '../../../shared/security.ts';
import type { CartHeroBannerConfig } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface CartHeroBannerProps {
  banner?: CartHeroBannerConfig | null;
}

function splitHeading(heading: string): { prefix: string; highlight: string } {
  const trimmed = heading.trim() || 'Your Cart';
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return { prefix: '', highlight: trimmed };
  }
  const highlight = words[words.length - 1];
  const prefix = words.slice(0, -1).join(' ');
  return { prefix, highlight };
}

function CartFallbackIllustration() {
  return (
    <div className="relative w-full max-w-[330px] h-[180px] sm:h-[215px] mx-auto select-none flex items-center justify-center">
      {/* Floating green cart badge */}
      <div className="absolute -left-2 sm:left-2 top-3 z-20 w-14 h-14 rounded-2xl bg-[#22C55E] shadow-lg shadow-emerald-600/30 -rotate-12 flex items-center justify-center border-2 border-white">
        <ShoppingCart className="w-7 h-7 text-white" />
      </div>

      {/* Decorative Shopping Cart & Colorful Bags Vector */}
      <svg
        viewBox="0 0 320 220"
        className="w-full h-full drop-shadow-[0_16px_28px_rgba(15,23,42,0.12)]"
        role="img"
        aria-label="Shopping cart filled with shopping bags"
      >
        {/* Floor shadow */}
        <ellipse cx="165" cy="198" rx="98" ry="12" fill="#86EFAC" fillOpacity="0.45" />

        {/* Colorful shopping bags inside cart */}
        <g transform="translate(88, 22)">
          {/* Blue bag */}
          <rect x="8" y="24" width="46" height="68" rx="6" fill="#2563EB" />
          <path d="M21 24 C21 10, 41 10, 41 24" fill="none" stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" />

          {/* Amber/Yellow bag */}
          <rect x="44" y="10" width="54" height="82" rx="6" fill="#F59E0B" />
          <rect x="44" y="10" width="54" height="18" rx="4" fill="#FBBF24" />
          <path d="M59 12 C59 -2, 83 -2, 83 12" fill="none" stroke="#B45309" strokeWidth="3.5" strokeLinecap="round" />

          {/* Coral/Red bag */}
          <rect x="84" y="30" width="46" height="62" rx="6" fill="#EF4444" />
          <path d="M97 30 C97 18, 117 18, 117 30" fill="none" stroke="#991B1B" strokeWidth="3.5" strokeLinecap="round" />

          {/* Mint/Emerald bag */}
          <rect x="116" y="18" width="46" height="74" rx="6" fill="#16A34A" />
          <path d="M129 18 C129 5, 149 5, 149 18" fill="none" stroke="#14532D" strokeWidth="3.5" strokeLinecap="round" />
        </g>

        {/* Metallic Cart Basket */}
        <path
          d="M72 72 L248 72 L228 148 L96 148 Z"
          fill="#F8FAFC"
          fillOpacity="0.92"
          stroke="#64748B"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        {/* Cart Grid Lines */}
        <line x1="108" y1="74" x2="118" y2="146" stroke="#CBD5E1" strokeWidth="3" />
        <line x1="142" y1="74" x2="146" y2="146" stroke="#CBD5E1" strokeWidth="3" />
        <line x1="178" y1="74" x2="174" y2="146" stroke="#CBD5E1" strokeWidth="3" />
        <line x1="212" y1="74" x2="202" y2="146" stroke="#CBD5E1" strokeWidth="3" />
        <line x1="80" y1="98" x2="241" y2="98" stroke="#CBD5E1" strokeWidth="3" />
        <line x1="88" y1="124" x2="234" y2="124" stroke="#CBD5E1" strokeWidth="3" />

        {/* Handle & Frame */}
        <path
          d="M46 46 L68 46 L96 168 L224 168"
          fill="none"
          stroke="#475569"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="36" y="39" width="22" height="12" rx="6" fill="#15803D" />

        {/* Wheels */}
        <circle cx="110" cy="186" r="13" fill="#1E293B" />
        <circle cx="110" cy="186" r="5" fill="#94A3B8" />
        <circle cx="206" cy="186" r="13" fill="#1E293B" />
        <circle cx="206" cy="186" r="5" fill="#94A3B8" />
      </svg>
    </div>
  );
}

export function CartHeroBanner({ banner }: CartHeroBannerProps) {
  const badgeText = banner?.badgeText?.trim() || 'Your Shopping Cart';
  const heading = banner?.heading?.trim() || 'Your Cart';
  const subtitle = banner?.subtitle?.trim() || 'Review your items and proceed to checkout';
  const ctaText = banner?.ctaText?.trim() || 'Continue Shopping';
  const rawCtaLink = banner?.ctaLink?.trim() || '/shop';
  const safeCtaLink = isSafeDestinationUrl(rawCtaLink, { allowRelative: true }) ? rawCtaLink : '/shop';
  const isExternalCta = safeCtaLink.startsWith('http://') || safeCtaLink.startsWith('https://');
  const imagePosition = banner?.imagePosition || 'right';

  const hasDesktopImg = Boolean(banner?.desktopImageUrl?.trim());
  const hasMobileImg = Boolean(banner?.mobileImageUrl?.trim());
  const { prefix, highlight } = splitHeading(heading);

  const ctaContent = (
    <>
      <span>{ctaText}</span>
      <span className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center">
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </>
  );

  const ctaClassName =
    'inline-flex items-center gap-2.5 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-[#16A34A] to-[#22C55E] hover:from-[#15803D] hover:to-[#16A34A] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all';

  return (
    <section
      aria-label="Shopping Cart Hero"
      className="relative overflow-hidden bg-gradient-to-br from-[#F0FDF4] via-[#DCFCE7] to-[#D1FAE5] border-b border-emerald-200/70"
    >
      {/* Decorative Curved Sweeps matching reference hero */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-75"
      >
        <path
          d="M0,180 C340,260 660,70 1440,150 L1440,320 L0,320 Z"
          fill="#BBF7D0"
          fillOpacity="0.45"
        />
        <path
          d="M0,250 C420,160 980,290 1440,210 L1440,320 L0,320 Z"
          fill="#86EFAC"
          fillOpacity="0.3"
        />
        <circle cx="1140" cy="40" r="140" fill="#86EFAC" fillOpacity="0.28" />
        <circle cx="1320" cy="240" r="120" fill="#4ADE80" fillOpacity="0.2" />
      </svg>

      {/* Optional Background Image Mode */}
      {imagePosition === 'background' && (hasDesktopImg || hasMobileImg) && (
        <div className="absolute inset-0 z-0">
          {hasDesktopImg && (
            <SafeImage
              src={banner?.desktopImageUrl}
              alt={banner?.altText || heading}
              className={`w-full h-full object-cover ${hasMobileImg ? 'hidden md:block' : 'block'}`}
            />
          )}
          {hasMobileImg && (
            <SafeImage
              src={banner?.mobileImageUrl}
              alt={banner?.altText || heading}
              className={`w-full h-full object-cover ${hasDesktopImg ? 'md:hidden' : 'block'}`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F0FDF4]/95 via-[#DCFCE7]/85 to-[#DCFCE7]/45" />
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-7 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Typography + CTA */}
          <div className="md:col-span-7 space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#22C55E] text-white text-xs font-bold shadow-xs">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{badgeText}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
              {prefix ? (
                <>
                  <span>{prefix} </span>
                  <span className="text-[#16A34A]">{highlight}</span>
                </>
              ) : (
                <span className="text-[#16A34A]">{highlight}</span>
              )}
            </h1>

            <p className="text-sm sm:text-base text-slate-700 font-medium max-w-xl">
              {subtitle}
            </p>

            {ctaText && (
              <div className="pt-1">
                {isExternalCta ? (
                  <a
                    href={safeCtaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ctaClassName}
                  >
                    {ctaContent}
                  </a>
                ) : (
                  <Link to={safeCtaLink} className={ctaClassName}>
                    {ctaContent}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Right Artwork or Admin-Uploaded Hero Image */}
          <div className="md:col-span-5 flex justify-center md:justify-end">
            {imagePosition === 'right' && (hasDesktopImg || hasMobileImg) ? (
              <div className="w-full max-w-[360px] flex items-center justify-center">
                {hasDesktopImg && (
                  <SafeImage
                    src={banner?.desktopImageUrl}
                    alt={banner?.altText || heading}
                    className={`max-h-[220px] sm:max-h-[250px] w-auto object-contain rounded-2xl drop-shadow-xl ${
                      hasMobileImg ? 'hidden md:block' : 'block'
                    }`}
                  />
                )}
                {hasMobileImg && (
                  <SafeImage
                    src={banner?.mobileImageUrl}
                    alt={banner?.altText || heading}
                    className={`max-h-[200px] w-auto object-contain rounded-2xl drop-shadow-xl ${
                      hasDesktopImg ? 'md:hidden' : 'block'
                    }`}
                  />
                )}
              </div>
            ) : imagePosition === 'right' ? (
              <CartFallbackIllustration />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
