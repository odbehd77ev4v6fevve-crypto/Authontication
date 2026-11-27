import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSalesTimeSeries,
  computeOrderStatusBreakdown,
  computeTopSellingProducts,
  getNetRecognizedOrderAmount,
  isOrderRevenueEligible,
} from '../shared/adminAnalytics.ts';
import { buildOrderReportFilter } from '../server/src/modules/support/support.routes.ts';

test('isOrderRevenueEligible and getNetRecognizedOrderAmount exclude unpaid online orders and deduct partial refunds', () => {
  const unpaidSsl = {
    totalAmount: 3000,
    orderStatus: 'pending',
    paymentMethod: 'sslcommerz',
    paymentStatus: 'pending',
  };
  assert.equal(isOrderRevenueEligible(unpaidSsl), false);
  assert.equal(getNetRecognizedOrderAmount(unpaidSsl), 0);

  const cancelledOrder = {
    totalAmount: 2500,
    orderStatus: 'cancelled',
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
  };
  assert.equal(isOrderRevenueEligible(cancelledOrder), false);
  assert.equal(getNetRecognizedOrderAmount(cancelledOrder), 0);

  const codPending = {
    totalAmount: 1800,
    orderStatus: 'pending',
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
  };
  assert.equal(isOrderRevenueEligible(codPending), true);
  assert.equal(getNetRecognizedOrderAmount(codPending), 1800);

  const partialRefundSsl = {
    totalAmount: 4000,
    refundedAmount: 1200,
    orderStatus: 'refund_pending',
    paymentMethod: 'sslcommerz',
    paymentStatus: 'refund_pending',
  };
  assert.equal(isOrderRevenueEligible(partialRefundSsl), true);
  assert.equal(getNetRecognizedOrderAmount(partialRefundSsl), 2800);
});

test('buildSalesTimeSeries deducts partial refunds and excludes unpaid SSLCommerz orders', () => {
  const now = new Date('2026-11-26T12:00:00.000Z');
  const series = buildSalesTimeSeries(
    [
      {
        totalAmount: 5000,
        refundedAmount: 1500,
        orderStatus: 'delivered',
        paymentMethod: 'sslcommerz',
        paymentStatus: 'paid',
        createdAt: '2026-11-25T10:00:00.000Z',
      },
      {
        totalAmount: 9000,
        orderStatus: 'pending',
        paymentMethod: 'sslcommerz',
        paymentStatus: 'pending',
        createdAt: '2026-11-25T11:00:00.000Z',
      },
      {
        totalAmount: 2000,
        orderStatus: 'confirmed',
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
        createdAt: '2026-11-15T10:00:00.000Z',
      },
    ],
    '7D',
    now
  );

  // 5000 - 1500 refund = 3500; unpaid SSLCommerz (9000) excluded; previous window has 2000 COD
  assert.equal(series.totalRevenue, 3500);
  assert.equal(series.previousRevenue, 2000);
  assert.equal(series.growthPercent, 75);
});

test('computeOrderStatusBreakdown includes returns slice when return/refund orders exist and omits when 0', () => {
  const withoutReturns = computeOrderStatusBreakdown([
    { orderStatus: 'delivered' },
    { orderStatus: 'pending' },
  ]);
  assert.equal(withoutReturns.breakdown.length, 4);
  assert.equal(withoutReturns.breakdown.some((s) => s.key === 'returns'), false);

  const withReturns = computeOrderStatusBreakdown([
    { orderStatus: 'delivered' },
    { orderStatus: 'return_requested' },
    { orderStatus: 'refund_pending' },
  ]);
  assert.equal(withReturns.breakdown.length, 5);
  const returnsSlice = withReturns.breakdown.find((s) => s.key === 'returns');
  assert.ok(returnsSlice);
  assert.equal(returnsSlice.count, 2);
});

test('computeTopSellingProducts ignores cancelled/unpaid orders and never fabricates units from salesCount fallback', () => {
  const top = computeTopSellingProducts(
    [
      {
        totalAmount: 2000,
        orderStatus: 'pending',
        paymentMethod: 'sslcommerz',
        paymentStatus: 'pending',
        createdAt: '2026-11-25T10:00:00.000Z',
        items: [
          {
            productId: 'prod-1',
            productName: 'Unpaid Gadget',
            quantity: 3,
            unitPrice: 2000,
            lineTotal: 6000,
          },
        ],
      },
    ],
    [
      {
        _id: 'prod-1',
        name: 'Unpaid Gadget',
        sku: 'SKU-1',
        basePrice: 2000,
        salesCount: 99,
      },
    ],
    5
  );

  assert.equal(top.length, 0);
});

test('buildOrderReportFilter maps status, channel, date bounds, range presets, and escaped search', () => {
  const now = new Date('2026-11-26T12:00:00.000Z');

  const bkashFilter = buildOrderReportFilter(
    {
      status: 'confirmed',
      paymentMethod: 'bkash',
      paymentStatus: 'paid',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-15',
      q: 'NVX+100',
    },
    now
  );

  assert.equal(bkashFilter.orderStatus, 'confirmed');
  assert.equal(bkashFilter.paymentChannel, 'bkash');
  assert.equal(bkashFilter.paymentStatus, 'paid');

  const createdRange = bkashFilter.createdAt as { $gte: Date; $lte: Date };
  assert.equal(createdRange.$gte.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(createdRange.$lte.toISOString(), '2026-11-15T23:59:59.999Z');

  const orClauses = bkashFilter.$or as Array<Record<string, { $regex: string }>>;
  assert.equal(orClauses[0].orderNumber.$regex, 'NVX\\+100');

  const codRangeFilter = buildOrderReportFilter({ paymentMethod: 'cod', range: '7D' }, now);
  assert.equal(codRangeFilter.paymentMethod, 'cod');
  const rangeWindow = codRangeFilter.createdAt as { $gte: Date };
  assert.equal(
    rangeWindow.$gte.toISOString(),
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  );
});
