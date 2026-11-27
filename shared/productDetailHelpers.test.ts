import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPurchaseQuantity,
  computeDiscountAndSavings,
  computeProductStockState,
  computeReviewDistributionPercentages,
  extractVariantAttributeGroups,
  findMatchingVariant,
  isOptionValueAvailable,
  parseSafeProductVideoUrl,
  reorderArrayItem,
} from './productDetailHelpers';

test('computeProductStockState resolves in_stock, limited_stock, out_of_stock, and pre_order', () => {
  assert.deepEqual(
    computeProductStockState({ availableStock: 20, lowStockThreshold: 5, allowBackorders: false }),
    { status: 'in_stock', label: 'In Stock' }
  );

  assert.deepEqual(
    computeProductStockState({ availableStock: 3, lowStockThreshold: 5, allowBackorders: false }),
    { status: 'limited_stock', label: 'Limited Stock (3 left)' }
  );

  assert.deepEqual(
    computeProductStockState({ availableStock: 0, lowStockThreshold: 5, allowBackorders: false }),
    { status: 'out_of_stock', label: 'Out of Stock' }
  );

  assert.deepEqual(
    computeProductStockState({ availableStock: 0, lowStockThreshold: 5, allowBackorders: true }),
    { status: 'pre_order', label: 'Pre-order' }
  );
});

test('computeDiscountAndSavings computes discount percentage and savings amount accurately', () => {
  assert.deepEqual(computeDiscountAndSavings(34900, 44900), {
    discountPercent: 22,
    savingsAmount: 10000,
  });

  assert.deepEqual(computeDiscountAndSavings(2000, 2000), {
    discountPercent: 0,
    savingsAmount: 0,
  });

  assert.deepEqual(computeDiscountAndSavings(2000, null), {
    discountPercent: 0,
    savingsAmount: 0,
  });

  assert.deepEqual(computeDiscountAndSavings(2500, 2000), {
    discountPercent: 0,
    savingsAmount: 0,
  });
});

test('variant attribute extraction, matching, and cross-option availability work together', () => {
  const variants = [
    {
      _id: 'v1',
      sku: 'SONY-BLK-STD',
      title: 'Midnight Black / Standard',
      options: { Color: 'Midnight Black', Edition: 'Standard' },
      price: 34900,
      stockOnHand: 10,
      reservedStock: 2,
      isActive: true,
    },
    {
      _id: 'v2',
      sku: 'SONY-SLV-STD',
      title: 'Platinum Silver / Standard',
      options: { Color: 'Platinum Silver', Edition: 'Standard' },
      price: 35900,
      stockOnHand: 2,
      reservedStock: 2,
      isActive: true,
    },
    {
      _id: 'v3',
      sku: 'SONY-BLK-PRO',
      title: 'Midnight Black / Travel Bundle',
      options: { Color: 'Midnight Black', Edition: 'Travel Bundle' },
      price: 38900,
      stockOnHand: 5,
      reservedStock: 0,
      isActive: true,
    },
    {
      _id: 'v4',
      sku: 'SONY-OLD',
      title: 'Discontinued',
      options: { Color: 'Blue', Edition: 'Standard' },
      price: 30000,
      stockOnHand: 4,
      reservedStock: 0,
      isActive: false,
    },
  ];

  const groups = extractVariantAttributeGroups(variants);
  assert.deepEqual(groups, [
    { name: 'Color', values: ['Midnight Black', 'Platinum Silver'] },
    { name: 'Edition', values: ['Standard', 'Travel Bundle'] },
  ]);

  const matched = findMatchingVariant(variants, {
    Color: 'Midnight Black',
    Edition: 'Travel Bundle',
  });
  assert.equal(matched?._id, 'v3');

  const noMatch = findMatchingVariant(variants, {
    Color: 'Platinum Silver',
    Edition: 'Travel Bundle',
  });
  assert.equal(noMatch, null);

  assert.deepEqual(
    isOptionValueAvailable(variants, { Color: 'Midnight Black', Edition: 'Standard' }, 'Color', 'Platinum Silver'),
    { exists: true, inStock: false }
  );
  assert.deepEqual(
    isOptionValueAvailable(variants, { Color: 'Midnight Black', Edition: 'Standard' }, 'Edition', 'Travel Bundle'),
    { exists: true, inStock: true }
  );
});

test('clampPurchaseQuantity bounds requested qty by stock, maxOrderQuantity, and backorders', () => {
  assert.equal(
    clampPurchaseQuantity({ requested: 12, availableStock: 8, maxOrderQuantity: 10, allowBackorders: false }),
    8
  );
  assert.equal(
    clampPurchaseQuantity({ requested: 8, availableStock: 20, maxOrderQuantity: 4, allowBackorders: false }),
    4
  );
  assert.equal(
    clampPurchaseQuantity({ requested: 0, availableStock: 20, maxOrderQuantity: 4, allowBackorders: false }),
    1
  );
  assert.equal(
    clampPurchaseQuantity({ requested: 6, availableStock: 0, maxOrderQuantity: 3, allowBackorders: true }),
    3
  );
  assert.equal(
    clampPurchaseQuantity({ requested: 5, availableStock: 0, maxOrderQuantity: 10, allowBackorders: false }),
    1
  );
});

test('computeReviewDistributionPercentages calculates percentages and handles empty reviews', () => {
  assert.deepEqual(computeReviewDistributionPercentages({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, 0), {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });

  assert.deepEqual(computeReviewDistributionPercentages({ 5: 87, 4: 8, 3: 3, 2: 1, 1: 1 }, 100), {
    5: 87,
    4: 8,
    3: 3,
    2: 1,
    1: 1,
  });
});

test('parseSafeProductVideoUrl validates safe video links and rejects dangerous protocols', () => {
  const yt = parseSafeProductVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.valid, true);
  assert.equal(yt.type, 'youtube');
  assert.equal(yt.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');

  const shortYt = parseSafeProductVideoUrl('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(shortYt.valid, true);
  assert.equal(shortYt.type, 'youtube');

  const vimeo = parseSafeProductVideoUrl('https://vimeo.com/12345678');
  assert.equal(vimeo.valid, true);
  assert.equal(vimeo.type, 'vimeo');
  assert.equal(vimeo.embedUrl, 'https://player.vimeo.com/video/12345678?autoplay=1');

  const mp4 = parseSafeProductVideoUrl('https://cdn.example.com/videos/headphones.mp4');
  assert.equal(mp4.valid, true);
  assert.equal(mp4.type, 'direct');

  const localMp4 = parseSafeProductVideoUrl('/assets/demo.mp4');
  assert.equal(localMp4.valid, true);
  assert.equal(localMp4.type, 'direct');

  assert.equal(parseSafeProductVideoUrl('javascript:alert(1)').valid, false);
  assert.equal(parseSafeProductVideoUrl('data:text/html,<script>').valid, false);
  assert.equal(parseSafeProductVideoUrl('//evil.com/video.mp4').valid, false);
  assert.equal(parseSafeProductVideoUrl('https://evil.com/landing-page').valid, false);
});

test('reorderArrayItem swaps positions safely without mutating invalid indices', () => {
  assert.deepEqual(reorderArrayItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(reorderArrayItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(reorderArrayItem(['a', 'b', 'c'], -1, 1), ['a', 'b', 'c']);
  assert.deepEqual(reorderArrayItem(['a', 'b', 'c'], 1, 5), ['a', 'b', 'c']);
});
