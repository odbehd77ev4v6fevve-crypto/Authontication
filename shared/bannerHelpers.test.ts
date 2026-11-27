import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BANNER_POSITION_OPTIONS,
  DEFAULT_BANNER_DRAFT,
  filterAndSortActiveBanners,
  getBannerAspectRatioNumeric,
  normalizeHexColor,
  sanitizeCustomCss,
  splitHeadingForHighlight,
  validateBannerDraft,
} from './bannerHelpers.ts';

test('sanitizeCustomCss allows safe styling properties and blocks XSS/injection vectors', () => {
  const input =
    'border: 2px solid #22c55e; letter-spacing: 1px; background-image: url(javascript:alert(1)); @import url("https://evil.com"); behavior: url(#default#VML); color: #ffffff; ';
  const result = sanitizeCustomCss(input);

  assert.equal(result.styleObject.border, '2px solid #22c55e');
  assert.equal(result.styleObject.letterSpacing, '1px');
  assert.equal(result.styleObject.color, '#ffffff');
  assert.equal(result.styleObject.backgroundImage, undefined);
  assert.ok(result.rejectedProperties.length >= 2);
  assert.ok(!result.sanitizedCssText.includes('javascript:'));
  assert.ok(!result.sanitizedCssText.includes('@import'));
});

test('splitHeadingForHighlight splits matching phrase case-insensitively', () => {
  assert.deepEqual(splitHeadingForHighlight('Smart Shopping Bigger Savings!', 'bigger'), {
    prefix: 'Smart Shopping ',
    highlight: 'Bigger',
    suffix: ' Savings!',
  });

  assert.deepEqual(splitHeadingForHighlight('Mega Winter Deals', 'Missing'), {
    prefix: 'Mega Winter Deals',
    highlight: '',
    suffix: '',
  });
});

test('filterAndSortActiveBanners enforces active/published/schedule/targeting and sorting', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const candidates = [
    {
      _id: 'b-expired',
      position: 'homepage_top_slider',
      isActive: true,
      status: 'published',
      displayOrder: 1,
      priority: 50,
      endsAt: '2026-11-25T00:00:00Z',
    },
    {
      _id: 'b-draft',
      position: 'homepage_top_slider',
      isActive: true,
      status: 'draft',
      displayOrder: 1,
      priority: 50,
    },
    {
      _id: 'b-future',
      position: 'homepage_top_slider',
      isActive: true,
      status: 'published',
      displayOrder: 1,
      priority: 50,
      startsAt: '2026-11-28T00:00:00Z',
    },
    {
      _id: 'b-second',
      position: 'homepage_top_slider',
      isActive: true,
      status: 'published',
      displayOrder: 2,
      priority: 100,
    },
    {
      _id: 'b-first-low-prio',
      position: 'homepage_top_slider',
      isActive: true,
      status: 'published',
      displayOrder: 1,
      priority: 5,
    },
    {
      _id: 'b-first-high-prio',
      position: 'homepage_top_slider',
      isActive: true,
      status: 'published',
      displayOrder: 1,
      priority: 25,
    },
    {
      _id: 'b-category-electronics',
      position: 'category_page_banner',
      isActive: true,
      status: 'published',
      displayOrder: 1,
      priority: 10,
      targetCategorySlugs: ['electronics'],
    },
  ];

  const topSlider = filterAndSortActiveBanners(candidates, {
    position: 'homepage_top_slider',
    now,
  });
  assert.deepEqual(
    topSlider.map((b) => b._id),
    ['b-first-high-prio', 'b-first-low-prio', 'b-second']
  );

  const fashionCat = filterAndSortActiveBanners(candidates, {
    position: 'category_page_banner',
    categorySlug: 'fashion',
    now,
  });
  assert.equal(fashionCat.length, 0);

  const electronicsCat = filterAndSortActiveBanners(candidates, {
    position: 'category_page_banner',
    categorySlug: 'electronics',
    now,
  });
  assert.equal(electronicsCat.length, 1);
});

test('validateBannerDraft rejects unsafe URLs and inverted schedules', () => {
  const safeRes = validateBannerDraft(DEFAULT_BANNER_DRAFT);
  assert.equal(safeRes.valid, true);

  const badRes = validateBannerDraft({
    ...DEFAULT_BANNER_DRAFT,
    mainHeading: 'A',
    buttonLink: 'javascript:alert(1)',
    startsAt: '2026-12-10T00:00:00Z',
    endsAt: '2026-12-01T00:00:00Z',
  });
  assert.equal(badRes.valid, false);
  assert.ok(badRes.errors.mainHeading);
  assert.ok(badRes.errors.buttonLink);
  assert.ok(badRes.errors.schedule);
});

test('aspect ratio & color normalization helpers return safe defaults', () => {
  assert.equal(getBannerAspectRatioNumeric('21:9'), '21 / 9');
  assert.equal(getBannerAspectRatioNumeric('custom', 5, 2), '5 / 2');
  assert.equal(normalizeHexColor('#16a34a', '#000000'), '#16a34a');
  assert.equal(normalizeHexColor('red;position:fixed', '#000000'), '#000000');
  assert.ok(BANNER_POSITION_OPTIONS.length >= 15);
});
