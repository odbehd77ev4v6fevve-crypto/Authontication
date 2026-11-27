import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeHexColor } from '../../../shared/bannerHelpers.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import {
  filterAndSortActiveSlides,
  getNextSlideIndex,
  getPrevSlideIndex,
  getSlideshowOverlayCss,
  getSpeedDurationMs,
  splitHeadingForHighlight,
  type SlideshowConfig,
  type SlideshowPlacement,
  type SlideshowSlideConfig,
} from '../../../shared/slideshowHelpers.ts';
import { apiRequest } from '../../lib/api.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface PageSlideshowProps {
  placement: SlideshowPlacement;
  /** Optional explicit slideshow config (used in Admin Live Preview or preloaded SSR/parent). */
  slideshow?: SlideshowConfig | null;
  /** Optional active slide override when previewing a single slide in Admin Creator. */
  previewSlide?: SlideshowSlideConfig | null;
  /** Optional forced viewport height override for Admin Desktop/Tablet/Mobile preview mode. */
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
  /** If true, disables external navigation (for safe interactive testing inside Admin Creator). */
  disableNavigation?: boolean;
  /** Called once public API finishes loading with whether an active slideshow with slides exists. */
  onAvailabilityChange?: (hasActiveSlideshow: boolean) => void;
  className?: string;
}

