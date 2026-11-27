import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAutomaticDiscount,
  calculateCouponDiscount,
  calculateTaxAmount,
  computeTaxBreakdown,
  validateCheckoutPaymentChannel,
} from './pricing';
import {
  ALL_PERMISSIONS,
  hasEffectivePermission,
  resolveRolePermissions,
} from './rbac';
import {
  computeSessionTtl,
  isSafeDestinationUrl,
  sanitizeCsvCell,
  validatePasswordAgainstPolicy,
} from './security';
import { filterEligibleCustomerCoupons } from './wishlistHelpers';

test('resolveRolePermissions keeps super_admin and customer locked while honoring custom staff overrides', () => {
  const superPerms = resolveRolePermissions('super_admin', ['dashboard:view']);
  assert.equal(superPerms.length, ALL_PERMISSIONS.length);

  const customerPerms = resolveRolePermissions('customer', ['staff:manage', 'catalog:write']);
  assert.deepEqual(customerPerms, []);

  const customOrderMgr = resolveRolePermissions('order_manager', [
    'dashboard:view',
    'orders:read',
    'reports:read',
    'non_existent_perm',
  ]);
  assert.deepEqual(customOrderMgr, ['dashboard:view', 'orders:read', 'reports:read']);

  assert.equal(
    hasEffectivePermission(
      { role: 'order_manager', permissions: ['dashboard:view', 'reports:read'] },
      'reports:read'
    ),
    true
  );
  assert.equal(
    hasEffectivePermission(
      { role: 'order_manager', permissions: ['dashboard:view', 'reports:read'] },
      'orders:transition'
    ),
    false
  );
  assert.equal(
    hasEffectivePermission({ role: 'super_admin', permissions: [] }, 'staff:manage'),
    true
  );
  assert.equal(
    hasEffectivePermission({ role: 'customer', permissions: ['staff:manage'] }, 'staff:manage'),
    false
  );
});

test('security policy helpers validate password strength/length and compute bounded session TTL', () => {
  assert.equal(
    validatePasswordAgainstPolicy('short', { minPasswordLength: 8 }).valid,
    false
  );
  assert.equal(
    validatePasswordAgainstPolicy('alllowercase123', {
      minPasswordLength: 8,
      requireStrongPassword: true,
    }).valid,
    false
  );
  assert.equal(
    validatePasswordAgainstPolicy('StrongPass!2026', {
      minPasswordLength: 10,
      requireStrongPassword: true,
    }).valid,
    true
  );

  const clampedLow = computeSessionTtl(5);
  assert.equal(clampedLow.expiresInSeconds, 15 * 60);
  const standardTtl = computeSessionTtl(60);
  assert.equal(standardTtl.expiresInSeconds, 3600);
  assert.equal(standardTtl.maxAgeMs, 3600 * 1000);
});

test('tax calculation and computeTaxBreakdown handle disabled, exclusive, inclusive, and applyToShipping', () => {
  assert.equal(
    calculateTaxAmount(1000, 15, { enabled: false, taxInclusive: false, applyToShipping: true }, 100),
    0
  );

  const exclusive = computeTaxBreakdown({
    subtotalAfterDiscount: 2000,
    shippingCharge: 100,
    taxRate: 10,
    taxSettings: { enabled: true, taxInclusive: false, label: 'VAT', applyToShipping: true },
  });
  assert.equal(exclusive.taxAmount, 210);
  assert.equal(exclusive.taxAddedToTotal, 210);
  assert.equal(exclusive.taxInclusive, false);
  assert.equal(exclusive.taxLabel, 'VAT');

  const inclusive = computeTaxBreakdown({
    subtotalAfterDiscount: 1150,
    shippingCharge: 60,
    taxRate: 15,
    taxSettings: { enabled: true, taxInclusive: true, label: 'BD VAT', applyToShipping: false },
  });
  assert.equal(inclusive.taxAmount, 150);
  assert.equal(inclusive.taxAddedToTotal, 0);
  assert.equal(inclusive.taxInclusive, true);
  assert.equal(inclusive.taxLabel, 'BD VAT');
});

