import {
  calculateShippingCharge,
  computeTaxBreakdown,
  DEFAULT_SHIPPING_CONFIG,
  type ShippingConfig,
  type TaxSettingsConfig,
} from './pricing.ts';

export function normalizeVariantOptions(options: unknown): Record<string, string> {
  if (!options) return {};
  if (options instanceof Map) {
    const out: Record<string, string> = {};
    for (const [k, v] of options.entries()) {
      if (k && v !== undefined && v !== null) {
        out[String(k)] = String(v);
      }
    }
    return out;
  }
  if (typeof options === 'object') {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(options as Record<string, unknown>)) {
      if (k && v !== undefined && v !== null) {
        out[String(k)] = String(v);
      }
    }
    return out;
  }
  return {};
}

export function getEffectiveCartItemMaxQty(input: {
  availableStock: number;
  maxOrderQuantity?: number | null;
  allowBackorders?: boolean;
}): number {
  const maxOrderQty =
    input.maxOrderQuantity && input.maxOrderQuantity > 0
      ? Math.min(50, Math.floor(input.maxOrderQuantity))
      : 50;
  const stock = Math.max(0, Math.floor(Number(input.availableStock) || 0));

  if (stock > 0) {
    return Math.max(1, Math.min(stock, maxOrderQty));
  }
  if (input.allowBackorders) {
    return Math.max(1, maxOrderQty);
  }
  return 1;
}

export interface CartOrderSummaryResult {
  subtotal: number;
  discountAmount: number;
  automaticDiscountAmount?: number;
  automaticDiscountLabel?: string | null;
  taxableSubtotal: number;
  qualifiesForFreeShipping: boolean;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  freeShippingProgressPercent: number;
  estimatedShipping: number;
  dhakaMetroCharge: number;
  dhakaSuburbCharge: number;
  outsideDhakaCharge: number;
  expressSurcharge: number;
  taxRate: number;
  taxAmount: number;
  taxLabel?: string;
  taxInclusive?: boolean;
  estimatedTotal: number;
}

export function computeCartOrderSummary(input: {
  subtotal: number;
  discountAmount?: number;
  automaticDiscountAmount?: number;
  automaticDiscountLabel?: string | null;
  shippingConfig?: ShippingConfig | null;
  taxRate?: number | null;
  taxSettings?: TaxSettingsConfig | null;
  itemCount?: number;
}): CartOrderSummaryResult {
  const shipping = input.shippingConfig || DEFAULT_SHIPPING_CONFIG;
  const subtotal = Math.max(0, Math.round(Number(input.subtotal) || 0));
  const automaticDiscountAmount = Math.max(
    0,
    Math.min(subtotal, Math.round(Number(input.automaticDiscountAmount) || 0))
  );
  const couponDiscount = Math.max(0, Math.round(Number(input.discountAmount) || 0));
  const totalDiscount = Math.min(subtotal, automaticDiscountAmount + couponDiscount);
  const taxableSubtotal = Math.max(0, subtotal - totalDiscount);
  const threshold = Math.max(0, Number(shipping.freeShippingThreshold) || 0);
  const hasItems = (input.itemCount ?? (subtotal > 0 ? 1 : 0)) > 0;

  const qualifiesForFreeShipping = hasItems && threshold > 0 && taxableSubtotal >= threshold;
  const amountToFreeShipping =
    threshold > 0 ? Math.max(0, Math.round(threshold - taxableSubtotal)) : 0;
  const freeShippingProgressPercent =
    threshold > 0
      ? Math.min(100, Math.max(0, Math.round((taxableSubtotal / threshold) * 100)))
      : 100;

  const estimatedShipping = !hasItems
    ? 0
    : calculateShippingCharge(taxableSubtotal, 'dhaka_metro', 'standard', shipping);

  const taxBreakdown = hasItems
    ? computeTaxBreakdown({
        subtotalAfterDiscount: taxableSubtotal,
        shippingCharge: estimatedShipping,
        taxRate: input.taxRate,
        taxSettings: input.taxSettings,
      })
    : {
        taxRate: 0,
        taxAmount: 0,
        taxAddedToTotal: 0,
        taxInclusive: Boolean(input.taxSettings?.taxInclusive),
        taxLabel: input.taxSettings?.label?.trim() || 'Tax',
      };

  const estimatedTotal = Math.max(
    0,
    taxableSubtotal + estimatedShipping + taxBreakdown.taxAddedToTotal
  );

  return {
    subtotal,
    discountAmount: totalDiscount,
    automaticDiscountAmount,
    automaticDiscountLabel: input.automaticDiscountLabel ?? null,
    taxableSubtotal,
    qualifiesForFreeShipping,
    freeShippingThreshold: threshold,
    amountToFreeShipping,
    freeShippingProgressPercent,
    estimatedShipping,
    dhakaMetroCharge: shipping.dhakaMetroCharge,
    dhakaSuburbCharge: shipping.dhakaSuburbCharge,
    outsideDhakaCharge: shipping.outsideDhakaCharge,
    expressSurcharge: shipping.expressSurcharge,
    taxRate: taxBreakdown.taxRate,
    taxAmount: taxBreakdown.taxAmount,
    taxLabel: taxBreakdown.taxLabel,
    taxInclusive: taxBreakdown.taxInclusive,
    estimatedTotal,
  };
}

export interface CartBannerScheduleInput {
  isEnabled: boolean;
  displayOrder: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}

export function filterActiveCartBanners<T extends CartBannerScheduleInput>(
  banners: T[],
  now: Date = new Date()
): T[] {
  return banners
    .filter((banner) => {
      if (!banner.isEnabled) return false;
      if (banner.startsAt) {
        const start = new Date(banner.startsAt);
        if (!Number.isNaN(start.getTime()) && now < start) return false;
      }
      if (banner.endsAt) {
        const end = new Date(banner.endsAt);
        if (!Number.isNaN(end.getTime()) && now > end) return false;
      }
      return true;
    })
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export function filterCartRecommendations<
  T extends {
    _id: unknown;
    status?: string;
    availableStock?: number;
    allowBackorders?: boolean;
  },
>(products: T[], excludedProductIds: string[], limit = 10): T[] {
  const excludedSet = new Set(excludedProductIds.map((id) => String(id)));
  const seen = new Set<string>();
  const output: T[] = [];

  for (const product of products) {
    const id = String(product._id);
    if (!id || excludedSet.has(id) || seen.has(id)) continue;
    if (product.status && product.status !== 'published') continue;
    const stock = Number(product.availableStock || 0);
    if (stock <= 0 && !product.allowBackorders) continue;
    seen.add(id);
    output.push(product);
    if (output.length >= limit) break;
  }

  return output;
}