function isExternalHref(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function resolveSlideImageObjectPosition(pos?: SlideshowSlideConfig['imagePosition']): string {
  switch (pos) {
    case 'top':
      return 'object-top';
    case 'bottom':
      return 'object-bottom';
    case 'left':
      return 'object-left';
    case 'right':
      return 'object-right';
    default:
      return 'object-center';
  }
}

export function PageSlideshow({
  placement,
  slideshow: explicitSlideshow,
  previewSlide,
  previewViewport,
  disableNavigation = false,
  onAvailabilityChange,
  className = '',
}: PageSlideshowProps) {
  const [fetchedSlideshow, setFetchedSlideshow] = useState<SlideshowConfig | null>(null);
  const [loaded, setLoaded] = useState(explicitSlideshow !== undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (explicitSlideshow !== undefined) {
      setLoaded(true);
      return;
    }

    let active = true;
    apiRequest<{ slideshow: SlideshowConfig | null }>(
      `/api/public/slideshows/${encodeURIComponent(placement)}`
    )
      .then((res) => {
        if (!active) return;
        const sh = res.slideshow || null;
        setFetchedSlideshow(sh);
        setLoaded(true);
        const count = filterAndSortActiveSlides(sh?.slides || []).length;
        onAvailabilityChange?.(Boolean(sh?.isActive && count > 0));
      })
      .catch(() => {
        if (!active) return;
        setFetchedSlideshow(null);
        setLoaded(true);
        onAvailabilityChange?.(false);
      });

    return () => {
      active = false;
    };
  }, [placement, explicitSlideshow, onAvailabilityChange]);

  const effectiveSlideshow = explicitSlideshow !== undefined ? explicitSlideshow : fetchedSlideshow;

  const slides = useMemo(() => {
    if (previewSlide) return [previewSlide];
    if (!effectiveSlideshow) return [];
    // In explicit admin slideshow preview, if status/schedule hides all, fall back safely unless public
    if (explicitSlideshow !== undefined) {
      return [...(effectiveSlideshow.slides || [])].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      );
    }
    if (!effectiveSlideshow.isActive) return [];
    return filterAndSortActiveSlides(effectiveSlideshow.slides || []);
  }, [effectiveSlideshow, previewSlide, explicitSlideshow]);

  useEffect(() => {
    setCurrentIndex((prev) => (slides.length === 0 ? 0 : prev % slides.length));
  }, [slides.length]);

  const activeSlide = slides[currentIndex] || slides[0];
  const loopEnabled = effectiveSlideshow?.infiniteLoop ?? true;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => getNextSlideIndex(prev, slides.length, loopEnabled));
  }, [slides.length, loopEnabled]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => getPrevSlideIndex(prev, slides.length, loopEnabled));
  }, [slides.length, loopEnabled]);

  useEffect(() => {
    if (!effectiveSlideshow?.autoplay || slides.length <= 1 || previewSlide) return;
    if (effectiveSlideshow.pauseOnHover && paused) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const intervalMs = Math.max(1500, Number(effectiveSlideshow.autoplayIntervalMs || 5000));
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (!loopEnabled && prev >= slides.length - 1) return prev;
        return getNextSlideIndex(prev, slides.length, loopEnabled);
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    effectiveSlideshow?.autoplay,
    effectiveSlideshow?.pauseOnHover,
    effectiveSlideshow?.autoplayIntervalMs,
    loopEnabled,
    paused,
    slides.length,
    previewSlide,
  ]);

  if (!loaded && explicitSlideshow === undefined) {
    return null;
  }

  if (!activeSlide) {
    return null;
  }

  const transitionEffect =
    activeSlide.animationEffect && activeSlide.animationEffect !== 'fade'
      ? activeSlide.animationEffect
      : effectiveSlideshow?.transitionEffect || activeSlide.animationEffect || 'fade';

  const durationMs = getSpeedDurationMs(
    effectiveSlideshow?.animationSpeed,
    activeSlide.animationDurationMs || effectiveSlideshow?.transitionDurationMs
  );

  const desktopH = effectiveSlideshow?.desktopHeightPx || (placement === 'homepage' ? 480 : 240);
  const tabletH = effectiveSlideshow?.tabletHeightPx || (placement === 'homepage' ? 380 : 210);
  const mobileH = effectiveSlideshow?.mobileHeightPx || (placement === 'homepage' ? 320 : 185);
  const borderRadius = effectiveSlideshow?.borderRadiusPx ?? 20;
  const isCompact = Boolean(effectiveSlideshow?.compactMode || placement === 'checkout' || placement === 'cart');

  const frameStyle: CSSProperties & Record<string, string | number> = {
    borderRadius: `${borderRadius}px`,
    '--sh-dur': `${durationMs}ms`,
    '--sh-h-desktop': `${desktopH}px`,
    '--sh-h-tablet': `${tabletH}px`,
    '--sh-h-mobile': `${mobileH}px`,
  };

  if (previewViewport === 'mobile') {
    frameStyle.height = `${mobileH}px`;
  } else if (previewViewport === 'tablet') {
    frameStyle.height = `${tabletH}px`;
  } else if (previewViewport === 'desktop') {
    frameStyle.height = `${desktopH}px`;
  }

  const headingParts = splitHeadingForHighlight(activeSlide.mainHeading, activeSlide.highlightText);
  const safeSlideUrl = !disableNavigation ? sanitizeHref(activeSlide.destinationUrl) : null;
  const safePrimaryUrl = !disableNavigation ? sanitizeHref(activeSlide.primaryButtonUrl) : null;
  const safeSecondaryUrl = !disableNavigation ? sanitizeHref(activeSlide.secondaryButtonUrl) : null;

  const hAlignClass =
    activeSlide.horizontalAlign === 'center'
      ? 'items-center text-center mx-auto'
      : activeSlide.horizontalAlign === 'right'
      ? 'items-end text-right ml-auto'
      : 'items-start text-left mr-auto';

  const vAlignClass =
    activeSlide.verticalAlign === 'top'
      ? 'justify-start'
      : activeSlide.verticalAlign === 'bottom'
      ? 'justify-end'
      : 'justify-center';

  const animClass =
    transitionEffect === 'ken_burns'
      ? 'animate-slideshow-ken-burns'
      : transitionEffect === 'zoom' || transitionEffect === 'zoom_in'
      ? 'animate-slideshow-zoom-in'
      : transitionEffect === 'zoom_out'
      ? 'animate-slideshow-zoom-out'
      : transitionEffect === 'slide'
      ? 'animate-slideshow-slide-in'
      : '';

  const showArrows =
    (effectiveSlideshow?.showArrows ?? true) && slides.length > 1;
  const indicatorStyle = effectiveSlideshow?.indicatorStyle || 'dots';
  const showIndicators =
    (effectiveSlideshow?.showIndicators ?? true) &&
    indicatorStyle !== 'none' &&
    slides.length > 1;

  const renderCtaLink = (
    text: string,
    href: string | null,
    rawUrl: string,
    newTab: boolean,
    style: CSSProperties,
    variant: 'primary' | 'secondary'
  ) => {
    if (!text.trim()) return null;
    const baseCls =
      variant === 'primary'
        ? 'pointer-events-auto inline-flex items-center gap-2 rounded-full font-bold shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]'
        : 'pointer-events-auto inline-flex items-center gap-2 rounded-full font-bold border border-white/40 backdrop-blur-xs transition-colors hover:bg-white/20';

    const sizeCls = isCompact ? 'px-4 py-2 text-xs' : 'px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm';

    const content = (
      <>
        <span>{text}</span>
        {variant === 'primary' && <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      </>
    );

    if (disableNavigation || !href) {
      return (
        <span className={`${baseCls} ${sizeCls}`} style={style}>
          {content}
        </span>
      );
    }

    if (newTab || isExternalHref(rawUrl)) {
      return (
        <a
          href={href}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
          onClick={(e) => e.stopPropagation()}
          className={`${baseCls} ${sizeCls}`}
          style={style}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        to={href}
        onClick={(e) => e.stopPropagation()}
        className={`${baseCls} ${sizeCls}`}
        style={style}
      >
        {content}
      </Link>
    );
  };

  const responsiveHeadingSize =
    previewViewport === 'mobile'
      ? Math.max(18, Math.round((activeSlide.headingSizePx || 44) * 0.56))
      : previewViewport === 'tablet'
      ? Math.max(22, Math.round((activeSlide.headingSizePx || 44) * 0.78))
      : activeSlide.headingSizePx || (isCompact ? 26 : 44);

  const responsiveSubtitleSize =
    previewViewport === 'mobile'
      ? Math.max(12, Math.round((activeSlide.subtitleSizePx || 16) * 0.85))
      : activeSlide.subtitleSizePx || (isCompact ? 14 : 17);

  return (
    <div className={className || undefined}>
      <section
        data-testid={`page-slideshow-${placement}`}
        aria-roledescription="carousel"
        aria-label={effectiveSlideshow?.name || `${placement} slideshow`}
        className={`relative w-full overflow-hidden shadow-sm select-none group ${
          previewViewport ? '' : 'page-slideshow-frame'
        }`}
        style={frameStyle}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || slides.length <= 1) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) >= 40) {
          if (delta < 0) goNext();
          else goPrev();
        }
      }}
    >
      {/* Full-Bleed Background Image Layer (No split layout) */}
      <div
        key={`${activeSlide._id || currentIndex}-${transitionEffect}`}
        className={`absolute inset-0 ${transitionEffect !== 'ken_burns' ? animClass : ''}`}
      >
        <picture className="block w-full h-full">
          {activeSlide.mobileImageUrl && (
            <source media="(max-width: 767px)" srcSet={activeSlide.mobileImageUrl} />
          )}
          <SafeImage
            src={
              previewViewport === 'mobile' && activeSlide.mobileImageUrl
                ? activeSlide.mobileImageUrl
                : activeSlide.desktopImageUrl
            }
            alt={activeSlide.altText || activeSlide.mainHeading}
            loading="eager"
            className={`w-full h-full object-cover ${resolveSlideImageObjectPosition(
              activeSlide.imagePosition
            )} ${transitionEffect === 'ken_burns' ? 'animate-slideshow-ken-burns' : ''}`}
          />
        </picture>

        {/* Configurable Overlay Scrim (Solid or Gradient) */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300"
          style={{
            background: getSlideshowOverlayCss(activeSlide),
            backdropFilter:
              activeSlide.blurPx && activeSlide.blurPx > 0
                ? `blur(${activeSlide.blurPx}px)`
                : undefined,
          }}
        />
      </div>

      {/* Full-Slide Clickable Navigation Overlay (Strict URL safety; never cursor-pointer without URL) */}
      {safeSlideUrl && (
        isExternalHref(activeSlide.destinationUrl) || activeSlide.destinationNewTab ? (
          <a
            href={safeSlideUrl}
            target={activeSlide.destinationNewTab ? '_blank' : undefined}
            rel={activeSlide.destinationNewTab ? 'noopener noreferrer' : undefined}
            aria-label={`${activeSlide.mainHeading} — open destination`}
            className="absolute inset-0 z-10 cursor-pointer"
          />
        ) : (
          <Link
            to={safeSlideUrl}
            aria-label={`${activeSlide.mainHeading} — open destination`}
            className="absolute inset-0 z-10 cursor-pointer"
          />
        )
      )}

      {/* Content Overlay Layer (Safe side clearance for vertically-centered arrows) */}
      <div
        className={`relative z-20 h-full w-full flex flex-col pointer-events-none ${vAlignClass} ${
          showArrows ? 'px-14 sm:px-20' : 'px-6 sm:px-10'
        }`}
        style={{
          paddingTop: `${Math.min(activeSlide.paddingPx || 32, isCompact ? 24 : 48)}px`,
          paddingBottom: `${Math.min(activeSlide.paddingPx || 32, isCompact ? 28 : 52)}px`,
          fontFamily: activeSlide.fontFamily || 'Poppins',
        }}
      >
        <div
          className={`flex flex-col gap-2 sm:gap-3 w-full ${hAlignClass}`}
          style={{
            maxWidth: `${activeSlide.contentMaxWidthPx || 620}px`,
            color: normalizeHexColor(activeSlide.textColor, '#FFFFFF'),
          }}
        >
          {activeSlide.badgeText && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm text-[11px] sm:text-xs font-bold tracking-wide text-white w-fit">
              {activeSlide.badgeText}
            </span>
          )}

          <h2
            className="tracking-tight text-balance drop-shadow-sm"
            style={{
              fontWeight: activeSlide.fontWeight || '700',
              fontSize: `clamp(1.25rem, 3.2vw, ${responsiveHeadingSize}px)`,
              lineHeight: activeSlide.lineHeight || 1.15,
              letterSpacing: `${activeSlide.letterSpacingPx || 0}px`,
              color: normalizeHexColor(activeSlide.textColor, '#FFFFFF'),
            }}
          >
            {headingParts.prefix}
            {headingParts.highlight && (
              <>
                {headingParts.prefix ? ' ' : ''}
                <span style={{ color: normalizeHexColor(activeSlide.highlightColor, '#A3E635') }}>
                  {headingParts.highlight}
                </span>
                {headingParts.suffix ? ' ' : ''}
              </>
            )}
            {headingParts.suffix}
          </h2>

          {activeSlide.subtitle && (
            <p
              className="opacity-95 font-medium max-w-2xl drop-shadow-xs line-clamp-2"
              style={{ fontSize: `clamp(0.8rem, 1.5vw, ${responsiveSubtitleSize}px)` }}
            >
              {activeSlide.subtitle}
            </p>
          )}

          {activeSlide.description && !isCompact && (
            <p className="text-xs sm:text-sm opacity-85 max-w-xl line-clamp-2">
              {activeSlide.description}
            </p>
          )}

          {(activeSlide.primaryButtonText || activeSlide.secondaryButtonText) && (
            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              {renderCtaLink(
                activeSlide.primaryButtonText,
                safePrimaryUrl || null,
                activeSlide.primaryButtonUrl,
                activeSlide.primaryButtonNewTab,
                {
                  backgroundColor: normalizeHexColor(activeSlide.primaryBtnBg, '#A3E635'),
                  color: normalizeHexColor(activeSlide.primaryBtnText, '#0F172A'),
                },
                'primary'
              )}
              {renderCtaLink(
                activeSlide.secondaryButtonText,
                safeSecondaryUrl || null,
                activeSlide.secondaryButtonUrl,
                activeSlide.secondaryButtonNewTab,
                {
                  backgroundColor: `${normalizeHexColor(activeSlide.secondaryBtnBg, '#FFFFFF')}22`,
                  color: normalizeHexColor(activeSlide.secondaryBtnText, '#FFFFFF'),
                },
                'secondary'
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Vertically-Centered Left & Right Circular Navigation Arrows */}
      {showArrows && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            disabled={!loopEnabled && currentIndex === 0}
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className={`absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-30 rounded-full bg-slate-950/45 hover:bg-[#16A34A] text-white border border-white/25 backdrop-blur-md shadow-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35 disabled:cursor-not-allowed ${
              isCompact ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-9 h-9 sm:w-11 sm:h-11'
            }`}
          >
            <ChevronLeft className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
          </button>

          <button
            type="button"
            aria-label="Next slide"
            disabled={!loopEnabled && currentIndex >= slides.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className={`absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-30 rounded-full bg-slate-950/45 hover:bg-[#16A34A] text-white border border-white/25 backdrop-blur-md shadow-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35 disabled:cursor-not-allowed ${
              isCompact ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-9 h-9 sm:w-11 sm:h-11'
            }`}
          >
            <ChevronRight className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
          </button>
        </>
      )}

      {/* Configurable Navigation Indicators */}
      {showIndicators && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 max-w-[90%]"
          onClick={(e) => e.stopPropagation()}
        >
          {indicatorStyle === 'dots' &&
            slides.map((s, idx) => (
              <button
                key={s._id || idx}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={idx === currentIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  idx === currentIndex
                    ? 'w-7 bg-[#A3E635] shadow-xs'
                    : 'w-2 bg-white/55 hover:bg-white/85'
                }`}
              />
            ))}

          {indicatorStyle === 'progress' && (
            <div className="flex items-center gap-1.5 bg-slate-950/35 backdrop-blur-xs px-2.5 py-1.5 rounded-full">
              {slides.map((s, idx) => (
                <button
                  key={s._id || idx}
                  type="button"
                  aria-label={`Slide ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className="w-8 sm:w-12 h-1.5 rounded-full bg-white/30 overflow-hidden"
                >
                  <span
                    className={`block h-full rounded-full transition-all ${
                      idx === currentIndex
                        ? 'w-full bg-[#A3E635]'
                        : idx < currentIndex
                        ? 'w-full bg-white/80'
                        : 'w-0'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          {indicatorStyle === 'numbers' && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/55 border border-white/20 backdrop-blur-md text-[11px] font-bold text-white tabular-nums">
              {slides.map((s, idx) => (
                <button
                  key={s._id || idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                    idx === currentIndex ? 'bg-[#A3E635] text-slate-950' : 'text-white/80 hover:bg-white/15'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}

          {indicatorStyle === 'thumbnails' && (
            <div className="flex items-center gap-1.5 bg-slate-950/45 backdrop-blur-md p-1 rounded-xl border border-white/20">
              {slides.map((s, idx) => (
                <button
                  key={s._id || idx}
                  type="button"
                  aria-label={`Preview slide ${idx + 1}: ${s.mainHeading}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-10 h-6 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentIndex
                      ? 'border-[#A3E635] scale-105'
                      : 'border-transparent opacity-65 hover:opacity-100'
                  }`}
                >
                  <SafeImage
                    src={s.desktopImageUrl}
                    alt={s.altText || s.mainHeading}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      </section>
    </div>
  );
}
