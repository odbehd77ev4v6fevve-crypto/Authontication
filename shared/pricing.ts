export interface PricingProductInput {
  basePrice: number;
  salePrice?: number | null;
  flashSalePrice?: number | null;
  flashSaleStart?: Date | string | null;
  flashSaleEnd?: Date | string | null;
  variantPrice?: number | null;
}

export function resolveEffectiveUnitPrice(
  input: PricingProductInput,
  now: Date = new Date()
): {
  unitPrice: number;
  originalPrice: number | null;
  discountPercent: number;
  isFlashSaleActive: boolean;
} {
  const base = Math.max(0, Number(input.variantPrice ?? input.basePrice) || 0);
  const flashStart = input.flashSaleStart ? new Date(input.flashSaleStart) : null;
  const flashEnd = input.flashSaleEnd ? new Date(input.flashSaleEnd) : null;

  const isFlashSaleActive = Boolean(
    input.flashSalePrice !== null &&
      input.flashSalePrice !== undefined &&
      input.flashSalePrice > 0 &&
      input.flashSalePrice < base &&
      (!flashStart || now >= flashStart) &&
      (!flashEnd || now <= flashEnd)
  );

  if (isFlashSaleActive && input.flashSalePrice) {
    const unitPrice = Math.round(input.flashSalePrice);
    const discountPercent = base > 0 ? Math.round(((base - unitPrice) / base) * 100) : 0;
    return {
      unitPrice,
      originalPrice: base,
      discountPercent,
      isFlashSaleActive: true,
    };
  }

  if (input.salePrice !== null && input.salePrice !== undefined && input.salePrice > 0 && input.salePrice < base) {
    const unitPrice = Math.round(input.salePrice);
    const discountPercent = base > 0 ? Math.round(((base - unitPrice) / base) * 100) : 0;
    return {
      unitPrice,
      originalPrice: base,
      discountPercent,
      isFlashSaleActive: false,
    };
  }

  return {
    unitPrice: Math.round(base),
    originalPrice: null,
    discountPercent: 0,
    isFlashSaleActive: false,
  };
}

export interface CouponInput {
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  maxDiscountCap?: number | null;
  minOrderAmount: number;
  isActive: boolean;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  customerUsedCount?: number;
  eligibleCategoryIds?: string[];
  eligibleProductIds?: string[];
  eligibleCustomerGroupIds?: string[];
  userCustomerGroupId?: string | null;
}

export interface CartPricingLine {
  productId: string;
  categoryId: string;
  unitPrice: number;
  quantity: number;
}

export function calculateCouponDiscount(
  coupon: CouponInput,
  lines: CartPricingLine[],
  now: Date = new Date()
): { valid: boolean; discountAmount: number; reason?: string } {
  if (!coupon.isActive) {
    return { valid: false, discountAmount: 0, reason: 'Coupon is inactive.' };
  }
  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    return { valid: false, discountAmount: 0, reason: 'Coupon is not active yet.' };
  }
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
    return { valid: false, discountAmount: 0, reason: 'Coupon has expired.' };
  }
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discountAmount: 0, reason: 'Coupon usage limit reached.' };
  }
  if (
    coupon.perCustomerLimit !== null &&
    coupon.perCustomerLimit !== undefined &&
    (coupon.customerUsedCount ?? 0) >= coupon.perCustomerLimit
  ) {
    return { valid: false, discountAmount: 0, reason: 'You have already reached the usage limit for this coupon.' };
  }

  if (coupon.eligibleCustomerGroupIds && coupon.eligibleCustomerGroupIds.length > 0) {
    const userGroup = coupon.userCustomerGroupId ? String(coupon.userCustomerGroupId) : '';
    if (!userGroup || !coupon.eligibleCustomerGroupIds.map(String).includes(userGroup)) {
      return {
        valid: false,
        discountAmount: 0,
        reason: 'This coupon is exclusive to eligible customer groups.',
      };
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  if (subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      discountAmount: 0,
      reason: `Minimum order amount of ৳${coupon.minOrderAmount.toLocaleString()} required.`,
    };
  }

  const hasProductScope = Boolean(coupon.eligibleProductIds && coupon.eligibleProductIds.length > 0);
  const hasCategoryScope = Boolean(coupon.eligibleCategoryIds && coupon.eligibleCategoryIds.length > 0);

  const eligibleSubtotal = lines
    .filter((line) => {
      if (!hasProductScope && !hasCategoryScope) return true;
      const matchProduct = hasProductScope && coupon.eligibleProductIds!.includes(line.productId);
      const matchCategory = hasCategoryScope && coupon.eligibleCategoryIds!.includes(line.categoryId);
      return matchProduct || matchCategory;
    })
    .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  if (eligibleSubtotal <= 0) {
    return { valid: false, discountAmount: 0, reason: 'No items in your cart are eligible for this coupon.' };
  }

  let discount =
    coupon.type === 'fixed'
      ? coupon.value
      : Math.round((eligibleSubtotal * coupon.value) / 100);

  if (coupon.maxDiscountCap !== null && coupon.maxDiscountCap !== undefined && coupon.maxDiscountCap > 0) {
    discount = Math.min(discount, coupon.maxDiscountCap);
  }

  discount = Math.max(0, Math.min(discount, subtotal));

  return {
    valid: true,
    discountAmount: Math.round(discount),
  };
}

