export type DashboardRange = '7D' | '30D' | '3M' | '1Y';

export interface AnalyticsOrderInput {
  _id?: string;
  orderNumber?: string;
  totalAmount: number;
  refundedAmount?: number;
  subtotal?: number;
  discountAmount?: number;
  shippingCharge?: number;
  taxAmount?: number;
  orderStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt: string | Date;
  items?: Array<{
    productId?: string | { toString(): string };
    productName: string;
    sku?: string;
    imageUrl?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export interface AnalyticsProductInput {
  _id: string;
  name: string;
  sku?: string;
  basePrice: number;
  salePrice?: number | null;
  salesCount?: number;
  images?: Array<{ url?: string }>;
}

const EXCLUDED_REVENUE_STATUSES = new Set(['cancelled', 'payment_failed', 'refunded', 'returned']);

export function isOrderRevenueEligible(order: {
  orderStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
}): boolean {
  if (EXCLUDED_REVENUE_STATUSES.has(order.orderStatus)) {
    return false;
  }
  if (order.paymentStatus === 'failed' || order.paymentStatus === 'refunded') {
    return false;
  }
  if (
    order.paymentMethod === 'sslcommerz' &&
    order.paymentStatus !== 'paid' &&
    order.paymentStatus !== 'refund_pending'
  ) {
    return false;
  }
  return true;
}

export function getNetRecognizedOrderAmount(order: {
  totalAmount: number;
  refundedAmount?: number;
  orderStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
}): number {
  if (!isOrderRevenueEligible(order)) return 0;
  return Math.max(0, Number(order.totalAmount || 0) - Number(order.refundedAmount || 0));
}

export function computeGrowthPercent(current: number, previous: number): number | null {
  if (previous <= 0) {
    if (current <= 0) return 0;
    return null;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function rangeToDays(range: DashboardRange): number {
  switch (range) {
    case '7D':
      return 7;
    case '30D':
      return 30;
    case '3M':
      return 90;
    case '1Y':
      return 365;
  }
}

export interface SalesSeriesPoint {
  key: string;
  label: string;
  fullDate: string;
  revenue: number;
  orders: number;
}

export function buildSalesTimeSeries(
  orders: AnalyticsOrderInput[],
  range: DashboardRange,
  now = new Date()
): {
  range: DashboardRange;
  totalRevenue: number;
  previousRevenue: number;
  growthPercent: number | null;
  points: SalesSeriesPoint[];
} {
  const days = rangeToDays(range);
  const endMs = now.getTime();
  const currentStartMs = endMs - days * 24 * 60 * 60 * 1000;
  const prevStartMs = currentStartMs - days * 24 * 60 * 60 * 1000;

  let totalRevenue = 0;
  let previousRevenue = 0;

  const bucketCount = range === '7D' ? 7 : range === '30D' ? 30 : range === '3M' ? 12 : 12;
  const bucketSpanMs = (days * 24 * 60 * 60 * 1000) / bucketCount;

  const buckets: SalesSeriesPoint[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketDate = new Date(currentStartMs + (i + 0.5) * bucketSpanMs);
    const label =
      range === '1Y'
        ? bucketDate.toLocaleDateString('en-US', { month: 'short' })
        : bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = bucketDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    buckets.push({
      key: `b-${i}`,
      label,
      fullDate,
      revenue: 0,
      orders: 0,
    });
  }

  for (const order of orders) {
    const netAmount = getNetRecognizedOrderAmount(order);
    if (!isOrderRevenueEligible(order)) continue;
    const createdMs = new Date(order.createdAt).getTime();
    if (Number.isNaN(createdMs)) continue;

    if (createdMs >= currentStartMs && createdMs <= endMs) {
      totalRevenue += netAmount;
      const idx = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((createdMs - currentStartMs) / bucketSpanMs))
      );
      buckets[idx].revenue += netAmount;
      buckets[idx].orders += 1;
    } else if (createdMs >= prevStartMs && createdMs < currentStartMs) {
      previousRevenue += netAmount;
    }
  }

  return {
    range,
    totalRevenue,
    previousRevenue,
    growthPercent: computeGrowthPercent(totalRevenue, previousRevenue),
    points: buckets,
  };
}

export interface OrderStatusSlice {
  key: 'delivered' | 'processing' | 'pending' | 'cancelled' | 'returns';
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export function computeOrderStatusBreakdown(orders: Array<{ orderStatus: string }>): {
  totalOrders: number;
  breakdown: OrderStatusSlice[];
} {
  let delivered = 0;
  let processing = 0;
  let pending = 0;
  let cancelled = 0;
  let returns = 0;

  for (const o of orders) {
    if (o.orderStatus === 'delivered') {
      delivered += 1;
    } else if (['confirmed', 'processing', 'packed', 'shipped'].includes(o.orderStatus)) {
      processing += 1;
    } else if (['cancelled', 'payment_failed', 'returned', 'refunded'].includes(o.orderStatus)) {
      cancelled += 1;
    } else if (['return_requested', 'refund_pending'].includes(o.orderStatus)) {
      returns += 1;
    } else {
      pending += 1;
    }
  }

  const totalOrders = delivered + processing + pending + cancelled + returns;
  const pct = (n: number) => (totalOrders > 0 ? Number(((n / totalOrders) * 100).toFixed(1)) : 0);

  const breakdown: OrderStatusSlice[] = [
    { key: 'delivered', label: 'Delivered', count: delivered, percentage: pct(delivered), color: '#16A34A' },
    { key: 'processing', label: 'Processing', count: processing, percentage: pct(processing), color: '#2563EB' },
    { key: 'pending', label: 'Pending', count: pending, percentage: pct(pending), color: '#F59E0B' },
    { key: 'cancelled', label: 'Cancelled', count: cancelled, percentage: pct(cancelled), color: '#EF4444' },
  ];
  if (returns > 0) {
    breakdown.push({
      key: 'returns',
      label: 'Return / Refund',
      count: returns,
      percentage: pct(returns),
      color: '#8B5CF6',
    });
  }

  return {
    totalOrders,
    breakdown,
  };
}

export interface TopSellingProductRow {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string;
  price: number;
  unitsSold: number;
  revenue: number;
  progressPercent: number;
}

export function computeTopSellingProducts(
  orders: AnalyticsOrderInput[],
  products: AnalyticsProductInput[],
  limit = 5,
  options: { allowSalesCountFallback?: boolean } = {}
): TopSellingProductRow[] {
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const agg = new Map<string, TopSellingProductRow>();

  for (const order of orders) {
    if (!isOrderRevenueEligible(order)) continue;
    for (const item of order.items || []) {
      const pid = String(item.productId || item.sku || item.productName);
      const prod = productMap.get(pid);
      const existing = agg.get(pid);
      const qty = Number(item.quantity || 0);
      const rev = Number(item.lineTotal || item.unitPrice * qty || 0);
      if (existing) {
        existing.unitsSold += qty;
        existing.revenue += rev;
      } else {
        agg.set(pid, {
          productId: pid,
          name: prod?.name || item.productName,
          sku: prod?.sku || item.sku || '',
          imageUrl: prod?.images?.[0]?.url || item.imageUrl || '',
          price: Number(prod?.salePrice || prod?.basePrice || item.unitPrice || 0),
          unitsSold: qty,
          revenue: rev,
          progressPercent: 100,
        });
      }
    }
  }

  if (agg.size === 0 && options.allowSalesCountFallback) {
    for (const prod of products) {
      if ((prod.salesCount || 0) > 0) {
        agg.set(String(prod._id), {
          productId: String(prod._id),
          name: prod.name,
          sku: prod.sku || '',
          imageUrl: prod.images?.[0]?.url || '',
          price: Number(prod.salePrice || prod.basePrice || 0),
          unitsSold: Number(prod.salesCount || 0),
          revenue: Number(prod.salesCount || 0) * Number(prod.salePrice || prod.basePrice || 0),
          progressPercent: 100,
        });
      }
    }
  }

  const sorted = Array.from(agg.values())
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, limit);

  const maxUnits = sorted[0]?.unitsSold || 1;
  return sorted.map((row) => ({
    ...row,
    progressPercent: Math.max(8, Math.round((row.unitsSold / maxUnits) * 100)),
  }));
}

export function formatRelativeTime(dateInput: string | Date, now = new Date()): string {
  const target = new Date(dateInput);
  if (Number.isNaN(target.getTime())) return 'just now';
  const diffSec = Math.max(0, Math.floor((now.getTime() - target.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface PopupEligibilityInput {
  _id: string;
  isEnabled: boolean;
  displayFrequency: 'once_per_session' | 'once_per_day' | 'once_ever' | 'always';
  targetPages?: string[];
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
}

export function shouldShowPopup(
  popup: PopupEligibilityInput,
  currentPath: string,
  dismissedTimestamps: Record<string, number>,
  sessionShownIds: string[],
  now = new Date()
): boolean {
  if (!popup.isEnabled) return false;
  const nowMs = now.getTime();
  if (popup.startsAt) {
    const s = new Date(popup.startsAt).getTime();
    if (!Number.isNaN(s) && nowMs < s) return false;
  }
  if (popup.endsAt) {
    const e = new Date(popup.endsAt).getTime();
    if (!Number.isNaN(e) && nowMs > e) return false;
  }

  const targets = (popup.targetPages || []).map((t) => t.trim()).filter(Boolean);
  if (targets.length > 0 && !targets.includes('*')) {
    const matchesPath = targets.some((t) =>
      t === '/' ? currentPath === '/' : currentPath === t || currentPath.startsWith(`${t}/`)
    );
    if (!matchesPath) return false;
  }

  const lastDismissed = dismissedTimestamps[popup._id];
  if (popup.displayFrequency === 'once_ever' && lastDismissed) return false;
  if (popup.displayFrequency === 'once_per_day' && lastDismissed) {
    if (nowMs - lastDismissed < 24 * 60 * 60 * 1000) return false;
  }
  if (popup.displayFrequency === 'once_per_session' && sessionShownIds.includes(popup._id)) {
    return false;
  }

  return true;
}

export interface NavMenuItemInput {
  _id: string;
  label: string;
  url: string;
  parentId?: string | null;
  displayOrder: number;
  isVisible: boolean;
  openInNewTab?: boolean;
}

export interface NavMenuTreeNode extends NavMenuItemInput {
  children: NavMenuTreeNode[];
}

export function buildNavigationTree(items: NavMenuItemInput[]): NavMenuTreeNode[] {
  const visible = items.filter((i) => i.isVisible);
  const byId = new Map<string, NavMenuTreeNode>();
  for (const item of visible) {
    byId.set(String(item._id), { ...item, children: [] });
  }

  const roots: NavMenuTreeNode[] = [];
  for (const node of byId.values()) {
    const parentKey = node.parentId ? String(node.parentId) : null;
    if (parentKey && byId.has(parentKey)) {
      byId.get(parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: NavMenuTreeNode[]) => {
    list.sort((a, b) => a.displayOrder - b.displayOrder);
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}
