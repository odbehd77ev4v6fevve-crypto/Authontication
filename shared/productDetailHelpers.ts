export type StockStatusKey = 'in_stock' | 'limited_stock' | 'out_of_stock' | 'pre_order';

export interface StockStateResult {
  status: StockStatusKey;
  label: string;
}

export function computeProductStockState(input: {
  availableStock: number;
  lowStockThreshold?: number;
  allowBackorders?: boolean;
}): StockStateResult {
  const avail = Math.max(0, Math.floor(Number(input.availableStock) || 0));
  const threshold = Math.max(1, Math.floor(Number(input.lowStockThreshold) || 5));

  if (avail === 0) {
    if (input.allowBackorders) {
      return { status: 'pre_order', label: 'Pre-order' };
    }
    return { status: 'out_of_stock', label: 'Out of Stock' };
  }

  if (avail <= threshold) {
    return { status: 'limited_stock', label: `Limited Stock (${avail} left)` };
  }

  return { status: 'in_stock', label: 'In Stock' };
}

export function computeDiscountAndSavings(
  currentPrice: number,
  originalPrice: number | null | undefined
): { discountPercent: number; savingsAmount: number } {
  const current = Math.max(0, Number(currentPrice) || 0);
  const original = originalPrice ? Math.max(0, Number(originalPrice) || 0) : 0;

  if (original <= current || original <= 0) {
    return { discountPercent: 0, savingsAmount: 0 };
  }

  const savingsAmount = Math.round(original - current);
  const discountPercent = Math.round(((original - current) / original) * 100);
  return { discountPercent, savingsAmount };
}

export interface VariantLike {
  _id: string;
  sku: string;
  title: string;
  options?: Record<string, string>;
  price?: number | null;
  stockOnHand: number;
  reservedStock: number;
  isActive?: boolean;
}

export interface VariantAttributeGroup {
  name: string;
  values: string[];
}

export function extractVariantAttributeGroups(variants: VariantLike[]): VariantAttributeGroup[] {
  const active = variants.filter((v) => v.isActive !== false);
  const keyOrder: string[] = [];
  const valueMap = new Map<string, string[]>();

  for (const variant of active) {
    const opts = variant.options || {};
    for (const [rawKey, rawVal] of Object.entries(opts)) {
      const key = rawKey.trim();
      const val = String(rawVal || '').trim();
      if (!key || !val) continue;
      if (!valueMap.has(key)) {
        keyOrder.push(key);
        valueMap.set(key, []);
      }
      const list = valueMap.get(key)!;
      if (!list.includes(val)) {
        list.push(val);
      }
    }
  }

  return keyOrder.map((name) => ({
    name,
    values: valueMap.get(name) || [],
  }));
}

export function findMatchingVariant<T extends VariantLike>(
  variants: T[],
  selectedOptions: Record<string, string>
): T | null {
  const active = variants.filter((v) => v.isActive !== false);
  if (active.length === 0) return null;

  const selectedEntries = Object.entries(selectedOptions).filter(([, v]) => Boolean(v));
  if (selectedEntries.length === 0) {
    return active.find((v) => v.stockOnHand - v.reservedStock > 0) || active[0];
  }

  const exactMatch = active.find((v) => {
    const opts = v.options || {};
    return selectedEntries.every(([k, val]) => opts[k] === val);
  });

  return exactMatch || null;
}

export function isOptionValueAvailable(
  variants: VariantLike[],
  selectedOptions: Record<string, string>,
  optionKey: string,
  optionValue: string
): { exists: boolean; inStock: boolean } {
  const active = variants.filter((v) => v.isActive !== false);
  const candidate = { ...selectedOptions, [optionKey]: optionValue };
  const otherKeys = Object.keys(candidate).filter((k) => k !== optionKey && Boolean(candidate[k]));

  const matchingWithOthers = active.filter((v) => {
    const opts = v.options || {};
    if (opts[optionKey] !== optionValue) return false;
    return otherKeys.every((k) => !opts[k] || opts[k] === candidate[k]);
  });

  if (matchingWithOthers.length > 0) {
    return {
      exists: true,
      inStock: matchingWithOthers.some((v) => v.stockOnHand - v.reservedStock > 0),
    };
  }

  const anyWithOption = active.filter((v) => (v.options || {})[optionKey] === optionValue);
  return {
    exists: anyWithOption.length > 0,
    inStock: anyWithOption.some((v) => v.stockOnHand - v.reservedStock > 0),
  };
}

export function clampPurchaseQuantity(input: {
  requested: number;
  availableStock: number;
  maxOrderQuantity?: number | null;
  allowBackorders?: boolean;
}): number {
  const qty = Math.floor(Number(input.requested) || 1);
  const maxLimit =
    input.maxOrderQuantity && input.maxOrderQuantity > 0
      ? Math.min(50, Math.floor(input.maxOrderQuantity))
      : 50;

  if (input.allowBackorders && input.availableStock <= 0) {
    return Math.max(1, Math.min(maxLimit, qty));
  }

  if (input.availableStock <= 0) {
    return 1;
  }

  const upper = Math.min(maxLimit, Math.floor(input.availableStock));
  return Math.max(1, Math.min(upper, qty));
}

export function computeReviewDistributionPercentages(
  distribution: Record<number, number>,
  total: number
): Record<1 | 2 | 3 | 4 | 5, number> {
  if (total <= 0) {
    return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  }
  return {
    5: Math.min(100, Math.max(0, Math.round(((distribution[5] || 0) / total) * 100))),
    4: Math.min(100, Math.max(0, Math.round(((distribution[4] || 0) / total) * 100))),
    3: Math.min(100, Math.max(0, Math.round(((distribution[3] || 0) / total) * 100))),
    2: Math.min(100, Math.max(0, Math.round(((distribution[2] || 0) / total) * 100))),
    1: Math.min(100, Math.max(0, Math.round(((distribution[1] || 0) / total) * 100))),
  };
}

export interface ParsedVideoEmbed {
  valid: boolean;
  type: 'youtube' | 'vimeo' | 'direct' | 'none';
  embedUrl?: string;
}

export function parseSafeProductVideoUrl(rawUrl?: string | null): ParsedVideoEmbed {
  if (!rawUrl || !rawUrl.trim()) {
    return { valid: false, type: 'none' };
  }
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return { valid: false, type: 'none' };
    return { valid: true, type: 'direct', embedUrl: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, type: 'none' };
    }
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const vid = parsed.searchParams.get('v');
      if (vid && /^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
        return {
          valid: true,
          type: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1`,
        };
      }
      const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{6,20})$/);
      if (embedMatch) {
        return {
          valid: true,
          type: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${embedMatch[1]}?autoplay=1`,
        };
      }
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '');
      if (/^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
        return {
          valid: true,
          type: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
        };
      }
    }

    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '');
      if (/^\d{4,15}$/.test(id)) {
        return {
          valid: true,
          type: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
        };
      }
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)) {
      return { valid: true, type: 'direct', embedUrl: parsed.toString() };
    }

    return { valid: false, type: 'none' };
  } catch {
    return { valid: false, type: 'none' };
  }
}

export function reorderArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
