import { isSafeDestinationUrl } from './security.ts';

export type BannerAspectRatio = '16:9' | '4:3' | '1:1' | '21:9' | 'custom';

export type BannerSizePreset =
  | 'full_width'
  | 'container_width'
  | 'large'
  | 'medium'
  | 'small'
  | 'custom';

export type BannerPositionSlot =
  | 'homepage_top_slider'
  | 'homepage_secondary_banner'
  | 'below_categories'
  | 'above_featured_products'
  | 'below_featured_products'
  | 'above_best_sellers'
  | 'below_best_sellers'
  | 'above_top_rated'
  | 'below_top_rated'
  | 'above_new_arrivals'
  | 'below_new_arrivals'
  | 'above_on_sale'
  | 'below_on_sale'
  | 'between_sections'
  | 'category_page_banner'
  | 'category_page_sidebar'
  | 'product_listing_page'
  | 'product_detail_page'
  | 'cart_page'
  | 'checkout_page'
  | 'wishlist_page'
  | 'custom_cms_page'
  | 'global_top_strip';

export type BannerBackgroundType = 'solid' | 'gradient' | 'image' | 'overlay';

export type BannerProductSelectionMode =
  | 'none'
  | 'featured'
  | 'best_sellers'
  | 'latest'
  | 'custom';

export type BannerAnimationEffect = 'fade' | 'slide_up' | 'slide_left' | 'zoom' | 'none';

export type BannerAnimationSpeed = 'fast' | 'normal' | 'slow';

export type BannerFontFamily =
  | 'Plus Jakarta Sans'
  | 'Poppins'
  | 'Outfit'
  | 'DM Sans'
  | 'Manrope'
  | 'Playfair Display';

export type BannerFontWeight = '400' | '500' | '600' | '700' | '800';

export type BannerTextAlignment = 'left' | 'center' | 'right';

export type BannerPatternType = 'dots' | 'grid' | 'diagonal';

export interface BannerDraftConfig {
  _id?: string;
  name: string;
  aspectRatio: BannerAspectRatio;
  customAspectWidth: number;
  customAspectHeight: number;
  bannerSize: BannerSizePreset;
  position: BannerPositionSlot;
  displayOrder: number;
  priority: number;
  isActive: boolean;
  status: 'draft' | 'published';
  startsAt?: string | null;
  endsAt?: string | null;

  // Text & Style
  badgeText: string;
  mainHeading: string;
  highlightText: string;
  subHeading: string;
  buttonText: string;
  buttonLink: string;
  altText: string;
  fontFamily: BannerFontFamily;
  fontWeight: BannerFontWeight;
  textAlignment: BannerTextAlignment;
  letterSpacingPx: number;
  textColor: string;
  highlightColor: string;
  buttonBgColor: string;
  buttonTextColor: string;

  // Background Settings
  backgroundType: BannerBackgroundType;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientDirection: string;
  backgroundOpacity: number;
  desktopImageUrl: string;
  desktopImagePublicId?: string;
  mobileImageUrl: string;
  mobileImagePublicId?: string;

  // Product Selection & Targeting
  productSelectionMode: BannerProductSelectionMode;
  selectedProductIds: string[];
  targetCategorySlugs: string[];
  targetCustomPageSlugs: string[];

  // Animation Settings
  animationEffect: BannerAnimationEffect;
  animationSpeed: BannerAnimationSpeed;
  autoPlay: boolean;
  loop: boolean;
  animationDelaySec: number;

  // Advanced Settings
  bannerWidthPx: number;
  bannerHeightPx: number;
  paddingPx: number;
  borderRadiusPx: number;
  boxShadow: boolean;

  // Additional Tools
  overlayEnabled: boolean;
  overlayColor: string;
  overlayOpacity: number;
  patternEnabled: boolean;
  patternType: BannerPatternType;
  blurEnabled: boolean;
  blurPx: number;
  customCss: string;
}

export interface BannerPositionOption {
  value: BannerPositionSlot;
  label: string;
  group: 'Homepage' | 'Catalog & Product' | 'Cart & Account' | 'Global & CMS';
  description: string;
}

