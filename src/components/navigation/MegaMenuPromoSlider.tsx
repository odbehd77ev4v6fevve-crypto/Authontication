import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sanitizeHref } from '../../../shared/security.ts';
import type { MegaMenuSlideRecord, MegaMenuSliderSettings } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface MegaMenuPromoSliderProps {
  slides: MegaMenuSlideRecord[];
  sliderSettings?: MegaMenuSliderSettings;
  compact?: boolean;
  onNavigate?: () => void;
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function MegaMenuPromoSlider({
  slides,
  sliderSettings,
  compact = false,
  onNavigate,
}: MegaMenuPromoSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const settings: MegaMenuSliderSettings = useMemo(
    () => ({
      autoplay: sliderSettings?.autoplay ?? true,
      pauseOnHover: sliderSettings?.pauseOnHover ?? true,
      loop: sliderSettings?.loop ?? true,
      intervalMs: sliderSettings?.intervalMs ?? 4500,
      showArrows: sliderSettings?.showArrows ?? true,
      showDots: sliderSettings?.showDots ?? true,
      transitionEffect: sliderSettings?.transitionEffect ?? 'fade',
    }),
    [sliderSettings]
  );

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (!settings.autoplay || slides.length <= 1) return;
    if (settings.pauseOnHover && paused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        if (prev + 1 < slides.length) return prev + 1;
        return settings.loop ? 0 : prev;
      });
    }, Math.max(1500, settings.intervalMs));

    return () => window.clearInterval(timer);
  }, [settings.autoplay, settings.pauseOnHover, settings.loop, settings.intervalMs, paused, slides.length]);

  if (!slides.length) {
    return null;
  }

  const slide = slides[activeIndex] || slides[0];
  const safeCtaUrl = sanitizeHref(slide.ctaUrl) || '/shop';
  const desktopImg = sanitizeHref(slide.desktopImageUrl);
  const mobileImg = sanitizeHref(slide.mobileImageUrl) || desktopImg;
  const activeImg = compact ? mobileImg : desktopImg;

  const goPrev = () => {
    setActiveIndex((prev) => {
      if (prev > 0) return prev - 1;
      return settings.loop ? slides.length - 1 : 0;
    });
  };

  const goNext = () => {
    setActiveIndex((prev) => {
      if (prev + 1 < slides.length) return prev + 1;
      return settings.loop ? 0 : slides.length - 1;
    });
  };

  const renderCta = () => {
    if (!slide.ctaLabel) return null;
    const btnStyle = {
      backgroundColor: slide.buttonBgColor || '#16A34A',
      color: slide.buttonTextColor || '#FFFFFF',
    };
    const className =
      'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shadow-sm hover:brightness-95 transition-all';

    if (slide.openInNewTab || isExternalUrl(safeCtaUrl)) {
      return (
        <a
          href={safeCtaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={btnStyle}
          onClick={onNavigate}
          className={className}
        >
          <span>{slide.ctaLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      );
    }

    return (
      <Link to={safeCtaUrl} style={btnStyle} onClick={onNavigate} className={className}>
        <span>{slide.ctaLabel}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  };

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ borderRadius: `${slide.borderRadiusPx ?? 16}px` }}
      className={`relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-[#F0FDF4] via-[#DCFCE7] to-[#D9F99D]/75 border border-emerald-200/70 select-none ${
        compact ? 'min-h-[210px] p-4' : 'h-full min-h-[380px] p-5'
      }`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Mega menu promotional offers"
    >
      {/* Background Cover Image when imagePosition === 'cover' */}
      {activeImg && slide.imagePosition === 'cover' && (
        <SafeImage
          src={activeImg}
          alt={slide.altText || slide.mainHeading}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Optional color overlay */}
      {slide.overlayOpacity > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: slide.overlayColor || '#DCFCE7',
            opacity: Math.min(0.95, Math.max(0, slide.overlayOpacity / 100)),
          }}
        />
      )}

      {/* Decorative fresh organic corner highlight matching reference */}
      <div
        aria-hidden="true"
        className="absolute -right-12 -bottom-12 w-56 h-56 rounded-full bg-[#84CC16]/20 blur-2xl pointer-events-none"
      />

      {/* Top Header Row: Special Offer Badge + Prev/Next Circular Arrows */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        {slide.badgeText ? (
          <span
            style={{
              backgroundColor: slide.badgeBgColor || '#16A34A',
              color: slide.badgeTextColor || '#FFFFFF',
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs"
          >
            <Star className="w-3 h-3 fill-current" />
            <span>{slide.badgeText}</span>
          </span>
        ) : (
          <span />
        )}

        {settings.showArrows && slides.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous promotional slide"
              className="w-7 h-7 rounded-full bg-[#14532D] hover:bg-[#16A34A] text-white flex items-center justify-center shadow-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next promotional slide"
              className="w-7 h-7 rounded-full bg-[#14532D] hover:bg-[#16A34A] text-white flex items-center justify-center shadow-sm transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Middle Text & CTA Section */}
      <div
        className={`relative z-10 mt-3 flex-1 flex flex-col justify-start ${
          slide.textAlign === 'center'
            ? 'items-center text-center'
            : slide.textAlign === 'right'
            ? 'items-end text-right'
            : 'items-start text-left'
        }`}
      >
        <h3
          style={{ color: slide.textColor || '#0F172A' }}
          className={`${compact ? 'text-lg' : 'text-[22px]'} font-extrabold leading-[1.15] tracking-tight`}
        >
          {slide.mainHeading}
          {slide.highlightText && (
            <span
              className="block"
              style={{ color: slide.highlightColor || '#16A34A' }}
            >
              {slide.highlightText}
            </span>
          )}
        </h3>

        {(slide.discountText || slide.description) && (
          <div className="mt-2.5 space-y-0.5">
            {slide.discountText && (
              <p
                style={{ color: slide.textColor || '#0F172A' }}
                className={`${compact ? 'text-xs' : 'text-sm'} font-bold`}
              >
                <span style={{ color: slide.highlightColor || '#16A34A' }} className="text-xl font-black">
                  {slide.discountText}
                </span>
              </p>
            )}
            {slide.description && (
              <p
                style={{ color: slide.textColor || '#334155' }}
                className="text-xs font-semibold opacity-85 max-w-[220px]"
              >
                {slide.description}
              </p>
            )}
          </div>
        )}

        <div className="mt-3">{renderCta()}</div>
      </div>

      {/* Product / Showcase Image positioned bottom-right or right matching reference */}
      {activeImg && slide.imagePosition !== 'cover' && (
        <div
          className={`relative z-0 mt-2 ${
            slide.imagePosition === 'center'
              ? 'mx-auto w-36 h-28'
              : 'ml-auto w-44 h-32 sm:w-48 sm:h-36'
          } rounded-2xl overflow-hidden bg-white/90 border border-white shadow-lg p-1.5`}
        >
          <SafeImage
            src={activeImg}
            alt={slide.altText || slide.mainHeading}
            loading="lazy"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
      )}

      {/* Bottom Pagination Dots */}
      {settings.showDots && slides.length > 1 && (
        <div className="relative z-10 flex items-center justify-center gap-1.5 pt-2.5">
          {slides.map((s, idx) => (
            <button
              key={s._id || idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`View slide ${idx + 1}`}
              aria-current={idx === activeIndex ? 'true' : undefined}
              className={`h-2 rounded-full transition-all ${
                idx === activeIndex
                  ? 'w-4 bg-[#16A34A]'
                  : 'w-2 bg-white/85 hover:bg-white border border-emerald-300/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
