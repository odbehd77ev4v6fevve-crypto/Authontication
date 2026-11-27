import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMegaMenuItemTree,
  computeMegaMenuGridColumnsClass,
  filterActiveMegaMenuSlides,
  getMegaMenuTemplatePreset,
  isMenuScheduledActive,
  isValidNavigationUrl,
  reorderItemsByOrderedIds,
  resolveDynamicCategoryHierarchy,
  sanitizeMenuCustomCss,
  sanitizeSvgMarkup,
  validateParentRelationship,
} from './megaMenuHelpers.ts';

test('sanitizeSvgMarkup strips scripts, event handlers, and unsafe URIs while preserving clean SVG paths', () => {
  const dirty =
    '<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(9)</script><path d="M1 1 L10 10" onclick="steal()" fill="#16A34A"/><foreignObject><div>xss</div></foreignObject></svg>';
  const clean = sanitizeSvgMarkup(dirty);
  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.includes('onload'), false);
  assert.equal(clean.includes('onclick'), false);
  assert.equal(clean.includes('foreignObject'), false);
  assert.equal(clean.includes('<path d="M1 1 L10 10" fill="#16A34A" />'), true);

  assert.equal(sanitizeSvgMarkup('<div>not svg</div>'), '');
});

test('validateParentRelationship prevents self-parenting, circular references, and excessive nesting', () => {
  const items = [
    { _id: 'a', parentId: null },
    { _id: 'b', parentId: 'a' },
    { _id: 'c', parentId: 'b' },
    { _id: 'd', parentId: 'c' },
  ];

  // Self parent blocked
  assert.equal(validateParentRelationship(items, 'a', 'a', 4).valid, false);
  // Moving 'a' under its own descendant 'c' blocked
  assert.equal(validateParentRelationship(items, 'a', 'c', 4).valid, false);
  // Missing parent blocked
  assert.equal(validateParentRelationship(items, 'a', 'non-existent', 4).valid, false);
  // Exceeding maxDepth=3 blocked when placing new item under 'c' (depth 4)
  assert.equal(validateParentRelationship(items, null, 'c', 3).valid, false);
  // Valid placement under 'b' with maxDepth=4
  assert.equal(validateParentRelationship(items, null, 'b', 4).valid, true);
});

test('buildMegaMenuItemTree filters hidden items, sorts by displayOrder, and respects maxDepth', () => {
  interface TestNavItem {
    _id: string;
    parentId: string | null;
    displayOrder: number;
    isVisible: boolean;
    label: string;
    children?: TestNavItem[];
  }
  const items: TestNavItem[] = [
    { _id: '2', parentId: null, displayOrder: 2, isVisible: true, label: 'Deals' },
    { _id: '1', parentId: null, displayOrder: 1, isVisible: true, label: 'Shop' },
    { _id: 'hidden', parentId: null, displayOrder: 0, isVisible: false, label: 'Secret' },
    { _id: '1-2', parentId: '1', displayOrder: 2, isVisible: true, label: 'Laptops' },
    { _id: '1-1', parentId: '1', displayOrder: 1, isVisible: true, label: 'Phones' },
    { _id: '1-1-1', parentId: '1-1', displayOrder: 1, isVisible: true, label: '5G Flagships' },
  ];

  const treeDepth2 = buildMegaMenuItemTree(items, { includeHidden: false, maxDepth: 2 });
  assert.deepEqual(
    treeDepth2.map((n) => n._id),
    ['1', '2']
  );
  assert.deepEqual(
    treeDepth2[0].children?.map((c) => c._id),
    ['1-1', '1-2']
  );
  // Depth 3 pruned because maxDepth=2
  assert.equal(treeDepth2[0].children?.[0].children?.length, 0);
});