export const BANNER_POSITION_OPTIONS: BannerPositionOption[] = [
  {
    value: 'homepage_top_slider',
    label: 'Top Slider (Homepage Hero)',
    group: 'Homepage',
    description: 'Primary campaign hero slot at the top of the homepage.',
  },
  {
    value: 'homepage_secondary_banner',
    label: 'Homepage Secondary Banner',
    group: 'Homepage',
    description: 'Secondary promotional showcase below the hero area.',
  },
  {
    value: 'below_categories',
    label: 'Below Categories',
    group: 'Homepage',
    description: 'Rendered directly beneath Shop by Category.',
  },
  {
    value: 'above_featured_products',
    label: 'Above Featured Products',
    group: 'Homepage',
    description: 'Rendered immediately above the Featured Products section.',
  },
  {
    value: 'below_featured_products',
    label: 'Below Featured Products',
    group: 'Homepage',
    description: 'Rendered immediately below the Featured Products grid.',
  },
  {
    value: 'above_best_sellers',
    label: 'Above Best Sellers',
    group: 'Homepage',
    description: 'Rendered right above Best Sellers.',
  },
  {
    value: 'below_best_sellers',
    label: 'Below Best Sellers',
    group: 'Homepage',
    description: 'Rendered directly below Best Sellers.',
  },
  {
    value: 'above_top_rated',
    label: 'Above Trending / Top Rated',
    group: 'Homepage',
    description: 'Rendered right above Top Rated Products.',
  },
  {
    value: 'below_top_rated',
    label: 'Below Trending / Top Rated',
    group: 'Homepage',
    description: 'Rendered right below Top Rated Products.',
  },
  {
    value: 'above_new_arrivals',
    label: 'Above Latest / New Arrivals',
    group: 'Homepage',
    description: 'Rendered right above New Arrivals.',
  },
  {
    value: 'below_new_arrivals',
    label: 'Below Latest / New Arrivals',
    group: 'Homepage',
    description: 'Rendered right below New Arrivals.',
  },
  {
    value: 'above_on_sale',
    label: 'Above Special Offers & Deals',
    group: 'Homepage',
    description: 'Rendered above the On Sale products section.',
  },
  {
    value: 'below_on_sale',
    label: 'Below Special Offers & Deals',
    group: 'Homepage',
    description: 'Rendered below the On Sale products section.',
  },
  {
    value: 'between_sections',
    label: 'Between Homepage Sections',
    group: 'Homepage',
    description: 'Mid-page divider banner between storefront product bands.',
  },
  {
    value: 'category_page_banner',
    label: 'Category Page Banner',
    group: 'Catalog & Product',
    description: 'Displayed above category product listings (supports category targeting).',
  },
  {
    value: 'category_page_sidebar',
    label: 'Category Page Sidebar',
    group: 'Catalog & Product',
    description: 'Displayed inside the filter sidebar on category and catalog pages.',
  },
  {
    value: 'product_listing_page',
    label: 'Product Listing Page (/shop)',
    group: 'Catalog & Product',
    description: 'Displayed on main /shop, /deals, /brand, and /search catalog views.',
  },
  {
    value: 'product_detail_page',
    label: 'Product Detail Page',
    group: 'Catalog & Product',
    description: 'Displayed on product detail pages.',
  },
  {
    value: 'cart_page',
    label: 'Cart Page',
    group: 'Cart & Account',
    description: 'Displayed inside the shopping cart page.',
  },
  {
    value: 'checkout_page',
    label: 'Checkout Page',
    group: 'Cart & Account',
    description: 'Displayed on the checkout flow page.',
  },
  {
    value: 'wishlist_page',
    label: 'Wishlist Page',
    group: 'Cart & Account',
    description: 'Displayed in the customer wishlist dashboard.',
  },
  {
    value: 'custom_cms_page',
    label: 'Custom CMS Page',
    group: 'Global & CMS',
    description: 'Displayed on published custom static CMS pages.',
  },
  {
    value: 'global_top_strip',
    label: 'Global Header Promotional Strip',
    group: 'Global & CMS',
    description: 'Displayed below the storefront header across public pages.',
  },
];

export const BANNER_SIZE_OPTIONS: Array<{
  value: BannerSizePreset;
  label: string;
  widthPx: number;
  heightPx: number;
}> = [
  { value: 'full_width', label: 'Full Width (1920x600)', widthPx: 1920, heightPx: 600 },
  { value: 'container_width', label: 'Container Width (1280x480)', widthPx: 1280, heightPx: 480 },
  { value: 'large', label: 'Large (1280x420)', widthPx: 1280, heightPx: 420 },
  { value: 'medium', label: 'Medium (1280x320)', widthPx: 1280, heightPx: 320 },
  { value: 'small', label: 'Small Strip (1280x180)', widthPx: 1280, heightPx: 180 },
  { value: 'custom', label: 'Custom Width & Height', widthPx: 1200, heightPx: 400 },
];

