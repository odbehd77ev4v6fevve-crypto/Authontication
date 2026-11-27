import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sanitizeHref } from '../../../shared/security.ts';
import { apiRequest } from '../../lib/api.ts';
import type { Advertisement } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface AdvertisementBannerProps {
  placement: Advertisement['placement'];
  className?: string;
}

function isExternalHref(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function AdvertisementBanner({ placement, className = '' }: AdvertisementBannerProps) {
  const [ad, setAd] = useState<Advertisement | null>(null);
  const trackedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    apiRequest<{ ads: Advertisement[] }>(
      `/api/marketing/public/ads?placement=${encodeURIComponent(placement)}`
    )
      .then((res) => {
        if (!active) return;
        const firstAd = (res.ads || [])[0] || null;
        setAd(firstAd);
      })
      .catch(() => {
        if (active) setAd(null);
      });
    return () => {
      active = false;
    };
  }, [placement]);

  useEffect(() => {
    if (!ad?._id || trackedRef.current.has(ad._id)) return;
    trackedRef.current.add(ad._id);
    void apiRequest(`/api/marketing/public/ads/${ad._id}/track`, {
      method: 'POST',
      body: JSON.stringify({ action: 'impression' }),
    }).catch(() => {});
  }, [ad?._id]);

  if (!ad) return null;

  const destination = sanitizeHref(ad.targetUrl) || '/shop';
  const handleTrackClick = () => {
    void apiRequest(`/api/marketing/public/ads/${ad._id}/track`, {
      method: 'POST',
      body: JSON.stringify({ action: 'click' }),
    }).catch(() => {});
  };

  const innerContent = (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs group">
      <picture>
        {ad.mobileImageUrl && (
          <source media="(max-width: 767px)" srcSet={ad.mobileImageUrl} />
        )}
        <SafeImage
          src={ad.desktopImageUrl}
          alt={ad.altText || ad.title}
          className="w-full max-h-48 sm:max-h-56 object-cover group-hover:scale-[1.01] transition-transform duration-300"
        />
      </picture>
      <span className="sr-only">{ad.title}</span>
    </div>
  );

  return (
    <aside aria-label={ad.title} className={className}>
      {isExternalHref(destination) ? (
        <a
          href={destination}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleTrackClick}
          className="block"
        >
          {innerContent}
        </a>
      ) : (
        <Link to={destination} onClick={handleTrackClick} className="block">
          {innerContent}
        </Link>
      )}
    </aside>
  );
}