export interface AutomaticDiscountRuleInput {
  _id?: unknown;
  name: string;
  ruleType: 'percentage' | 'fixed' | 'bulk_tier';
  value: number;
  maxDiscountCap?: number | null;
  minOrderAmount: number;
  minQuantity: number;
  targetScope: 'all' | 'category' | 'product' | 'customer_group';
  targetIds?: string[];
  priority?: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  isActive: boolean;
}

export interface CustomerGroupDiscountInput {
  _id?: unknown;
  name: string;
  discountPercent: number;
  isActive: boolean;
}

export function calculateAutomaticDiscount(input: {
  lines: CartPricingLine[];
  rules?: AutomaticDiscountRuleInput[];
  customerGroup?: CustomerGroupDiscountInput | null;
  userCustomerGroupId?: string | null;
  now?: Date;
}): {
  discountAmount: number;
  appliedRuleName: string | null;
  source: 'discount_rule' | 'customer_group' | null;
} {
  const now = input.now ?? new Date();
  const lines = input.lines || [];
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (subtotal <= 0 || totalQty <= 0) {
    return { discountAmount: 0, appliedRuleName: null, source: null };
  }

  let bestAmount = 0;
  let bestName: string | null = null;
  let bestSource: 'discount_rule' | 'customer_group' | null = null;
  let bestPriority = -Infinity;

  const userGroupId = input.userCustomerGroupId
    ? String(input.userCustomerGroupId)
    : input.customerGroup?._id
    ? String(input.customerGroup._id)
    : null;

  for (const rule of input.rules || []) {
    if (!rule.isActive) continue;
    if (rule.startsAt && now < new Date(rule.startsAt)) continue;
    if (rule.endsAt && now > new Date(rule.endsAt)) continue;
    if (subtotal < Number(rule.minOrderAmount || 0)) continue;
    if (totalQty < Number(rule.minQuantity || 1)) continue;

    const targetIds = (rule.targetIds || []).map(String).filter(Boolean);
    let eligibleSubtotal = 0;

    if (rule.targetScope === 'all') {
      eligibleSubtotal = subtotal;
    } else if (rule.targetScope === 'category') {
      eligibleSubtotal = lines
        .filter((l) => targetIds.includes(String(l.categoryId)))
        .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    } else if (rule.targetScope === 'product') {
      eligibleSubtotal = lines
        .filter((l) => targetIds.includes(String(l.productId)))
        .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    } else if (rule.targetScope === 'customer_group') {
      if (userGroupId && (targetIds.length === 0 || targetIds.includes(userGroupId))) {
        eligibleSubtotal = subtotal;
      }
    }

    if (eligibleSubtotal <= 0) continue;

    let amount =
      rule.ruleType === 'fixed'
        ? Math.round(rule.value)
        : Math.round((eligibleSubtotal * rule.value) / 100);
    if (rule.maxDiscountCap !== null && rule.maxDiscountCap !== undefined && rule.maxDiscountCap > 0) {
      amount = Math.min(amount, Math.round(rule.maxDiscountCap));
    }
    amount = Math.max(0, Math.min(amount, eligibleSubtotal));

    const priority = Number(rule.priority ?? 0);
    if (amount > bestAmount || (amount === bestAmount && amount > 0 && priority > bestPriority)) {
      bestAmount = amount;
      bestName = rule.name;
      bestSource = 'discount_rule';
      bestPriority = priority;
    }
  }

  if (input.customerGroup && input.customerGroup.isActive && input.customerGroup.discountPercent > 0) {
    const groupAmount = Math.max(
      0,
      Math.min(subtotal, Math.round((subtotal * input.customerGroup.discountPercent) / 100))
    );
    if (groupAmount > bestAmount) {
      bestAmount = groupAmount;
      bestName = `${input.customerGroup.name} (${input.customerGroup.discountPercent}% VIP)`;
      bestSource = 'customer_group';
    }
  }

  return {
    discountAmount: bestAmount,
    appliedRuleName: bestName,
    source: bestSource,
  };
}

