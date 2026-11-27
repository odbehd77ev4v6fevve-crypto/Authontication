import { useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { BANNER_POSITION_OPTIONS, type BannerDraftConfig } from '../../../../shared/bannerHelpers.ts';
import type { BannerResolvedProduct } from '../../../types/domain.ts';
import { Modal } from '../../ui/Modal.tsx';
import { LiveBannerPreview } from './LiveBannerPreview.tsx';

interface BannerPreviewModalProps {
  open: boolean;
  onClose: () => void;
  banner: BannerDraftConfig;
  resolvedProducts?: BannerResolvedProduct[];
}

export function BannerPreviewModal({
  open,
  onClose,
  banner,
  resolvedProducts = [],
}: BannerPreviewModalProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const posMeta = BANNER_POSITION_OPTIONS.find((p) => p.value === banner.position);

  return (
    <Modal open={open} onClose={onClose} title="Interactive Storefront Banner Preview" maxWidthClass="max-w-5xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900">{banner.name || banner.mainHeading}</span>
            <span className="mx-2 text-slate-300">·</span>
            <span>{posMeta?.label || banner.position}</span>
            <span className="mx-2 text-slate-300">·</span>
            <span>{banner.isActive && banner.status === 'published' ? 'Live Eligible' : banner.status}</span>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {(
              [
                ['desktop', 'Desktop', Monitor],
                ['tablet', 'Tablet', Tablet],
                ['mobile', 'Mobile', Smartphone],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewport(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewport === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-100/80 rounded-2xl p-4 sm:p-6 border border-slate-200 overflow-x-auto">
          <LiveBannerPreview
            banner={banner}
            resolvedProducts={resolvedProducts}
            viewport={viewport}
            slideIndicators={
              banner.position === 'homepage_top_slider'
                ? { total: 3, current: 0 }
                : undefined
            }
          />
        </div>
      </div>
    </Modal>
  );
}
