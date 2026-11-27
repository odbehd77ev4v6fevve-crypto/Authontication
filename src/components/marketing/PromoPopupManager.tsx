import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Sparkles, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { shouldShowPopup } from '../../../shared/adminAnalytics.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { PromoPopup } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

const DISMISSED_STORAGE_KEY = 'novara_popup_dismissed';
const SESSION_SHOWN_KEY = 'novara_popup_session';

function readDismissedMap(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDismissedPopup(popupId: string) {
  try {
    const current = readDismissedMap();
    current[popupId] = Date.now();
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage denial
  }
}

function readSessionShownIds(): string[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_SHOWN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordSessionShown(popupId: string) {
  try {
    const current = readSessionShownIds();
    if (!current.includes(popupId)) {
      window.sessionStorage.setItem(SESSION_SHOWN_KEY, JSON.stringify([...current, popupId]));
    }
  } catch {
    // ignore storage denial
  }
}

export function PromoPopupManager() {
  const location = useLocation();
  const dispatch = useAppDispatch();

  const [popups, setPopups] = useState<PromoPopup[]>([]);
  const [activePopup, setActivePopup] = useState<PromoPopup | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    apiRequest<{ popups: PromoPopup[] }>('/api/marketing/public/popups')
      .then((res) => {
        setPopups(res.popups || []);
      })
      .catch(() => {
        // Silent fallback when DB is unconfigured
      });
  }, []);

  useEffect(() => {
    setActivePopup(null);
    setCopiedCode(false);

    if (location.pathname.startsWith('/admin') || popups.length === 0) {
      return;
    }

    const dismissedMap = readDismissedMap();
    const sessionIds = readSessionShownIds();

    const eligible = popups.find((p) =>
      shouldShowPopup(p, location.pathname, dismissedMap, sessionIds)
    );

    if (!eligible) return;

    const delayMs = Math.max(0, Math.min(30, eligible.delaySeconds || 0)) * 1000;
    const timer = window.setTimeout(() => {
      recordSessionShown(eligible._id);
      setActivePopup(eligible);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [location.pathname, popups]);

  useEffect(() => {
    if (!activePopup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        writeDismissedPopup(activePopup._id);
        setActivePopup(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePopup]);

  if (!activePopup) return null;

  const dismiss = () => {
    writeDismissedPopup(activePopup._id);
    setActivePopup(null);
  };

  const handleCopyCoupon = async () => {
    if (!activePopup.couponCode) return;
    try {
      await navigator.clipboard.writeText(activePopup.couponCode);
      setCopiedCode(true);
      dispatch(pushToast({ variant: 'success', message: `Copied code ${activePopup.couponCode}` }));
    } catch {
      dispatch(pushToast({ variant: 'info', message: `Use code ${activePopup.couponCode} at checkout.` }));
    }
  };

  const safeCtaUrl = sanitizeHref(activePopup.ctaUrl) || '/shop';
  const safeImageUrl = sanitizeHref(activePopup.imageUrl);
  const isExternalCta = /^https?:\/\//i.test(safeCtaUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close promotional popup"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-sm border border-slate-200"
        >
          <X className="w-4 h-4" />
        </button>

        {safeImageUrl && (
          <div className="w-full h-48 bg-slate-100 overflow-hidden">
            <SafeImage
              src={safeImageUrl}
              alt={activePopup.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 sm:p-7 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Special Offer</span>
          </div>

          <h2 id="promo-popup-title" className="text-2xl font-extrabold text-slate-900 leading-tight">
            {activePopup.title}
          </h2>

          {activePopup.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{activePopup.description}</p>
          )}

          {activePopup.couponCode && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                  Promo Code
                </p>
                <p className="font-mono text-base font-extrabold text-slate-900 tracking-wide">
                  {activePopup.couponCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCoupon}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isExternalCta ? (
              <a
                href={safeCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismiss}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                <span>{activePopup.ctaText || 'Shop Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <Link
                to={safeCtaUrl}
                onClick={dismiss}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                <span>{activePopup.ctaText || 'Shop Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
