import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SLIDESHOW_PLACEMENT_META,
  createDefaultSlideForPlacement,
  createDefaultSlideshowForPlacement,
  filterAndSortActiveSlides,
  getNextSlideIndex,
  getPrevSlideIndex,
  getSlideshowOverlayCss,
  getSpeedDurationMs,
  isSlideScheduleValid,
  reorderSlidesById,
  validateSlideInput,
} from './slideshowHelpers.ts';

test('createDefaultSlideshowForPlacement builds independent defaults for all 4 placements', () => {
  const homepage = createDefaultSlideshowForPlacement('homepage');
  const cart = createDefaultSlideshowForPlacement('cart');
  const wishlist = createDefaultSlideshowForPlacement('wishlist');
  const checkout = createDefaultSlideshowForPlacement('checkout');

  assert.equal(homepage.targetPage, '/');
  assert.equal(cart.targetPage, '/cart');
  assert.equal(wishlist.targetPage, '/wishlist');
  assert.equal(checkout.targetPage, '/checkout');

  assert.equal(homepage.compactMode, false);
  assert.equal(cart.compactMode, true);
  assert.equal(wishlist.compactMode, true);
  assert.equal(checkout.compactMode, true);
  assert.ok(checkout.desktopHeightPx < homepage.desktopHeightPx);
  assert.equal(SLIDESHOW_PLACEMENT_META.checkout.defaultDesktopHeightPx, 175);
});

test('filterAndSortActiveSlides enforces active flag, status, schedule window, and displayOrder', () => {
  const now = new Date('2026-11-26T12:00:00.000Z');
  const base = createDefaultSlideForPlacement('homepage', 0);

  const slides = [
    { ...base, _id: 'draft-1', status: 'draft' as const, isActive: true, displayOrder: 0 },
    { ...base, _id: 'inactive-1', status: 'published' as const, isActive: false, displayOrder: 1 },
    {
      ...base,
      _id: 'future-1',
      status: 'scheduled' as const,
      isActive: true,
      startsAt: '2026-12-01T00:00:00.000Z',
      endsAt: null,
      displayOrder: 2,
    },
    {
      ...base,
      _id: 'expired-1',
      status: 'published' as const,
      isActive: true,
      startsAt: null,
      endsAt: '2026-11-01T00:00:00.000Z',
      displayOrder: 3,
    },
    {
      ...base,
      _id: 'valid-second',
      status: 'published' as const,
      isActive: true,
      startsAt: '2026-11-20T00:00:00.000Z',
      endsAt: '2026-12-05T00:00:00.000Z',
      displayOrder: 5,
    },
    {
      ...base,
      _id: 'valid-first',
      status: 'scheduled' as const,
      isActive: true,
      startsAt: '2026-11-25T00:00:00.000Z',
      endsAt: null,
      displayOrder: 1,
    },
  ];

  const active = filterAndSortActiveSlides(slides, now);
  assert.deepEqual(
    active.map((s) => s._id),
    ['valid-first', 'valid-second']
  );
});

test('validateSlideInput rejects dangerous URLs, missing desktop image, and inverted schedule', () => {
  const bad = validateSlideInput({
    mainHeading: 'Valid Heading',
    desktopImageUrl: '',
    destinationUrl: 'javascript:alert(1)',
    primaryButtonUrl: 'data:text/html,<script>',
    startsAt: '2026-12-10T00:00:00.000Z',
    endsAt: '2026-12-01T00:00:00.000Z',
  });

  assert.equal(bad.valid, false);
  assert.ok(bad.errors.desktopImageUrl);
  assert.ok(bad.errors.destinationUrl);
  assert.ok(bad.errors.primaryButtonUrl);
  assert.ok(bad.errors.schedule);

  const good = validateSlideInput({
    mainHeading: 'Winter Mega Sale',
    desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
    destinationUrl: '/deals',
    primaryButtonUrl: '/shop',
    startsAt: '2026-11-20T00:00:00.000Z',
    endsAt: '2026-12-20T00:00:00.000Z',
  });
  assert.equal(good.valid, true);
  assert.equal(Object.keys(good.errors).length, 0);
});

test('reorderSlidesById reorders specified IDs cleanly and preserves unmentioned items at tail', () => {
  const slides = [
    { _id: 's1', displayOrder: 0 },
    { _id: 's2', displayOrder: 1 },
    { _id: 's3', displayOrder: 2 },
  ];
  const reordered = reorderSlidesById(slides, ['s3', 's1']);
  assert.deepEqual(
    reordered.map((s) => ({ _id: s._id, displayOrder: s.displayOrder })),
    [
      { _id: 's3', displayOrder: 0 },
      { _id: 's1', displayOrder: 1 },
      { _id: 's2', displayOrder: 2 },
    ]
  );
});

test('getNextSlideIndex and getPrevSlideIndex wrap properly when loop=true and clamp when loop=false', () => {
  assert.equal(getNextSlideIndex(2, 3, true), 0);
  assert.equal(getNextSlideIndex(2, 3, false), 2);
  assert.equal(getPrevSlideIndex(0, 3, true), 2);
  assert.equal(getPrevSlideIndex(0, 3, false), 0);
  assert.equal(getNextSlideIndex(0, 1, true), 0);
});

test('getSlideshowOverlayCss and getSpeedDurationMs produce deterministic styling values', () => {
  const solidCss = getSlideshowOverlayCss({
    overlayType: 'solid',
    overlayColor: '#052E16',
    overlayOpacity: 60,
  });
  assert.equal(solidCss, 'rgba(5, 46, 22, 0.60)');

  const gradCss = getSlideshowOverlayCss({
    overlayType: 'gradient',
    gradientStart: '#000000',
    gradientEnd: '#15803D',
    gradientStartOpacity: 80,
    gradientEndOpacity: 20,
    gradientDirection: '135deg',
  });
  assert.ok(gradCss.startsWith('linear-gradient(135deg,'));
  assert.equal(getSpeedDurationMs('fast'), 350);
  assert.equal(getSpeedDurationMs('slow'), 950);
  assert.equal(getSpeedDurationMs('normal', 720), 720);
  assert.equal(isSlideScheduleValid('2026-12-01', '2026-12-05'), true);
  assert.equal(isSlideScheduleValid('2026-12-10', '2026-12-05'), false);
});
