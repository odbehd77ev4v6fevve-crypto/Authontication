import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, Search, X } from 'lucide-react';
import type { MediaAsset } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface ProductGalleryProps {
  images: MediaAsset[];
  productName: string;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  discountPercent?: number;
  isFlashSaleActive?: boolean;
}

export function ProductGallery({
  images,
  productName,
  selectedIndex,
  onSelectIndex,
  discountPercent = 0,
  isFlashSaleActive = false,
}: ProductGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const safeIndex = images.length > 0 ? Math.min(selectedIndex, images.length - 1) : 0;
  const activeImage = images[safeIndex];

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onSelectIndex((safeIndex - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onSelectIndex((safeIndex + 1) % images.length);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, safeIndex, images.length, onSelectIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomOrigin({ x, y });
  };

  const scrollThumbStrip = (dir: 'prev' | 'next') => {
    if (thumbStripRef.current) {
      thumbStripRef.current.scrollBy({
        left: dir === 'next' ? 180 : -180,
        behavior: 'smooth',
      });
    }
    if (images.length > 1) {
      onSelectIndex(
        dir === 'next'
          ? (safeIndex + 1) % images.length
          : (safeIndex - 1 + images.length) % images.length
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Desktop Vertical Rail + Main Image Stage */}
      <div className="flex gap-3 items-start">
        {images.length > 1 && (
          <div
            className="hidden sm:flex flex-col gap-2.5 w-[68px] shrink-0 max-h-[430px] overflow-y-auto pr-0.5"
            aria-label="Product image thumbnails"
          >
            {images.map((img, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={`${img.publicId}-${idx}`}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  aria-label={`View image ${idx + 1} of ${productName}`}
                  aria-current={active ? 'true' : undefined}
                  className={`w-16 h-16 rounded-xl border bg-white overflow-hidden shrink-0 transition-all ${
                    active
                      ? 'border-[#16A34A] ring-2 ring-[#16A34A]/25 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 opacity-85 hover:opacity-100'
                  }`}
                >
                  <SafeImage
                    src={img.url}
                    alt={img.alt || `${productName} thumbnail ${idx + 1}`}
                    fallbackLabel={productName}
                    className="w-full h-full object-contain p-0.5"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Main Gallery Canvas */}
        <div
          onMouseEnter={() => setZoomActive(true)}
          onMouseLeave={() => setZoomActive(false)}
          onMouseMove={handleMouseMove}
          className="relative flex-1 aspect-square rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs group cursor-zoom-in"
        >
          {/* Top-left discount / flash badge */}
          <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1.5">
            {discountPercent > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#15803D] text-white text-xs font-extrabold shadow-xs tabular-nums">
                -{discountPercent}%
              </span>
            )}
            {isFlashSaleActive && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-extrabold shadow-xs">
                Flash Deal
              </span>
            )}
          </div>

          {/* Top-right fullscreen trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(true);
            }}
            aria-label="Open fullscreen product gallery"
            className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-white/95 border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 flex items-center justify-center shadow-xs transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Main Image with interactive cursor-tracking zoom */}
          <div
            onClick={() => setLightboxOpen(true)}
            className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-50/40 to-white"
          >
            {(() => {
              const row = zoomOrigin.y < 33 ? 'top' : zoomOrigin.y > 67 ? 'bottom' : 'center';
              const col = zoomOrigin.x < 33 ? 'left' : zoomOrigin.x > 67 ? 'right' : 'center';
              const ORIGIN_CLASSES: Record<string, string> = {
                'top-left': 'origin-top-left',
                'top-center': 'origin-top',
                'top-right': 'origin-top-right',
                'center-left': 'origin-left',
                'center-center': 'origin-center',
                'center-right': 'origin-right',
                'bottom-left': 'origin-bottom-left',
                'bottom-center': 'origin-bottom',
                'bottom-right': 'origin-bottom-right',
              };
              const originClass = ORIGIN_CLASSES[`${row}-${col}`] || 'origin-center';
              return (
                <SafeImage
                  src={activeImage?.url}
                  alt={activeImage?.alt || productName}
                  fallbackLabel={productName}
                  loading="eager"
                  className={`w-full h-full object-contain p-3 sm:p-5 transition-transform duration-200 ease-out ${originClass} ${
                    zoomActive ? 'scale-[1.7]' : 'scale-100'
                  }`}
                />
              );
            })()}
          </div>

          {/* Bottom Hover-to-zoom pill */}
          <div className="pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 border border-slate-200/90 text-[11px] font-medium text-slate-600 shadow-xs backdrop-blur-xs">
              <Search className="w-3 h-3 text-slate-500" />
              <span>Hover to zoom</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Thumbnail Strip Carousel */}
      {images.length > 1 && (
        <div className="flex items-center gap-2 sm:pl-[80px]">
          <button
            type="button"
            onClick={() => scrollThumbStrip('prev')}
            aria-label="Previous product image"
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={thumbStripRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
          >
            {images.map((img, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={`strip-${img.publicId}-${idx}`}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  aria-label={`Select image ${idx + 1}`}
                  className={`w-16 h-16 rounded-xl border bg-white overflow-hidden shrink-0 transition-all ${
                    active
                      ? 'border-[#16A34A] ring-2 ring-[#16A34A]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <SafeImage
                    src={img.url}
                    alt={img.alt || `${productName} view ${idx + 1}`}
                    fallbackLabel={productName}
                    className="w-full h-full object-contain p-0.5"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollThumbStrip('next')}
            aria-label="Next product image"
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 shadow-2xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Accessible Fullscreen Lightbox Modal */}
      {lightboxOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${productName} image gallery`}
            className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-xs flex flex-col justify-between p-4 sm:p-6"
            onClick={() => setLightboxOpen(false)}
          >
          <div
            className="flex items-center justify-between text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold truncate max-w-lg">
              {productName}{' '}
              {images.length > 1 && (
                <span className="text-slate-400 font-mono text-xs ml-2">
                  {safeIndex + 1} / {images.length}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close fullscreen gallery"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => onSelectIndex((safeIndex - 1 + images.length) % images.length)}
                aria-label="Previous gallery image"
                className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="max-w-4xl max-h-[75vh] w-full h-full flex items-center justify-center bg-white rounded-2xl p-6">
              <SafeImage
                src={activeImage?.url}
                alt={activeImage?.alt || productName}
                fallbackLabel={productName}
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>

            {images.length > 1 && (
              <button
                type="button"
                onClick={() => onSelectIndex((safeIndex + 1) % images.length)}
                aria-label="Next gallery image"
                className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto pb-1"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={`lb-${img.publicId}-${idx}`}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  aria-label={`Lightbox image ${idx + 1}`}
                  className={`w-14 h-14 rounded-lg bg-white overflow-hidden shrink-0 border-2 ${
                    idx === safeIndex ? 'border-emerald-400' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <SafeImage
                    src={img.url}
                    alt={img.alt || productName}
                    className="w-full h-full object-contain p-1"
                  />
                </button>
              ))}
            </div>
          )}
          </div>,
          document.body
        )}
    </div>
  );
}