test('filterActiveMegaMenuSlides respects isActive, schedule windows, priority, and displayOrder', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const slides = [
    { _id: 'draft', isActive: true, status: 'draft' as const, priority: 100, displayOrder: 0 },
    { _id: 'inactive', isActive: false, status: 'published' as const, priority: 90, displayOrder: 0 },
    {
      _id: 'future',
      isActive: true,
      status: 'scheduled' as const,
      startsAt: '2026-12-01T00:00:00Z',
      priority: 50,
      displayOrder: 0,
    },
    {
      _id: 'expired',
      isActive: true,
      status: 'published' as const,
      endsAt: '2026-11-20T00:00:00Z',
      priority: 50,
      displayOrder: 0,
    },
    { _id: 'low-prio', isActive: true, status: 'published' as const, priority: 1, displayOrder: 0 },
    { _id: 'high-prio', isActive: true, status: 'scheduled' as const, priority: 10, displayOrder: 2 },
  ];

  const active = filterActiveMegaMenuSlides(slides, now);
  assert.deepEqual(
    active.map((s) => s._id),
    ['high-prio', 'low-prio']
  );
});

test('isMenuScheduledActive enforces status, visibility, schedule, and target path filters', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  assert.equal(isMenuScheduledActive({ status: 'draft' }, { now }), false);
  assert.equal(isMenuScheduledActive({ status: 'disabled' }, { now }), false);
  assert.equal(
    isMenuScheduledActive({ status: 'published', visibility: 'customers_only' }, { now, isAuthenticatedCustomer: false }),
    false
  );
  assert.equal(
    isMenuScheduledActive({ status: 'published', visibility: 'customers_only' }, { now, isAuthenticatedCustomer: true }),
    true
  );
  assert.equal(
    isMenuScheduledActive({ status: 'published', targetPaths: ['/deals', '/page/*'] }, { now, currentPath: '/page/eid-sale' }),
    true
  );
  assert.equal(
    isMenuScheduledActive({ status: 'published', targetPaths: ['/deals'] }, { now, currentPath: '/shop' }),
    false
  );
});

test('resolveDynamicCategoryHierarchy maps real DB categories and excludes inactive/excluded items', () => {
  const rawCats = [
    { _id: 'p1', name: 'Mobile & Tablets', slug: 'mobile-tablets', displayOrder: 1, isActive: true },
    { _id: 'p2', name: 'Electronics', slug: 'electronics', displayOrder: 2, isActive: true },
    { _id: 'p3', name: 'Hidden Cat', slug: 'hidden', displayOrder: 3, isActive: false },
    { _id: 's1', name: 'Smartphones', slug: 'smartphones', parentId: 'p1', displayOrder: 1, isActive: true },
    { _id: 's2', name: 'Tablets', slug: 'tablets', parentId: 'p1', displayOrder: 2, isActive: true },
    { _id: 's3', name: 'Inactive Sub', slug: 'old-phones', parentId: 'p1', displayOrder: 3, isActive: false },
  ];

  const tree = resolveDynamicCategoryHierarchy(rawCats, {
    mode: 'hybrid',
    excludedCategoryIds: ['s2'],
  });
  assert.equal(tree.length, 2);
  assert.equal(tree[0].name, 'Mobile & Tablets');
  assert.equal(tree[0].iconName, 'Smartphone');
  assert.deepEqual(
    tree[0].subcategories.map((s) => s.slug),
    ['smartphones']
  );
});

test('reorderItemsByOrderedIds, URL checks, CSS sanitization, and template presets behave safely', () => {
  const reordered = reorderItemsByOrderedIds(
    [
      { _id: 'a', displayOrder: 0 },
      { _id: 'b', displayOrder: 1 },
      { _id: 'c', displayOrder: 2 },
    ],
    ['c', 'a']
  );
  assert.deepEqual(
    reordered.map((x) => `${x._id}:${x.displayOrder}`),
    ['c:0', 'a:1', 'b:2']
  );

  assert.equal(isValidNavigationUrl('/category/smartphones'), true);
  assert.equal(isValidNavigationUrl('https://shop.example.com/deals'), true);
  assert.equal(isValidNavigationUrl('javascript:alert(1)'), false);

  const css = sanitizeMenuCustomCss('@import url(evil); .x { color: red; behavior: expression(alert(1)); }');
  assert.equal(css.includes('@import'), false);
  assert.equal(css.includes('expression('), false);

  const preset = getMegaMenuTemplatePreset('modern_green');
  assert.equal(preset.activeBgColor, '#DCFCE7');
  assert.equal(preset.activeTextColor, '#15803D');
  assert.equal(computeMegaMenuGridColumnsClass('custom', 3), 3);
});
