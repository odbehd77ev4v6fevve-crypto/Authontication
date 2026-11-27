import { normalizeHexColor, splitHeadingForHighlight, type BannerFontFamily, type BannerFontWeight } from './bannerHelpers.ts';
import { isSafeDestinationUrl } from './security.ts';

export type SlideshowPlacement = 'homepage' | 'cart' | 'wishlist' | 'checkout';

export type SlideTransitionEffect =
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'zoom_in'
  | 'zoom_out'
  | 'ken_burns'
  | 'none';

export type SlideAnimationSpeed = 'fast' | 'normal' | 'slow';
export type SlideIndicatorStyle = 'dots' | 'progress' | 'numbers' | 'thumbnails' | 'none';
export type SlideStatus = 'draft' | 'published' | 'scheduled' | 'inactive';
export type SlideHorizontalAlign = 'left' | 'center' | 'right';
export type SlideVerticalAlign = 'top' | 'center' | 'bottom';
export type SlideImagePosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type SlideOverlayType = 'solid' | 'gradient';
export type SlideGradientDirection =
  | 'to right'
  | 'to left'
  | 'to bottom'
  | 'to top'
  | '135deg'
  | '45deg';

export interface SlideshowSlideConfig {
  _id?: string;
  internalName: string;
  badgeText: string;
  mainHeading: string;
  highlightText: string;
  subtitle: string;
  description: string;

  primaryButtonText: string;
  primaryButtonUrl: string;
  primaryButtonNewTab: boolean;

  secondaryButtonText: string;
  secondaryButtonUrl: string;
  secondaryButtonNewTab: boolean;

  destinationUrl: string;
  destinationNewTab: boolean;

  desktopImageUrl: string;
  desktopImagePublicId: string;
  mobileImageUrl: string;
  mobileImagePublicId: string;
  altText: string;
  imagePosition: SlideImagePosition;

  horizontalAlign: SlideHorizontalAlign;
  verticalAlign: SlideVerticalAlign;
  contentMaxWidthPx: number;
  paddingPx: number;

  fontFamily: BannerFontFamily;
  fontWeight: BannerFontWeight;
  headingSizePx: number;
  subtitleSizePx: number;
  lineHeight: number;
  letterSpacingPx: number;
  textColor: string;
  highlightColor: string;
  primaryBtnBg: string;
  primaryBtnText: string;
  secondaryBtnBg: string;
  secondaryBtnText: string;

  overlayType: SlideOverlayType;
  overlayColor: string;
  overlayOpacity: number;
  gradientStart: string;
  gradientEnd: string;
  gradientStartOpacity: number;
  gradientEndOpacity: number;
  gradientDirection: SlideGradientDirection;
  blurPx: number;

  animationEffect: SlideTransitionEffect;
  animationDurationMs: number;
  animationDelayMs: number;

