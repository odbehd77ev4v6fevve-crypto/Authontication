import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCartOrderSummary,
  filterActiveCartBanners,
  filterCartRecommendations,
  getEffectiveCartItemMaxQty,
  normalizeVariantOptions,
} from './cartHelpers.ts';

test('normalizeVariantOptions handles Map and plain objects cleanly', () => {
  const mapInput = new Map<string, string>([
    ['Color', 'Emerald Green'],
    ['Storage', '256GB'],
  ]);
  assert.deepEqual(normalizeVariantOptions(mapInput), {
    Color: 'Emerald Green',
    Storage: '256GB',
  });

  assert.deepEqual(normalizeVariantOptions({ Size: 'L', Fabric: 'Cotton' }), {
    Size: 'L',
    Fabric: 'Cotton',
  });
  assert.deepEqual(normalizeVariantOptions(null), {});
});

test('getEffectiveCartItemMaxQty enforces stock, maxOrderQuantity, and backorders', () => {
  assert.equal(
    getEffectiveCartItemMaxQty({ availableStock: 25, maxOrderQuantity: 5, allowBackorders: false }),
    5
  );
  assert.equal(
    getEffectiveCartItemMaxQty({ availableStock: 3, maxOrderQuantity: 10, allowBackorders: false }),
    3
  );
  assert.equal(
    getEffectiveCartItemMaxQty({ availableStock: 0, maxOrderQuantity: 4, allowBackorders: true }),
    4
  );
  assert.equal(
    getEffectiveCartItemMaxQty({ availableStock: 0, maxOrderQuantity: 10, allowBackorders: false }),
    1
  );
});

test('computeCartOrderSummary dynamically respects free shipping threshold and store tax rate', () => {
  const belowThreshold = computeCartOrderSummary({
    subtotal: 700,
    discountAmount: 100,
    taxRate: 5,
    itemCount: 1,
    shippingConfig: {
      dhakaMetroCharge: 60,
      dhakaSuburbCharge: 90,
      outsideDhakaCharge: 130,
      freeShippingThreshold: 999,
      expressSurcharge: 80,
    },
  });

  assert.equal(belowThreshold.taxableSubtotal, 600);
  assert.equal(belowThreshold.qualifiesForFreeShipping, false);
  assert.equal(belowThreshold.amountToFreeShipping, 399);
  assert.equal(belowThreshold.estimatedShipping, 60);
  assert.equal(belowThreshold.taxAmount, 30);
  assert.equal(belowThreshold.estimatedTotal, 690);

  const aboveThreshold = computeCartOrderSummary({
    subtotal: 1500,
    discountAmount: 200,
    taxRate: 10,
    itemCount: 2,
    shippingConfig: {
      dhakaMetroCharge: 60,
      dhakaSuburbCharge: 90,
      outsideDhakaCharge: 130,
      freeShippingThreshold: 999,
      expressSurcharge: 80,
    },
  });

  assert.equal(aboveThreshold.taxableSubtotal, 1300);
  assert.equal(aboveThreshold.qualifiesForFreeShipping, true);
  assert.equal(aboveThreshold.amountToFreeShipping, 0);
  assert.equal(aboveThreshold.estimatedShipping, 0);
  assert.equal(aboveThreshold.taxAmount, 130);
  assert.equal(aboveThreshold.estimatedTotal, 1430);
});

test('filterActiveCartBanners enforces enabled state, schedule window, and displayOrder priority', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const active = filterActiveCartBanners(
    [
      { id: 'disabled', isEnabled: false, displayOrder: 0 },
      { id: 'future', isEnabled: true, displayOrder: 1, startsAt: '2026-12-01T00:00:00Z' },
      { id: 'expired', isEnabled: true, displayOrder: 1, endsAt: '2026-11-20T00:00:00Z' },
      { id: 'secondary', isEnabled: true, displayOrder: 5, startsAt: '2026-11-01T00:00:00Z' },
      { id: 'primary', isEnabled: true, displayOrder: 1, startsAt: null, endsAt: null },
    ],
    now
  );

  assert.deepEqual(
    active.map((b) => b.id),
    ['primary', 'secondary']
  );
});

test('filterCartRecommendations excludes existing cart items, unpublished, and out-of-stock items', () => {
  const result = filterCartRecommendations(
    [
      { _id: 'p1', status: 'published', availableStock: 10 },
      { _id: 'p2', status: 'published', availableStock: 0, allowBackorders: false },
      { _id: 'p3', status: 'draft', availableStock: 15 },
      { _id: 'p4', status: 'published', availableStock: 0, allowBackorders: true },
      { _id: 'p5', status: 'published', availableStock: 8 },
      { _id: 'p5', status: 'published', availableStock: 8 },
    ],
    ['p1'],
    5
  );

  assert.deepEqual(
    result.map((p) => String(p._id)),
    ['p4', 'p5']
  );
});