export const DEFAULT_BANNER_DRAFT: BannerDraftConfig = {
  name: 'Smart Shopping Campaign',
  aspectRatio: '16:9',
  customAspectWidth: 16,
  customAspectHeight: 9,
  bannerSize: 'full_width',
  position: 'homepage_top_slider',
  displayOrder: 1,
  priority: 10,
  isActive: true,
  status: 'published',
  startsAt: null,
  endsAt: null,

  badgeText: 'Big Savings, Big Happiness',
  mainHeading: 'Smart Shopping Bigger Savings!',
  highlightText: 'Bigger',
  subHeading: 'Up to 70% Off on Top Brands Across Bangladesh',
  buttonText: 'Shop Now',
  buttonLink: '/shop',
  altText: 'Smart Shopping Bigger Savings promotional banner',
  fontFamily: 'Poppins',
  fontWeight: '700',
  textAlignment: 'left',
  letterSpacingPx: 0,
  textColor: '#FFFFFF',
  highlightColor: '#A3E635',
  buttonBgColor: '#A3E635',
  buttonTextColor: '#0F172A',

  backgroundType: 'gradient',
  solidColor: '#15803D',
  gradientStart: '#06381C',
  gradientEnd: '#22C55E',
  gradientDirection: '135deg',
  backgroundOpacity: 100,
  desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
  desktopImagePublicId: '',
  mobileImageUrl: '',
  mobileImagePublicId: '',

  productSelectionMode: 'none',
  selectedProductIds: [],
  targetCategorySlugs: [],
  targetCustomPageSlugs: [],

  animationEffect: 'fade',
  animationSpeed: 'normal',
  autoPlay: true,
  loop: true,
  animationDelaySec: 3,

  bannerWidthPx: 1920,
  bannerHeightPx: 460,
  paddingPx: 36,
  borderRadiusPx: 20,
  boxShadow: true,

  overlayEnabled: true,
  overlayColor: '#052E16',
  overlayOpacity: 35,
  patternEnabled: false,
  patternType: 'dots',
  blurEnabled: false,
  blurPx: 6,
  customCss: '',
};

const SAFE_HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return SAFE_HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

const ALLOWED_CSS_PROPERTIES = new Set([
  'background',
  'background-color',
  'color',
  'border',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'box-shadow',
  'opacity',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'letter-spacing',
  'text-transform',
  'text-shadow',
  'outline',
  'outline-offset',
]);

const DANGEROUS_CSS_PATTERN =
  /(@import|@charset|@namespace|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|url\s*\(|<\s*\/?\s*style|<\s*script)/i;

function toCamelCssProperty(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Parses and strictly sanitizes a custom CSS declaration list into safe inline styles.
 * Blocks @import, url(), expression(), javascript:, and raw HTML tags.
 */
export function sanitizeCustomCss(rawCss?: string | null): {
  sanitizedCssText: string;
  styleObject: Record<string, string>;
  rejectedProperties: string[];
} {
  if (!rawCss || !rawCss.trim()) {
    return { sanitizedCssText: '', styleObject: {}, rejectedProperties: [] };
  }

  // Strip CSS comments cleanly before inspecting declarations
  const withoutComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!withoutComments) {
    return { sanitizedCssText: '', styleObject: {}, rejectedProperties: [] };
  }

  const declarations = withoutComments.split(';');
  const safeParts: string[] = [];
  const styleObject: Record<string, string> = {};
  const rejectedProperties: string[] = [];

  for (const decl of declarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) {
      rejectedProperties.push(trimmed);
      continue;
    }

    const rawProp = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const rawVal = trimmed.slice(colonIdx + 1).trim();

    if (
      !ALLOWED_CSS_PROPERTIES.has(rawProp) ||
      !rawVal ||
      rawVal.length > 160 ||
      DANGEROUS_CSS_PATTERN.test(rawVal) ||
      /[<>]/.test(rawVal)
    ) {
      rejectedProperties.push(rawProp || trimmed);
      continue;
    }

    safeParts.push(`${rawProp}: ${rawVal}`);
    styleObject[toCamelCssProperty(rawProp)] = rawVal;
  }

  return {
    sanitizedCssText: safeParts.join('; '),
    styleObject,
    rejectedProperties,
  };
}