test('calculateCouponDiscount enforces eligibleCustomerGroupIds and calculateAutomaticDiscount picks best rule/VIP tier', () => {
  const rejectedGroupCoupon = calculateCouponDiscount(
    {
      code: 'VIPONLY',
      type: 'percentage',
      value: 15,
      minOrderAmount: 500,
      isActive: true,
      usedCount: 0,
      eligibleCustomerGroupIds: ['grp-vip'],
      userCustomerGroupId: 'grp-regular',
    },
    [{ productId: 'p1', categoryId: 'c1', unitPrice: 2000, quantity: 1 }]
  );
  assert.equal(rejectedGroupCoupon.valid, false);
  assert.equal(rejectedGroupCoupon.discountAmount, 0);

  const acceptedGroupCoupon = calculateCouponDiscount(
    {
      code: 'VIPONLY',
      type: 'percentage',
      value: 15,
      minOrderAmount: 500,
      isActive: true,
      usedCount: 0,
      eligibleCustomerGroupIds: ['grp-vip'],
      userCustomerGroupId: 'grp-vip',
    },
    [{ productId: 'p1', categoryId: 'c1', unitPrice: 2000, quantity: 1 }]
  );
  assert.equal(acceptedGroupCoupon.valid, true);
  assert.equal(acceptedGroupCoupon.discountAmount, 300);

  const now = new Date('2026-11-26T12:00:00Z');
  const autoCategoryRuleWins = calculateAutomaticDiscount({
    now,
    lines: [
      { productId: 'p1', categoryId: 'cat-elec', unitPrice: 5000, quantity: 1 },
      { productId: 'p2', categoryId: 'cat-books', unitPrice: 1000, quantity: 1 },
    ],
    userCustomerGroupId: 'grp-vip',
    customerGroup: { _id: 'grp-vip', name: 'VIP Club', discountPercent: 5, isActive: true },
    rules: [
      {
        name: 'Electronics 10% Off (Cap 450)',
        ruleType: 'percentage',
        value: 10,
        maxDiscountCap: 450,
        minOrderAmount: 1000,
        minQuantity: 1,
        targetScope: 'category',
        targetIds: ['cat-elec'],
        priority: 5,
        isActive: true,
      },
      {
        name: 'Expired Promo',
        ruleType: 'percentage',
        value: 50,
        minOrderAmount: 0,
        minQuantity: 1,
        targetScope: 'all',
        targetIds: [],
        endsAt: '2026-11-01T00:00:00Z',
        isActive: true,
      },
    ],
  });
  assert.equal(autoCategoryRuleWins.discountAmount, 450);
  assert.equal(autoCategoryRuleWins.appliedRuleName, 'Electronics 10% Off (Cap 450)');
  assert.equal(autoCategoryRuleWins.source, 'discount_rule');

  const vipBeatsRule = calculateAutomaticDiscount({
    now,
    lines: [{ productId: 'p1', categoryId: 'cat-elec', unitPrice: 5000, quantity: 1 }],
    userCustomerGroupId: 'grp-vip',
    customerGroup: { _id: 'grp-vip', name: 'Gold VIP', discountPercent: 12, isActive: true },
    rules: [
      {
        name: 'Flat 200',
        ruleType: 'fixed',
        value: 200,
        minOrderAmount: 0,
        minQuantity: 1,
        targetScope: 'all',
        isActive: true,
      },
    ],
  });
  assert.equal(vipBeatsRule.discountAmount, 600);
  assert.equal(vipBeatsRule.source, 'customer_group');
});

test('validateCheckoutPaymentChannel enforces channel-specific and SSLCommerz master toggles', () => {
  const methods = [
    { key: 'cod' as const, label: 'Cash on Delivery', enabled: true, displayOrder: 1 },
    { key: 'bkash' as const, label: 'bKash', enabled: false, displayOrder: 2 },
    { key: 'nagad' as const, label: 'Nagad', enabled: true, displayOrder: 3 },
    { key: 'sslcommerz' as const, label: 'SSLCommerz Online Gateway', enabled: false, displayOrder: 4 },
  ];

  const codCheck = validateCheckoutPaymentChannel(methods, 'cod', 'cod');
  assert.equal(codCheck.valid, true);
  assert.equal(codCheck.channel, 'cod');

  const disabledBkash = validateCheckoutPaymentChannel(methods, 'sslcommerz', 'bkash');
  assert.equal(disabledBkash.valid, false);

  const masterDisabledCard = validateCheckoutPaymentChannel(methods, 'sslcommerz', 'card');
  assert.equal(masterDisabledCard.valid, false);
});

test('filterEligibleCustomerCoupons, sanitizeCsvCell, and isSafeDestinationUrl enforce boundaries', () => {
  const eligible = filterEligibleCustomerCoupons(
    [
      { _id: '1', usageLimit: 5, usedCount: 5, perCustomerLimit: 1 },
      { _id: '2', usageLimit: 10, usedCount: 2, perCustomerLimit: 2 },
    ],
    { '2': 2 }
  );
  assert.deepEqual(eligible, []);

  assert.equal(sanitizeCsvCell('-2+3'), "'-2+3");
  assert.equal(sanitizeCsvCell('@HYPERLINK("http://x","y")'), `"'@HYPERLINK(""http://x"",""y"")"`);
  assert.equal(isSafeDestinationUrl('/admin/products'), true);
  assert.equal(isSafeDestinationUrl('data:text/html,<script>alert(1)</script>'), false);
});
