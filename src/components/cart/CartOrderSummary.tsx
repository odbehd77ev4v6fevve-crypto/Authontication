import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  HelpCircle,
  Lock,
  RotateCcw,
  ShieldCheck,
  Tag,
  Truck,
} from 'lucide-react';
import type { CartOrderSummaryResult } from '../../../shared/cartHelpers.ts';
import { formatBdt } from '../../lib/api.ts';
import type { HomepageConfig } from '../../types/domain.ts';

interface CartOrderSummaryProps {
  summary: CartOrderSummaryResult;
  appliedCouponCode: string | null;
  couponMessage?: string;
  couponInput: string;
  onCouponInputChange: (val: string) => void;
  onApplyCoupon: (e: React.FormEvent) => void;
  onRemoveCoupon: () => void;
  onProceedToCheckout: () => void;
  hasUnavailableItems: boolean;
  loading: boolean;
  homepage?: HomepageConfig | null;
}

export function CartOrderSummary({
  summary,
  appliedCouponCode,
  couponMessage,
  couponInput,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  onProceedToCheckout,
  hasUnavailableItems,
  loading,
  homepage,
}: CartOrderSummaryProps) {
  const [tooltipPinned, setTooltipPinned] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  const tooltipWrapperRef = useRef<HTMLDivElement>(null);
  const shippingTooltipOpen = tooltipPinned || tooltipHovered;

  useEffect(() => {
    if (!tooltipPinned) return;
    const handleOutside = (e: MouseEvent) => {
      if (tooltipWrapperRef.current && !tooltipWrapperRef.current.contains(e.target as Node)) {
        setTooltipPinned(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTooltipPinned(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [tooltipPinned]);

  const easyReturnPoint = homepage?.trustPoints?.find((t) =>
    t.title.toLowerCase().includes('return')
  );
  const securePayPoint = homepage?.trustPoints?.find((t) =>
    t.title.toLowerCase().includes('secure') || t.title.toLowerCase().includes('payment')
  );

  return (
    <div className="space-y-4">
      {/* Main Order Summary Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-[#16A34A]" />
          <h2 className="text-lg font-extrabold text-slate-900">Order Summary</h2>
        </div>

        {/* Dynamic Free Shipping Progress */}
        {summary.freeShippingThreshold > 0 && (
          <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200/80 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-emerald-900 inline-flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#16A34A]" />
                {summary.qualifiesForFreeShipping
                  ? 'Free Standard Shipping unlocked!'
                  : `Add ${formatBdt(summary.amountToFreeShipping)} more for Free Shipping`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-emerald-100 overflow-hidden">
              <div
                className="h-full bg-[#16A34A] transition-all duration-300 rounded-full"
                style={{ width: `${summary.freeShippingProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-bold text-slate-900 tabular-nums">
              {formatBdt(summary.subtotal)}
            </span>
          </div>

          {summary.discountAmount > 0 && (
            <div className="flex items-center justify-between text-[#16A34A]">
              <span>
                Discount{' '}
                {summary.automaticDiscountAmount && summary.automaticDiscountLabel
                  ? `(${summary.automaticDiscountLabel})`
                  : appliedCouponCode
                  ? `(${appliedCouponCode})`
                  : ''}
              </span>
              <span className="font-bold tabular-nums">
                -{formatBdt(summary.discountAmount)}
              </span>
            </div>
          )}

          <div ref={tooltipWrapperRef} className="relative flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-slate-600">
              <span>Shipping</span>
              <button
                type="button"
                aria-label="Shipping calculation details"
                aria-expanded={shippingTooltipOpen}
                onClick={() => setTooltipPinned((prev) => !prev)}
                onMouseEnter={() => setTooltipHovered(true)}
                onMouseLeave={() => setTooltipHovered(false)}
                className="text-slate-400 hover:text-[#16A34A] transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span
              className={`font-bold tabular-nums ${
                summary.estimatedShipping === 0 ? 'text-[#16A34A]' : 'text-slate-900'
              }`}
            >
              {summary.estimatedShipping === 0
                ? 'Free'
                : formatBdt(summary.estimatedShipping)}
            </span>

            {shippingTooltipOpen && (
              <div
                role="tooltip"
                className="absolute left-0 top-7 z-20 w-64 rounded-xl border border-slate-200 bg-slate-900 text-white p-3 text-[11px] leading-relaxed shadow-xl space-y-1"
              >
                <p className="font-bold text-emerald-300">Bangladesh Standard Delivery</p>
                <p>Dhaka Metro: {formatBdt(summary.dhakaMetroCharge)}</p>
                <p>Dhaka Suburb: {formatBdt(summary.dhakaSuburbCharge)}</p>
                <p>Outside Dhaka: {formatBdt(summary.outsideDhakaCharge)}</p>
                {summary.freeShippingThreshold > 0 && (
                  <p className="text-emerald-200 pt-0.5">
                    Free standard shipping on orders over {formatBdt(summary.freeShippingThreshold)}.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">
              {summary.taxLabel || 'Tax'} ({summary.taxRate}%
              {summary.taxInclusive ? ' incl.' : ''})
            </span>
            <span className="font-bold text-slate-900 tabular-nums">
              {formatBdt(summary.taxAmount)}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <span className="text-base font-extrabold text-slate-900">Total</span>
              {!summary.qualifiesForFreeShipping && summary.estimatedShipping > 0 && (
                <p className="text-[11px] text-slate-400">Est. with Dhaka Metro standard shipping</p>
              )}
            </div>
            <span className="text-2xl font-extrabold text-[#16A34A] tabular-nums">
              {formatBdt(summary.estimatedTotal)}
            </span>
          </div>
        </div>

        {/* Promo / Coupon Form */}
        <form onSubmit={onApplyCoupon} className="space-y-2 pt-3 border-t border-slate-100">
          <label htmlFor="cart-coupon" className="block text-xs font-semibold text-slate-700">
            Promo / Coupon Code
          </label>
          <div className="flex gap-2">
            <input
              id="cart-coupon"
              type="text"
              value={couponInput}
              onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs uppercase focus:outline-none focus:border-[#16A34A]"
            />
            <button
              type="submit"
              disabled={loading || !couponInput.trim()}
              className="px-4 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              Apply
            </button>
          </div>
          {appliedCouponCode && (
            <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Tag className="w-3.5 h-3.5" />
                {appliedCouponCode} applied
              </span>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="text-red-600 hover:underline font-semibold"
              >
                Remove
              </button>
            </div>
          )}
          {couponMessage && <p className="text-xs text-amber-700 font-medium">{couponMessage}</p>}
        </form>

        {/* Out-of-stock guard banner */}
        {hasUnavailableItems && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              One or more items in your cart are currently out of stock. Remove unavailable items before proceeding to checkout.
            </span>
          </div>
        )}

        {/* Primary Checkout CTA */}
        <button
          type="button"
          disabled={loading || hasUnavailableItems}
          onClick={onProceedToCheckout}
          className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] hover:from-[#15803D] hover:to-[#16A34A] disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all"
        >
          <Lock className="w-4 h-4" />
          <span>Proceed to Checkout</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Trust Badge Card ("Your Trust, Our Priority") */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
          <h3 className="text-sm font-extrabold text-slate-900">Your Trust, Our Priority</h3>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center space-y-1">
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-[#16A34A]">
              <Truck className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-800 leading-tight">Free Shipping</p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {summary.freeShippingThreshold > 0
                ? `Over ${formatBdt(summary.freeShippingThreshold)}`
                : 'Nationwide BD'}
            </p>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-[#16A34A]">
              <RotateCcw className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-800 leading-tight">
              {easyReturnPoint?.title || '7 Days'}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {easyReturnPoint?.subtitle || 'Easy Return'}
            </p>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-[#16A34A]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-800 leading-tight">
              {securePayPoint?.title || 'Secure'}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {securePayPoint?.subtitle || '100% Protected'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
