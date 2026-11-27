import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  filterAndSortActiveBanners,
  type BannerDraftConfig,
  type BannerPositionSlot,
} from '../../../shared/bannerHelpers.ts';
import { apiRequest } from '../../lib/api.ts';
import type { DynamicBannerRecord } from '../../types/domain.ts';
import { LiveBannerPreview } from '../admin/banner/LiveBannerPreview.tsx';

interface BannerRendererProps {
  position: BannerPositionSlot;
  categorySlug?: string;
  pageSlug?: string;
  className?: string;
  compactSidebar?: boolean;
  initialBanners?: DynamicBannerRecord[];
}

function recordToBannerDraft(item: DynamicBannerRecord): BannerDraftConfig {
  return {
    ...item,
    position: item.position as BannerPositionSlot,
    desktopImagePublicId: item.desktopImagePublicId || '',
    mobileImagePublicId: item.mobileImagePublicId || '',
  };
}

export function BannerRenderer({
  position,
  categorySlug,
  pageSlug,
  className = '',
  compactSidebar = false,
  initialBanners,
}: BannerRendererProps) {
  const [fetchedBanners, setFetchedBanners] = useState<DynamicBannerRecord[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (initialBanners !== undefined) return;

    let active = true;
    const params = new URLSearchParams({ position, includeProducts: 'true' });
    if (categorySlug) params.set('categorySlug', categorySlug);
    if (pageSlug) params.set('pageSlug', pageSlug);

    apiRequest<{ banners: DynamicBannerRecord[] }>(`/api/cms/public/banners?${params.toString()}`)
      .then((res) => {
        if (active) setFetchedBanners(res.banners || []);
      })
      .catch(() => {
        if (active) setFetchedBanners([]);
      });

    return () => {
      active = false;
    };
  }, [position, categorySlug, pageSlug, initialBanners]);

  const activeBanners = useMemo(() => {
    const source = initialBanners !== undefined ? initialBanners : fetchedBanners;
    return filterAndSortActiveBanners(source, {
      position,
      categorySlug,
      pageSlug,
    });
  }, [initialBanners, fetchedBanners, position, categorySlug, pageSlug]);

  useEffect(() => {
    setSlideIndex(0);
  }, [position, activeBanners.length]);

  const isCarouselMode =
    activeBanners.length > 1 &&
    (position === 'homepage_top_slider' || activeBanners.some((b) => b.autoPlay));

  const currentSlide = activeBanners[slideIndex % Math.max(1, activeBanners.length)];

  useEffect(() => {
    if (!isCarouselMode || paused || activeBanners.length <= 1 || !currentSlide?.autoPlay) {
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const delayMs = Math.max(1, Number(currentSlide.animationDelaySec || 3)) * 1000;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => {
        const next = prev + 1;
        if (next >= activeBanners.length) {
          return currentSlide.loop === false ? prev : 0;
        }
        return next;
      });
    }, delayMs);

    return () => window.clearInterval(timer);
  }, [isCarouselMode, paused, activeBanners.length, currentSlide]);

  if (activeBanners.length === 0) {
    return null;
  }

  if (isCarouselMode && currentSlide) {
    const idx = slideIndex % activeBanners.length;
    return (
      <section
        aria-label={`Promotional banner slider for ${position.replace(/_/g, ' ')}`}
        className={`relative group ${className}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <LiveBannerPreview
          banner={recordToBannerDraft(currentSlide)}
          resolvedProducts={currentSlide.resolvedProducts || []}
          interactiveLinks
          compactSidebar={compactSidebar}
          slideIndicators={{
            total: activeBanners.length,
            current: idx,
            onSelect: (nextIdx) => setSlideIndex(nextIdx),
          }}
        />

        {activeBanners.length > 1 && !compactSidebar && (
          <>
            <button
              type="button"
              aria-label="Previous promotional banner"
              onClick={() =>
                setSlideIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)
              }
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-950/35 hover:bg-slate-950/60 text-white items-center justify-center backdrop-blur-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Next promotional banner"
              onClick={() => setSlideIndex((prev) => (prev + 1) % activeBanners.length)}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-950/35 hover:bg-slate-950/60 text-white items-center justify-center backdrop-blur-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {activeBanners.map((banner) => (
        <LiveBannerPreview
          key={banner._id}
          banner={recordToBannerDraft(banner)}
          resolvedProducts={banner.resolvedProducts || []}
          interactiveLinks
          compactSidebar={compactSidebar}
        />
      ))}
    </div>
  );
}