export function splitHeadingForHighlight(
  mainHeading: string,
  highlightText?: string | null
): { prefix: string; highlight: string; suffix: string } {
  const heading = (mainHeading || '').trim();
  const target = (highlightText || '').trim();
  if (!heading) {
    return { prefix: '', highlight: '', suffix: '' };
  }
  if (!target) {
    return { prefix: heading, highlight: '', suffix: '' };
  }

  const idx = heading.toLowerCase().indexOf(target.toLowerCase());
  if (idx === -1) {
    return { prefix: heading, highlight: '', suffix: '' };
  }

  return {
    prefix: heading.slice(0, idx),
    highlight: heading.slice(idx, idx + target.length),
    suffix: heading.slice(idx + target.length),
  };
}

export function getBannerAspectRatioNumeric(
  aspectRatio: BannerAspectRatio,
  customW = 16,
  customH = 9
): string {
  switch (aspectRatio) {
    case '16:9':
      return '16 / 9';
    case '4:3':
      return '4 / 3';
    case '1:1':
      return '1 / 1';
    case '21:9':
      return '21 / 9';
    case 'custom': {
      const w = Math.max(1, Math.min(40, Math.round(customW || 16)));
      const h = Math.max(1, Math.min(40, Math.round(customH || 9)));
      return `${w} / ${h}`;
    }
  }
}

export interface BannerFilterInput {
  position: string;
  isActive: boolean;
  status: string;
  displayOrder?: number;
  priority?: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  targetCategorySlugs?: string[];
  targetCustomPageSlugs?: string[];
  updatedAt?: Date | string;
}

export function filterAndSortActiveBanners<T extends BannerFilterInput>(
  banners: T[],
  options: {
    position?: string;
    categorySlug?: string;
    pageSlug?: string;
    now?: Date;
  } = {}
): T[] {
  const now = options.now ?? new Date();
  const normalizedCat = options.categorySlug?.trim().toLowerCase() || '';
  const normalizedPage = options.pageSlug?.trim().toLowerCase() || '';

  return banners
    .filter((b) => {
      if (options.position && b.position !== options.position) return false;
      if (!b.isActive || b.status !== 'published') return false;

      if (b.startsAt) {
        const start = new Date(b.startsAt);
        if (!Number.isNaN(start.getTime()) && now < start) return false;
      }
      if (b.endsAt) {
        const end = new Date(b.endsAt);
        if (!Number.isNaN(end.getTime()) && now > end) return false;
      }

      if (
        normalizedCat &&
        Array.isArray(b.targetCategorySlugs) &&
        b.targetCategorySlugs.length > 0 &&
        !b.targetCategorySlugs.map((s) => s.toLowerCase()).includes(normalizedCat)
      ) {
        return false;
      }

      if (
        normalizedPage &&
        Array.isArray(b.targetCustomPageSlugs) &&
        b.targetCustomPageSlugs.length > 0 &&
        !b.targetCustomPageSlugs.map((s) => s.toLowerCase()).includes(normalizedPage)
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
      const prioDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (prioDiff !== 0) return prioDiff;
      const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return updatedB - updatedA;
    });
}

export function validateBannerDraft(draft: Partial<BannerDraftConfig>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const heading = (draft.mainHeading || '').trim();
  if (heading.length < 2 || heading.length > 100) {
    errors.mainHeading = 'Main heading must be between 2 and 100 characters.';
  }

  if (draft.subHeading && draft.subHeading.trim().length > 160) {
    errors.subHeading = 'Sub heading must be 160 characters or fewer.';
  }

  if (draft.buttonText && draft.buttonText.trim().length > 30) {
    errors.buttonText = 'Button text must be 30 characters or fewer.';
  }

  const link = (draft.buttonLink || '').trim();
  if (link && !isSafeDestinationUrl(link, { allowRelative: true, allowEmpty: true })) {
    errors.buttonLink = 'Button URL must be a safe relative path (/shop) or https:// URL.';
  }

  const desktopImg = (draft.desktopImageUrl || '').trim();
  if (
    desktopImg &&
    !isSafeDestinationUrl(desktopImg, { allowRelative: true, allowEmpty: true })
  ) {
    errors.desktopImageUrl = 'Desktop image URL is invalid or unsafe.';
  }

  const mobileImg = (draft.mobileImageUrl || '').trim();
  if (
    mobileImg &&
    !isSafeDestinationUrl(mobileImg, { allowRelative: true, allowEmpty: true })
  ) {
    errors.mobileImageUrl = 'Mobile image URL is invalid or unsafe.';
  }

  if (draft.startsAt && draft.endsAt) {
    const start = new Date(draft.startsAt);
    const end = new Date(draft.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      errors.schedule = 'Schedule dates must be valid timestamps.';
    } else if (start.getTime() > end.getTime()) {
      errors.schedule = 'End date must be after start date.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
