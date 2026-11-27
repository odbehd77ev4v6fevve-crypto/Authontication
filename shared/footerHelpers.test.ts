import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FOOTER_CONFIG,
  cloneFooterConfig,
  duplicateFooterColumn,
  filterEnabledFooterPaymentBadges,
  filterVisibleFooterColumns,
  formatCopyrightText,
  isValidFooterUrl,
  moveArrayItem,
  normalizeFooterConfig,
  reorderListByIds,
  sanitizeFooterCustomCss,
} from './footerHelpers.ts';

test('formatCopyrightText interpolates year and company cleanly', () => {
  const res = formatCopyrightText(
    '© {year} {company}. All rights reserved.',
    'ShopVista BD',
    'auto',
    new Date('2026-06-15T00:00:00Z')
  );
  assert.equal(res, '© 2026 ShopVista BD. All rights reserved.');

  const explicitYear = formatCopyrightText(
    '© {year} {company}',
    'NOVARA',
    '2025–2026'
  );
  assert.equal(explicitYear, '© 2025–2026 NOVARA');
});

test('filterEnabledFooterPaymentBadges never exposes disabled store payment channels', () => {
  const badges = DEFAULT_FOOTER_CONFIG.payments.badges;
  const onlyCodAndBkash = filterEnabledFooterPaymentBadges(badges, [
    { key: 'cod', enabled: true },
    { key: 'bkash', enabled: true },
    { key: 'nagad', enabled: false },
    { key: 'card', enabled: false },
  ]);

  const keys = onlyCodAndBkash.map((b) => b.key);
  assert.deepEqual(keys, ['bkash', 'cod']);
  assert.equal(keys.includes('visa'), false);
  assert.equal(keys.includes('mastercard'), false);
  assert.equal(keys.includes('nagad'), false);
});

test('filterEnabledFooterPaymentBadges keeps custom always-visible badges when active', () => {
  const badges = [
    ...DEFAULT_FOOTER_CONFIG.payments.badges,
    {
      id: 'pay-ssl',
      key: 'sslcommerz' as const,
      storeChannelKey: 'sslcommerz' as const,
      label: 'SSLCommerz',
      isActive: true,
      displayOrder: 5,
      bgColor: '#0F172A',
      textColor: '#FFFFFF',
    },
  ];
  const filtered = filterEnabledFooterPaymentBadges(badges, [
    { key: 'cod', enabled: false },
    { key: 'bkash', enabled: false },
    { key: 'nagad', enabled: false },
    { key: 'card', enabled: true },
  ]);
  assert.deepEqual(
    filtered.map((b) => b.key),
    ['visa', 'mastercard', 'sslcommerz']
  );
});

test('filterVisibleFooterColumns respects active, visible, and guest/authenticated visibility', () => {
  const cols = cloneFooterConfig(DEFAULT_FOOTER_CONFIG).columns;
  cols[0].items.push({
    id: 'guest-only',
    label: 'Create Account',
    iconType: 'none',
    iconName: 'Info',
    linkType: 'internal_route',
    url: '/account',
    target: '_self',
    openInNewTab: false,
    displayOrder: 9,
    isActive: true,
    visibility: 'guest',
    children: [],
  });
  cols[1].isVisible = false;

  const anonCols = filterVisibleFooterColumns(cols, { isAuthenticated: false });
  assert.equal(anonCols.length, 2);
  assert.ok(anonCols[0].items.some((i) => i.id === 'guest-only'));
  assert.equal(
    anonCols[1].items.some((i) => i.id === 'item-addresses'),
    false
  );

  const authCols = filterVisibleFooterColumns(cols, { isAuthenticated: true });
  assert.equal(
    authCols[0].items.some((i) => i.id === 'guest-only'),
    false
  );
  assert.ok(authCols[1].items.some((i) => i.id === 'item-addresses'));
});

test('reorderListByIds and moveArrayItem preserve items and assign sequential displayOrder', () => {
  const items = [
    { id: 'a', displayOrder: 0 },
    { id: 'b', displayOrder: 1 },
    { id: 'c', displayOrder: 2 },
  ];
  const reordered = reorderListByIds(items, ['c', 'a']);
  assert.deepEqual(
    reordered.map((x) => [x.id, x.displayOrder]),
    [
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]
  );

  const moved = moveArrayItem(['x', 'y', 'z'], 0, 2);
  assert.deepEqual(moved, ['y', 'z', 'x']);
});

test('duplicateFooterColumn deep-copies column and generates unique item IDs', () => {
  const col = DEFAULT_FOOTER_CONFIG.columns[0];
  const dup = duplicateFooterColumn(col, 'col-dup', (idx) => `dup-item-${idx}`);
  assert.equal(dup.id, 'col-dup');
  assert.equal(dup.title, 'Customer Service (Copy)');
  assert.equal(dup.items.length, col.items.length);
  assert.equal(dup.items[0].id, 'dup-item-0');
  assert.notEqual(dup.items[0].id, col.items[0].id);
});

test('isValidFooterUrl, sanitizeFooterCustomCss, and normalizeFooterConfig block XSS payloads', () => {
  assert.equal(isValidFooterUrl('javascript:alert(1)'), false);
  assert.equal(isValidFooterUrl('data:text/html,<script>'), false);
  assert.equal(isValidFooterUrl('//evil.example.com'), false);
  assert.equal(isValidFooterUrl('/policies/privacy'), true);
  assert.equal(isValidFooterUrl('https://novaracommerce.com'), true);

  const cleanedCss = sanitizeFooterCustomCss(
    '@import url("https://bad"); footer { color: red; } </style><script>alert(1)</script>'
  );
  assert.equal(cleanedCss.includes('@import'), false);
  assert.equal(cleanedCss.includes('</style'), false);

  const normalized = normalizeFooterConfig({
    general: { ...DEFAULT_FOOTER_CONFIG.general, paddingTopPx: 999, backgroundColor: 'not-hex' },
    columns: [
      {
        ...DEFAULT_FOOTER_CONFIG.columns[0],
        items: [
          {
            ...DEFAULT_FOOTER_CONFIG.columns[0].items[0],
            url: 'javascript:alert(1)',
          },
        ],
      },
    ],
  });
  assert.equal(normalized.general.paddingTopPx, 120);
  assert.equal(normalized.general.backgroundColor, DEFAULT_FOOTER_CONFIG.general.backgroundColor);
  assert.equal(normalized.columns[0].items[0].url, '/');
});