  displayOrder: number;
  status: SlideStatus;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SlideshowConfig {
  _id?: string;
  name: string;
  placement: SlideshowPlacement;
  targetPage: string;
  isActive: boolean;
  autoplay: boolean;
  infiniteLoop: boolean;
  pauseOnHover: boolean;
  animationSpeed: SlideAnimationSpeed;
  transitionEffect: SlideTransitionEffect;
  transitionDurationMs: number;
  autoplayIntervalMs: number;
  indicatorStyle: SlideIndicatorStyle;
  showIndicators: boolean;
  showArrows: boolean;
  desktopHeightPx: number;
  tabletHeightPx: number;
  mobileHeightPx: number;
  borderRadiusPx: number;
  compactMode: boolean;
  slides: SlideshowSlideConfig[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SlideshowPlacementMeta {
  placement: SlideshowPlacement;
  label: string;
  shortLabel: string;
  targetPage: string;
  description: string;
  defaultDesktopHeightPx: number;
  defaultTabletHeightPx: number;
  defaultMobileHeightPx: number;
  defaultCompactMode: boolean;
  defaultBorderRadiusPx: number;
}

export const SLIDESHOW_PLACEMENTS: SlideshowPlacement[] = [
  'homepage',
  'cart',
  'wishlist',
  'checkout',
];

export const SLIDESHOW_PLACEMENT_META: Record<SlideshowPlacement, SlideshowPlacementMeta> = {
  homepage: {
    placement: 'homepage',
    label: 'Homepage Slideshow',
    shortLabel: 'Homepage',
    targetPage: '/',
    description: 'Full-width hero campaign slideshow rendered at the top of the storefront homepage.',
    defaultDesktopHeightPx: 480,
    defaultTabletHeightPx: 380,
    defaultMobileHeightPx: 320,
    defaultCompactMode: false,
    defaultBorderRadiusPx: 20,
  },
  cart: {
    placement: 'cart',
    label: 'Cart Page Slideshow',
    shortLabel: 'Cart Page',
    targetPage: '/cart',
    description: 'Promotional upsell and free-shipping campaign slideshow integrated on /cart.',
    defaultDesktopHeightPx: 220,
    defaultTabletHeightPx: 200,
    defaultMobileHeightPx: 185,
    defaultCompactMode: true,
    defaultBorderRadiusPx: 18,
  },
  wishlist: {
    placement: 'wishlist',
    label: 'Wishlist Page Slideshow',
    shortLabel: 'Wishlist Page',
    targetPage: '/wishlist',
    description: 'Curated deals & restock alert slideshow displayed on the /wishlist dashboard.',
    defaultDesktopHeightPx: 260,
    defaultTabletHeightPx: 230,
    defaultMobileHeightPx: 200,
    defaultCompactMode: true,
    defaultBorderRadiusPx: 20,
  },
  checkout: {
    placement: 'checkout',
    label: 'Checkout Page Slideshow',
    shortLabel: 'Checkout Page',
    targetPage: '/checkout',
    description: 'Compact trust, delivery & payment highlight slideshow placed unobtrusively on /checkout.',
    defaultDesktopHeightPx: 175,
    defaultTabletHeightPx: 165,
    defaultMobileHeightPx: 155,
    defaultCompactMode: true,
    defaultBorderRadiusPx: 18,
  },
};

export interface InternalPageOption {
  label: string;
  path: string;
  group: 'Storefront' | 'Shopping & Account' | 'Informational';
}

export const INTERNAL_SLIDESHOW_PAGES: InternalPageOption[] = [
  { label: 'Home (/)', path: '/', group: 'Storefront' },
  { label: 'Shop All Products (/shop)', path: '/shop', group: 'Storefront' },
  { label: 'Flash Deals & Offers (/deals)', path: '/deals', group: 'Storefront' },
  { label: 'Shopping Cart (/cart)', path: '/cart', group: 'Shopping & Account' },
  { label: 'My Wishlist (/wishlist)', path: '/wishlist', group: 'Shopping & Account' },
  { label: 'Checkout (/checkout)', path: '/checkout', group: 'Shopping & Account' },
  { label: 'Track Order (/track-order)', path: '/track-order', group: 'Shopping & Account' },
  { label: 'Contact Us (/contact)', path: '/contact', group: 'Informational' },
  { label: 'About Us (/about)', path: '/about', group: 'Informational' },
  { label: 'Editorial Blog (/blog)', path: '/blog', group: 'Informational' },
  { label: 'FAQ (/faq)', path: '/faq', group: 'Informational' },
];

export function createDefaultSlideForPlacement(
  placement: SlideshowPlacement = 'homepage',
  displayOrder = 0
): SlideshowSlideConfig {
  const isCompact = placement === 'cart' || placement === 'checkout';
  return {
    internalName: `${SLIDESHOW_PLACEMENT_META[placement].shortLabel} Slide ${displayOrder + 1}`,
    badgeText:
      placement === 'checkout'
        ? 'Verified & Encrypted'
        : placement === 'cart'
        ? 'Cart Exclusive Perks'
        : placement === 'wishlist'
        ? 'Saved Favorites Alert'
        : 'Big Savings, Big Happiness',
    mainHeading:
      placement === 'checkout'
        ? 'Fast & Secure Nationwide Delivery'
        : placement === 'cart'
        ? 'Unlock Free Delivery Over ৳999'
        : placement === 'wishlist'
        ? 'My Curated Wishlist Deals'
        : 'Smart Shopping Bigger Savings!',
    highlightText:
      placement === 'checkout'
        ? 'Secure'
        : placement === 'cart'
        ? 'Free Delivery'
        : placement === 'wishlist'
        ? 'Wishlist'
        : 'Bigger',
    subtitle:
      placement === 'checkout'
        ? 'Cash on Delivery, bKash, Nagad & SSLCommerz protected checkout'
        : placement === 'cart'
        ? 'Add one more essential to enjoy complimentary shipping across Bangladesh'
        : placement === 'wishlist'
        ? 'Price drops and restock alerts on products you love'
        : 'Up to 60% Off on Top Electronics, Fashion & Essentials',
    description: '',
    primaryButtonText:
      placement === 'checkout' ? '' : placement === 'cart' ? 'Explore Add-Ons' : 'Shop Now',
    primaryButtonUrl: placement === 'cart' ? '/deals' : '/shop',
    primaryButtonNewTab: false,
    secondaryButtonText: '',
    secondaryButtonUrl: '',
    secondaryButtonNewTab: false,
    destinationUrl: placement === 'checkout' ? '' : '/shop',
    destinationNewTab: false,
    desktopImageUrl:
      placement === 'cart'
        ? '/src/assets/images/promo_electronics_bundle_1795621230553.jpg'
        : placement === 'wishlist'
        ? '/src/assets/images/promo_fashion_bundle_1795621230765.jpg'
        : placement === 'checkout'
        ? '/src/assets/images/promo_tech_laptops_1795621230990.jpg'
        : '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
    desktopImagePublicId: '',
    mobileImageUrl: '',
    mobileImagePublicId: '',
    altText: `${SLIDESHOW_PLACEMENT_META[placement].label} visual`,
    imagePosition: placement === 'homepage' ? 'top' : 'center',
    horizontalAlign: 'left',
    verticalAlign: 'center',
    contentMaxWidthPx: isCompact ? 680 : 620,
    paddingPx: isCompact ? 28 : 44,
    fontFamily: 'Poppins',
    fontWeight: '700',
    headingSizePx: placement === 'checkout' ? 24 : isCompact ? 28 : 44,
    subtitleSizePx: isCompact ? 14 : 17,
    lineHeight: 1.14,
    letterSpacingPx: 0,
    textColor: '#FFFFFF',
    highlightColor: '#A3E635',
    primaryBtnBg: '#A3E635',
    primaryBtnText: '#0F172A',
    secondaryBtnBg: '#FFFFFF',
    secondaryBtnText: '#FFFFFF',
    overlayType: 'gradient',
    overlayColor: '#052E16',
    overlayOpacity: 55,
    gradientStart: '#041E11',
    gradientEnd: '#06381C',
    gradientStartOpacity: 82,
    gradientEndOpacity: 30,
    gradientDirection: 'to right',
    blurPx: 0,
    animationEffect: 'fade',
    animationDurationMs: 600,
    animationDelayMs: 0,
    displayOrder,
    status: 'published',
    isActive: true,
    startsAt: null,
    endsAt: null,
  };
}

export function createDefaultSlideshowForPlacement(
  placement: SlideshowPlacement
): Omit<SlideshowConfig, '_id' | 'createdAt' | 'updatedAt'> {
  const meta = SLIDESHOW_PLACEMENT_META[placement];
  return {
    name: meta.label,
    placement,
    targetPage: meta.targetPage,
    isActive: true,
    autoplay: true,
    infiniteLoop: true,
    pauseOnHover: true,
    animationSpeed: 'normal',
    transitionEffect: 'fade',
    transitionDurationMs: 600,
    autoplayIntervalMs: 5000,
    indicatorStyle: placement === 'checkout' ? 'dots' : 'dots',
    showIndicators: true,
    showArrows: true,
    desktopHeightPx: meta.defaultDesktopHeightPx,
    tabletHeightPx: meta.defaultTabletHeightPx,
    mobileHeightPx: meta.defaultMobileHeightPx,
    borderRadiusPx: meta.defaultBorderRadiusPx,
    compactMode: meta.defaultCompactMode,
    slides: [createDefaultSlideForPlacement(placement, 0)],
  };
}

export function hexToRgba(hex: string | undefined, opacityPercent: number, fallbackHex = '#052E16'): string {
  const safeHex = normalizeHexColor(hex, fallbackHex).replace('#', '');
  const expanded =
    safeHex.length === 3
      ? safeHex
          .split('')
          .map((c) => c + c)
          .join('')
      : safeHex.slice(0, 6);
  const r = parseInt(expanded.slice(0, 2), 16) || 5;
  const g = parseInt(expanded.slice(2, 4), 16) || 46;
  const b = parseInt(expanded.slice(4, 6), 16) || 22;
  const alpha = Math.max(0, Math.min(1, Number(opacityPercent ?? 50) / 100));
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

export function getSlideshowOverlayCss(slide: Partial<SlideshowSlideConfig>): string {
  if (slide.overlayType === 'solid') {
    return hexToRgba(slide.overlayColor, slide.overlayOpacity ?? 52, '#052E16');
  }
  const dir = slide.gradientDirection || 'to right';
  const startRgba = hexToRgba(
    slide.gradientStart,
    slide.gradientStartOpacity ?? 80,
    '#041E11'
  );
  const endRgba = hexToRgba(slide.gradientEnd, slide.gradientEndOpacity ?? 25, '#06381C');
  return `linear-gradient(${dir}, ${startRgba} 0%, ${endRgba} 100%)`;
}

export function getSpeedDurationMs(
  speed: SlideAnimationSpeed | undefined,
  explicitDurationMs?: number
): number {
  if (explicitDurationMs && Number.isFinite(explicitDurationMs)) {
    return Math.max(150, Math.min(3000, Math.round(explicitDurationMs)));
  }
  switch (speed) {
    case 'fast':
      return 350;
    case 'slow':
      return 950;
    default:
      return 600;
  }
}

export function isSlideScheduleValid(
  startsAt?: string | Date | null,
  endsAt?: string | Date | null
): boolean {
  if (!startsAt || !endsAt) return true;
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return s <= e;
}

export function filterAndSortActiveSlides<
  T extends Pick<SlideshowSlideConfig, 'isActive' | 'status' | 'startsAt' | 'endsAt' | 'displayOrder'>,
>(slides: T[], now: Date = new Date()): T[] {
  return slides
    .map((slide, originalIdx) => ({ slide, originalIdx }))
    .filter(({ slide }) => {
      if (!slide.isActive) return false;
      if (slide.status !== 'published' && slide.status !== 'scheduled') return false;
      if (slide.startsAt) {
        const start = new Date(slide.startsAt);
        if (!Number.isNaN(start.getTime()) && now < start) return false;
      }
      if (slide.endsAt) {
        const end = new Date(slide.endsAt);
        if (!Number.isNaN(end.getTime()) && now > end) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const diff = (a.slide.displayOrder ?? 0) - (b.slide.displayOrder ?? 0);
      return diff !== 0 ? diff : a.originalIdx - b.originalIdx;
    })
    .map(({ slide }) => slide);
}

export function reorderSlidesById<T extends { _id?: string; displayOrder?: number }>(
  slides: T[],
  orderedSlideIds: string[]
): T[] {
  const byId = new Map<string, T>();
  const extras: T[] = [];

  for (const slide of slides) {
    if (slide._id) {
      byId.set(String(slide._id), slide);
    } else {
      extras.push(slide);
    }
  }

  const reordered: T[] = [];
  const seen = new Set<string>();
  for (const id of orderedSlideIds) {
    const key = String(id);
    const match = byId.get(key);
    if (match && !seen.has(key)) {
      reordered.push(match);
      seen.add(key);
    }
  }

  for (const slide of slides) {
    if (slide._id && !seen.has(String(slide._id))) {
      reordered.push(slide);
    }
  }
  reordered.push(...extras);

  return reordered.map((slide, idx) => ({
    ...slide,
    displayOrder: idx,
  }));
}

export function getNextSlideIndex(current: number, total: number, loop = true): number {
  if (total <= 1) return 0;
  const next = current + 1;
  if (next >= total) {
    return loop ? 0 : total - 1;
  }
  return next;
}

export function getPrevSlideIndex(current: number, total: number, loop = true): number {
  if (total <= 1) return 0;
  const prev = current - 1;
  if (prev < 0) {
    return loop ? total - 1 : 0;
  }
  return prev;
}

export function validateSlideInput(slide: Partial<SlideshowSlideConfig>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const heading = (slide.mainHeading || '').trim();
  if (heading.length < 2 || heading.length > 120) {
    errors.mainHeading = 'Slide heading must be between 2 and 120 characters.';
  }

  const desktopImg = (slide.desktopImageUrl || '').trim();
  if (!desktopImg) {
    errors.desktopImageUrl = 'A full-bleed background image is required for every slide.';
  } else if (!isSafeDestinationUrl(desktopImg, { allowRelative: true, allowEmpty: false })) {
    errors.desktopImageUrl = 'Desktop background image URL is invalid or unsafe.';
  }

  const mobileImg = (slide.mobileImageUrl || '').trim();
  if (mobileImg && !isSafeDestinationUrl(mobileImg, { allowRelative: true, allowEmpty: true })) {
    errors.mobileImageUrl = 'Mobile background image URL is invalid or unsafe.';
  }

  const destUrl = (slide.destinationUrl || '').trim();
  if (destUrl && !isSafeDestinationUrl(destUrl, { allowRelative: true, allowEmpty: true })) {
    errors.destinationUrl = 'Slide destination URL must be a valid path (/shop) or https:// URL.';
  }

  const primaryUrl = (slide.primaryButtonUrl || '').trim();
  if (primaryUrl && !isSafeDestinationUrl(primaryUrl, { allowRelative: true, allowEmpty: true })) {
    errors.primaryButtonUrl = 'Primary CTA URL must be a valid path (/shop) or https:// URL.';
  }

  const secondaryUrl = (slide.secondaryButtonUrl || '').trim();
  if (
    secondaryUrl &&
    !isSafeDestinationUrl(secondaryUrl, { allowRelative: true, allowEmpty: true })
  ) {
    errors.secondaryButtonUrl = 'Secondary CTA URL must be a valid path (/shop) or https:// URL.';
  }

  if (!isSlideScheduleValid(slide.startsAt, slide.endsAt)) {
    errors.schedule = 'Schedule end date must be after start date.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export { splitHeadingForHighlight };
