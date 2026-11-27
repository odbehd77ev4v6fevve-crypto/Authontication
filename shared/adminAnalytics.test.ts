import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNavigationTree,
  buildSalesTimeSeries,
  computeGrowthPercent,
  computeOrderStatusBreakdown,
  computeTopSellingProducts,
  formatRelativeTime,
  shouldShowPopup,
} from './adminAnalytics.ts';
import { hasPermission } from './rbac.ts';

test('computeGrowthPercent handles positive, negative, zero, and no-baseline growth', () => {
  assert.equal(computeGrowthPercent(150, 100), 50);
  assert.equal(computeGrowthPercent(80, 100), -20);
  assert.equal(computeGrowthPercent(0, 0), 0);
  assert.equal(computeGrowthPercent(500, 0), null);
});

test('buildSalesTimeSeries aggregates current and previous windows and excludes cancelled orders', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const orders = [
    { totalAmount: 1000, orderStatus: 'delivered', createdAt: '2026-11-25T10:00:00Z' },
    { totalAmount: 500, orderStatus: 'processing', createdAt: '2026-11-22T10:00:00Z' },
    { totalAmount: 9999, orderStatus: 'cancelled', createdAt: '2026-11-24T10:00:00Z' },
    { totalAmount: 1000, orderStatus: 'delivered', createdAt: '2026-11-15T10:00:00Z' },
  ];

  const series = buildSalesTimeSeries(orders, '7D', now);
  assert.equal(series.totalRevenue, 1500);
  assert.equal(series.previousRevenue, 1000);
  assert.equal(series.growthPercent, 50);
  assert.equal(series.points.length, 7);
  assert.equal(
    series.points.reduce((sum, p) => sum + p.revenue, 0),
    1500
  );
});

test('computeOrderStatusBreakdown buckets orders into Delivered, Processing, Pending, Cancelled', () => {
  const result = computeOrderStatusBreakdown([
    { orderStatus: 'delivered' },
    { orderStatus: 'delivered' },
    { orderStatus: 'confirmed' },
    { orderStatus: 'shipped' },
    { orderStatus: 'pending' },
    { orderStatus: 'cancelled' },
    { orderStatus: 'refunded' },
  ]);

  assert.equal(result.totalOrders, 7);
  const byKey = new Map(result.breakdown.map((b) => [b.key, b]));
  assert.equal(byKey.get('delivered')?.count, 2);
  assert.equal(byKey.get('processing')?.count, 2);
  assert.equal(byKey.get('pending')?.count, 1);
  assert.equal(byKey.get('cancelled')?.count, 2);
});

test('computeTopSellingProducts ranks by units sold from real orders and computes bar progress', () => {
  const products = [
    { _id: 'p1', name: 'Earbuds Pro', sku: 'SKU1', basePrice: 2000 },
    { _id: 'p2', name: 'Smart Watch', sku: 'SKU2', basePrice: 4000 },
  ];
  const orders = [
    {
      totalAmount: 10000,
      orderStatus: 'delivered',
      createdAt: '2026-11-25T00:00:00Z',
      items: [
        { productId: 'p1', productName: 'Earbuds Pro', quantity: 4, unitPrice: 2000, lineTotal: 8000 },
        { productId: 'p2', productName: 'Smart Watch', quantity: 2, unitPrice: 4000, lineTotal: 8000 },
      ],
    },
    {
      totalAmount: 8000,
      orderStatus: 'cancelled',
      createdAt: '2026-11-25T00:00:00Z',
      items: [{ productId: 'p2', productName: 'Smart Watch', quantity: 10, unitPrice: 4000, lineTotal: 40000 }],
    },
  ];

  const top = computeTopSellingProducts(orders, products, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].name, 'Earbuds Pro');
  assert.equal(top[0].unitsSold, 4);
  assert.equal(top[0].progressPercent, 100);
  assert.equal(top[1].unitsSold, 2);
  assert.equal(top[1].progressPercent, 50);
});

test('shouldShowPopup enforces schedule, target page, and frequency dismissal rules', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const popup = {
    _id: 'pop1',
    isEnabled: true,
    displayFrequency: 'once_per_day' as const,
    targetPages: ['/shop', '/deals'],
    startsAt: '2026-11-20T00:00:00Z',
    endsAt: '2026-11-30T00:00:00Z',
  };

  assert.equal(shouldShowPopup(popup, '/shop', {}, [], now), true);
  assert.equal(shouldShowPopup(popup, '/cart', {}, [], now), false);
  assert.equal(
    shouldShowPopup(popup, '/shop', { pop1: now.getTime() - 2 * 60 * 60 * 1000 }, [], now),
    false
  );
  assert.equal(
    shouldShowPopup(popup, '/shop', { pop1: now.getTime() - 25 * 60 * 60 * 1000 }, [], now),
    true
  );
});

test('buildNavigationTree nests children and filters invisible items', () => {
  const tree = buildNavigationTree([
    { _id: '1', label: 'Shop', url: '/shop', displayOrder: 1, isVisible: true },
    { _id: '2', label: 'Electronics', url: '/category/electronics', parentId: '1', displayOrder: 2, isVisible: true },
    { _id: '3', label: 'Audio', url: '/category/audio', parentId: '1', displayOrder: 1, isVisible: true },
    { _id: '4', label: 'Hidden', url: '/hidden', displayOrder: 0, isVisible: false },
  ]);

  assert.equal(tree.length, 1);
  assert.equal(tree[0].children.map((c) => c.label).join(','), 'Audio,Electronics');
});

test('formatRelativeTime and new RBAC roles behave properly', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  assert.equal(formatRelativeTime('2026-11-26T11:55:00Z', now), '5m ago');
  assert.equal(formatRelativeTime('2026-11-26T09:00:00Z', now), '3h ago');

  assert.equal(hasPermission('marketing_manager', 'coupons:write'), true);
  assert.equal(hasPermission('marketing_manager', 'staff:manage'), false);
  assert.equal(hasPermission('read_only_analyst', 'reports:read'), true);
  assert.equal(hasPermission('read_only_analyst', 'catalog:write'), false);
});