export interface ShippingConfig {
  dhakaMetroCharge: number;
  dhakaSuburbCharge: number;
  outsideDhakaCharge: number;
  freeShippingThreshold: number;
  expressSurcharge: number;
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  dhakaMetroCharge: 60,
  dhakaSuburbCharge: 90,
  outsideDhakaCharge: 130,
  freeShippingThreshold: 999,
  expressSurcharge: 80,
};

export function calculateShippingCharge(
  subtotalAfterDiscount: number,
  zone: 'dhaka_metro' | 'dhaka_suburb' | 'outside_dhaka',
  method: 'standard' | 'express',
  config: ShippingConfig = DEFAULT_SHIPPING_CONFIG
): number {
  const baseRate =
    zone === 'dhaka_metro'
      ? config.dhakaMetroCharge
      : zone === 'dhaka_suburb'
      ? config.dhakaSuburbCharge
      : config.outsideDhakaCharge;

  if (method === 'standard' && subtotalAfterDiscount >= config.freeShippingThreshold) {
    return 0;
  }

  return method === 'express' ? baseRate + config.expressSurcharge : baseRate;
}

export interface TaxSettingsConfig {
  enabled?: boolean;
  taxInclusive?: boolean;
  label?: string;
  applyToShipping?: boolean;
}

export function calculateTaxAmount(
  taxableAmount: number,
  taxRatePercent: number = 0,
  taxSettings?: TaxSettingsConfig | null,
  shippingCharge: number = 0
): number {
  if (taxSettings && taxSettings.enabled === false) return 0;
  const safeRate = Math.max(0, Math.min(30, Number(taxRatePercent) || 0));
  const shippingPart = taxSettings?.applyToShipping ? Math.max(0, Number(shippingCharge) || 0) : 0;
  const safeBase = Math.max(0, Number(taxableAmount) || 0) + shippingPart;
  if (safeRate === 0 || safeBase === 0) return 0;
  if (taxSettings?.taxInclusive) {
    return Math.round((safeBase * safeRate) / (100 + safeRate));
  }
  return Math.round((safeBase * safeRate) / 100);
}

export function computeTaxBreakdown(input: {
  subtotalAfterDiscount: number;
  shippingCharge?: number;
  taxRate?: number | null;
  taxSettings?: TaxSettingsConfig | null;
}): {
  taxRate: number;
  taxAmount: number;
  taxAddedToTotal: number;
  taxInclusive: boolean;
  taxLabel: string;
} {
  const settings = input.taxSettings;
  const enabled = settings ? settings.enabled !== false : Number(input.taxRate || 0) > 0;
  const effectiveRate = enabled ? Math.max(0, Math.min(30, Number(input.taxRate) || 0)) : 0;
  const taxInclusive = Boolean(settings?.taxInclusive);
  const taxLabel = settings?.label?.trim() || 'Tax';
  const taxAmount = calculateTaxAmount(
    input.subtotalAfterDiscount,
    effectiveRate,
    settings ? { ...settings, enabled } : undefined,
    input.shippingCharge ?? 0
  );
  return {
    taxRate: effectiveRate,
    taxAmount,
    taxAddedToTotal: taxInclusive ? 0 : taxAmount,
    taxInclusive,
    taxLabel,
  };
}

export interface StorePaymentMethodConfig {
  key: 'cod' | 'bkash' | 'nagad' | 'card' | 'sslcommerz';
  label: string;
  enabled: boolean;
  displayOrder: number;
  instructions?: string;
  mode?: 'sandbox' | 'live';
}

export function validateCheckoutPaymentChannel(
  paymentMethods: StorePaymentMethodConfig[] | undefined | null,
  paymentMethod: 'cod' | 'sslcommerz',
  paymentChannel?: 'cod' | 'card' | 'bkash' | 'nagad' | null
): {
  valid: boolean;
  channel: 'cod' | 'card' | 'bkash' | 'nagad';
  error?: string;
} {
  const resolvedChannel: 'cod' | 'card' | 'bkash' | 'nagad' =
    paymentMethod === 'cod'
      ? 'cod'
      : paymentChannel && paymentChannel !== 'cod'
      ? paymentChannel
      : 'card';

  if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
    return { valid: true, channel: resolvedChannel };
  }

  const direct = paymentMethods.find((m) => m.key === resolvedChannel);
  const fallbackOnline =
    paymentMethod === 'sslcommerz'
      ? paymentMethods.find((m) => m.key === 'sslcommerz')
      : undefined;
  const target = direct ?? fallbackOnline;

  if (target && !target.enabled) {
    return {
      valid: false,
      channel: resolvedChannel,
      error: `${target.label} is currently disabled by store settings.`,
    };
  }

  return { valid: true, channel: resolvedChannel };
}


