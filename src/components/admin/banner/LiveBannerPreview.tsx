import { ArrowRight, ShoppingCart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getBannerAspectRatioNumeric,
  normalizeHexColor,
  sanitizeCustomCss,
  splitHeadingForHighlight,
  type BannerDraftConfig,
} from '../../../../shared/bannerHelpers.ts';
import { sanitizeHref } from '../../../../shared/security.ts';
import type { BannerResolvedProduct } from '../../../types/domain.ts';
import { SafeImage } from '../../ui/SafeImage.tsx';

interface LiveBannerPreviewProps {
  banner: BannerDraftConfig;
  resolvedProducts?: BannerResolvedProduct[];
  viewport?: 'desktop' | 'tablet' | 'mobile';
  interactiveLinks?: boolean;
  compactSidebar?: boolean;
  slideIndicators?: { total: number; current: number; onSelect?: (idx: number) => void };
}

function getPatternBackground(patternType: BannerDraftConfig['patternType']): string {
  if (patternType === 'grid') {
    return 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)';
  }
  if (patternType === 'diagonal') {
    return 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 14px)';
  }
  return 'radial-gradient(rgba(255,255,255,0.22) 1.25px, transparent 1.25px)';
}

export function LiveBannerPreview({
  banner,
  resolvedProducts = [],
  viewport = 'desktop',
  interactiveLinks = false,
  compactSidebar = false,
  slideIndicators,
}: LiveBannerPreviewProps) {
  const safeHref = sanitizeHref(banner.buttonLink) || '/shop';
  const isExternal = /^https?:\/\//i.test(safeHref);
  const { prefix, highlight, suffix } = splitHeadingForHighlight(
    banner.mainHeading,
    banner.highlightText
  );
  const sanitizedCss = sanitizeCustomCss(banner.customCss);

  const solidColor = normalizeHexColor(banner.solidColor, '#15803D');
  const gradStart = normalizeHexColor(banner.gradientStart, '#06381C');
  const gradEnd = normalizeHexColor(banner.gradientEnd, '#22C55E');
  const textColor = normalizeHexColor(banner.textColor, '#FFFFFF');
  const highlightColor = normalizeHexColor(banner.highlightColor, '#A3E635');
  const buttonBg = normalizeHexColor(banner.buttonBgColor, '#A3E635');
  const buttonText = normalizeHexColor(banner.buttonTextColor, '#0F172A');
  const overlayColor = normalizeHexColor(banner.overlayColor, '#052E16');

  const isMobileViewport = viewport === 'mobile' || compactSidebar;
  const isCentered = banner.textAlignment === 'center';
  const isRight = banner.textAlignment === 'right';
  const hasProducts =
    banner.productSelectionMode !== 'none' && resolvedProducts.length > 0 && !compactSidebar;
  const hasArtwork = Boolean(banner.desktopImageUrl || banner.mobileImageUrl);

  const bgOpacity = Math.max(0.1, Math.min(1, (banner.backgroundOpacity ?? 100) / 100));

  const backgroundStyle: React.CSSProperties =
    banner.backgroundType === 'solid'
      ? { backgroundColor: solidColor }
      : {
          backgroundImage: `linear-gradient(${banner.gradientDirection || '135deg'}, ${gradStart}, ${gradEnd})`,
        };

  const containerWidthClass =
    viewport === 'mobile'
      ? 'max-w-[390px] mx-auto'
      : viewport === 'tablet'
      ? 'max-w-[768px] mx-auto'
      : banner.bannerSize === 'container_width'
      ? 'max-w-6xl mx-auto'
      : banner.bannerSize === 'medium'
      ? 'max-w-5xl mx-auto'
      : banner.bannerSize === 'small'
      ? 'max-w-4xl mx-auto'
      : 'w-full';

  const aspectValue =
    isMobileViewport || banner.bannerSize === 'small' || compactSidebar
      ? undefined
      : getBannerAspectRatioNumeric(
          banner.aspectRatio,
          banner.customAspectWidth,
          banner.customAspectHeight
        );

  const effectiveMinHeight = compactSidebar
    ? 220
    : viewport === 'mobile'
    ? 280
    : banner.bannerSize === 'small'
    ? Math.min(200, banner.bannerHeightPx || 160)
    : banner.bannerSize === 'medium'
    ? Math.min(340, banner.bannerHeightPx || 300)
    : Math.min(540, Math.max(240, banner.bannerHeightPx || 400));

  const fontWeightNumber = Number(banner.fontWeight || '700');

  const animationClass =
    banner.animationEffect === 'slide_up'
      ? 'transition-all duration-500 translate-y-0 opacity-100'
      : banner.animationEffect === 'slide_left'
      ? 'transition-all duration-500 translate-x-0 opacity-100'
      : banner.animationEffect === 'zoom'
      ? 'transition-transform duration-500 scale-100'
      : 'transition-opacity duration-500 opacity-100';

  const ctaButtonElement = banner.buttonText ? (
    interactiveLinks ? (
      isExternal ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundColor: buttonBg, color: buttonText }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-md hover:opacity-95 transition-all whitespace-nowrap shrink-0"
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span>{banner.buttonText}</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </a>
      ) : (
        <Link
          to={safeHref}
          style={{ backgroundColor: buttonBg, color: buttonText }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-md hover:opacity-95 transition-all whitespace-nowrap shrink-0"
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span>{banner.buttonText}</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </Link>
      )
    ) : (
      <span
        style={{ backgroundColor: buttonBg, color: buttonText }}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-md whitespace-nowrap shrink-0"
      >
        <ShoppingCart className="w-4 h-4 shrink-0" />
        <span>{banner.buttonText}</span>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </span>
    )
  ) : null;

  return (
    <div className={`w-full ${containerWidthClass}`}>
      <div
        className={`w-full relative overflow-hidden ${animationClass} ${
          banner.boxShadow ? 'shadow-lg' : 'border border-slate-200/70'
        }`}
        style={{
          ...backgroundStyle,
          width: '100%',
          borderRadius: `${Math.max(0, Math.min(48, banner.borderRadiusPx ?? 16))}px`,
          minHeight: `${effectiveMinHeight}px`,
          maxHeight: aspectValue ? '560px' : undefined,
          aspectRatio: !hasProducts ? aspectValue : undefined,
          fontFamily: `'${banner.fontFamily || 'Poppins'}', system-ui, sans-serif`,
          opacity: bgOpacity,
          ...sanitizedCss.styleObject,
        }}
      >
        {/* Background Media Layer (Image or Overlay mode) */}
        {(banner.backgroundType === 'image' || banner.backgroundType === 'overlay') &&
          hasArtwork && (
            <picture className="absolute inset-0 w-full h-full pointer-events-none">
              {banner.mobileImageUrl && (
                <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} />
              )}
              <SafeImage
                src={
                  viewport === 'mobile' && banner.mobileImageUrl
                    ? banner.mobileImageUrl
                    : banner.desktopImageUrl || banner.mobileImageUrl
                }
                alt={banner.altText || banner.mainHeading}
                className="w-full h-full object-cover"
              />
            </picture>
          )}

        {/* Scrim / Overlay Tint */}
        {(banner.overlayEnabled || banner.backgroundType === 'overlay') && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: overlayColor,
              opacity: Math.max(0, Math.min(0.95, (banner.overlayOpacity ?? 35) / 100)),
            }}
          />
        )}

        {/* Pattern Layer */}
        {banner.patternEnabled && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: getPatternBackground(banner.patternType),
              backgroundSize: banner.patternType === 'grid' ? '24px 24px' : '18px 18px',
            }}
          />
        )}

        {/* Backdrop Blur Layer */}
        {banner.blurEnabled && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backdropFilter: `blur(${Math.max(1, Math.min(24, banner.blurPx ?? 6))}px)`,
              WebkitBackdropFilter: `blur(${Math.max(1, Math.min(24, banner.blurPx ?? 6))}px)`,
            }}
          />
        )}

        {/* Main Content Layout */}
        <div
          className="relative z-10 h-full flex flex-col justify-between gap-5"
          style={{
            padding: `${Math.max(16, Math.min(80, banner.paddingPx ?? 32))}px`,
            minHeight: `${effectiveMinHeight}px`,
          }}
        >
          <div
            className={`my-auto grid gap-6 items-center ${
              isMobileViewport || isCentered || !hasArtwork || banner.backgroundType === 'image' || banner.backgroundType === 'overlay'
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-12'
            }`}
          >
            {/* Copy Column */}
            <div
              className={`space-y-3 ${
                isCentered
                  ? 'text-center mx-auto max-w-2xl md:col-span-12'
                  : isRight
                  ? 'text-right ml-auto max-w-2xl md:col-span-7 md:order-2'
                  : hasArtwork && banner.backgroundType !== 'image' && banner.backgroundType !== 'overlay' && !isMobileViewport
                  ? 'text-left md:col-span-7'
                  : 'text-left max-w-2xl md:col-span-12'
              }`}
              style={{ color: textColor }}
            >
              {banner.badgeText && (
                <div
                  className={`flex ${
                    isCentered ? 'justify-center' : isRight ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold shadow-xs"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.16)',
                      border: '1px solid rgba(255,255,255,0.24)',
                      color: textColor,
                    }}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" style={{ color: highlightColor }} />
                    <span>{banner.badgeText}</span>
                  </span>
                </div>
              )}

              <h2
                className="leading-[1.12] tracking-tight text-balance"
                style={{
                  fontSize: compactSidebar
                    ? '1.25rem'
                    : viewport === 'mobile'
                    ? '1.65rem'
                    : banner.bannerSize === 'small'
                    ? '1.5rem'
                    : 'clamp(1.75rem, 3.1vw, 2.85rem)',
                  fontWeight: fontWeightNumber,
                  letterSpacing: `${banner.letterSpacingPx ?? 0}px`,
                }}
              >
                {prefix}
                {highlight && <span style={{ color: highlightColor }}>{highlight}</span>}
                {suffix}
              </h2>

              {banner.subHeading && (
                <p
                  className="text-sm sm:text-base opacity-90 max-w-xl"
                  style={{
                    marginLeft: isCentered || isRight ? 'auto' : undefined,
                    marginRight: isCentered ? 'auto' : undefined,
                    fontWeight: 500,
                  }}
                >
                  {banner.subHeading}
                </p>
              )}

              {ctaButtonElement && (
                <div
                  className={`pt-1 flex ${
                    isCentered ? 'justify-center' : isRight ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {ctaButtonElement}
                </div>
              )}
            </div>

            {/* Split Visual Column when using Solid/Gradient + Image */}
            {hasArtwork &&
              banner.backgroundType !== 'image' &&
              banner.backgroundType !== 'overlay' &&
              !isCentered &&
              !isMobileViewport && (
                <div
                  className={`md:col-span-5 flex justify-center ${
                    isRight ? 'md:order-1' : 'md:order-2'
                  }`}
                >
                  <div className="w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-white/15 bg-black/15">
                    <SafeImage
                      src={banner.desktopImageUrl || banner.mobileImageUrl}
                      alt={banner.altText || banner.mainHeading}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
          </div>

          {/* Linked / Selected Product Showcase Strip */}
          {hasProducts && (
            <div className="pt-2 border-t border-white/15">
              <div
                className={`grid gap-2.5 ${
                  viewport === 'mobile' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {resolvedProducts.slice(0, 4).map((prod) => {
                  const displayPrice =
                    prod.flashSalePrice && prod.flashSalePrice > 0
                      ? prod.flashSalePrice
                      : prod.salePrice && prod.salePrice > 0
                      ? prod.salePrice
                      : prod.basePrice;
                  const cardInner = (
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/95 text-slate-900 shadow-sm hover:bg-white transition-colors">
                      <SafeImage
                        src={prod.images?.[0]?.url}
                        alt={prod.name}
                        className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                        <p className="text-[11px] font-extrabold text-emerald-700 tabular-nums">
                          ৳{Number(displayPrice || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                  return interactiveLinks ? (
                    <Link key={prod._id} to={`/product/${prod.slug}`} className="block">
                      {cardInner}
                    </Link>
                  ) : (
                    <div key={prod._id}>{cardInner}</div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Slide Indicators for Multi-Banner Top Slider */}
          {slideIndicators && slideIndicators.total > 1 && (
            <div className="flex items-center gap-2 pt-1">
              {Array.from({ length: slideIndicators.total }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to banner slide ${idx + 1}`}
                  onClick={() => slideIndicators.onSelect?.(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === slideIndicators.current ? 'w-7 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
