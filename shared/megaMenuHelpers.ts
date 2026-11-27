import { isSafeDestinationUrl } from './security.ts';

export const MENU_TYPES = [
  'classic_dropdown',
  'mega_menu',
  'category_mega_menu',
  'multi_column_mega_menu',
  'image_based_mega_menu',
  'promotional_mega_menu',
  'featured_product_mega_menu',
  'custom_content_mega_menu',
  'nested_dropdown',
  'structured_blocks',
] as const;

export type NavigationMenuType = (typeof MENU_TYPES)[number];

export const MENU_TYPE_LABELS: Record<NavigationMenuType, string> = {
  classic_dropdown: 'Classic Dropdown',
  mega_menu: 'Mega Menu',
  category_mega_menu: 'Category Mega Menu',
  multi_column_mega_menu: 'Multi-Column Mega Menu',
  image_based_mega_menu: 'Image-Based Mega Menu',
  promotional_mega_menu: 'Promotional Mega Menu',
  featured_product_mega_menu: 'Featured Product Mega Menu',
  custom_content_mega_menu: 'Custom Content Mega Menu',
  nested_dropdown: 'Multi-Level Nested Dropdown',
  structured_blocks: 'Structured Predefined Blocks',
};

export const MENU_PLACEMENTS = [
  'all_categories',
  'header_main',
  'shop_nav',
  'deals_nav',
  'footer_nav',
  'mobile_nav',
  'homepage_nav',
  'custom_page_nav',
] as const;

export type NavigationPlacementKey = (typeof MENU_PLACEMENTS)[number];

export interface PlacementDefinition {
  key: NavigationPlacementKey;
  label: string;
  description: string;
  allowMultipleActive: boolean;
  defaultMenuType: NavigationMenuType;
}

export const DEFAULT_PLACEMENT_DEFINITIONS: PlacementDefinition[] = [
  {
    key: 'all_categories',
    label: 'All Categories Menu',
    description: 'Primary green "All Categories" trigger in the storefront header navigation bar.',
    allowMultipleActive: false,
    defaultMenuType: 'category_mega_menu',
  },
  {
    key: 'header_main',
    label: 'Main Header Navigation',
    description: 'Horizontal primary navigation links beside the All Categories button.',
    allowMultipleActive: false,
    defaultMenuType: 'nested_dropdown',
  },
  {
    key: 'shop_nav',
    label: 'Shop Navigation',
    description: 'Mega menu / dropdown triggered when interacting with Shop in the header.',
    allowMultipleActive: false,
    defaultMenuType: 'multi_column_mega_menu',
  },
  {
    key: 'deals_nav',
    label: 'Deals Navigation',
    description: 'Promotional deals dropdown / mega menu triggered from Deals navigation.',
    allowMultipleActive: false,
    defaultMenuType: 'promotional_mega_menu',
  },
  {
    key: 'footer_nav',
    label: 'Footer Navigation',
    description: 'Quick links navigation menu rendered inside the storefront footer.',
    allowMultipleActive: false,
    defaultMenuType: 'classic_dropdown',
  },
  {
    key: 'mobile_nav',
    label: 'Mobile Navigation',
    description: 'Dedicated navigation configuration for the mobile & tablet slide-over drawer.',
    allowMultipleActive: false,
    defaultMenuType: 'category_mega_menu',
  },
  {
    key: 'homepage_nav',
    label: 'Homepage Navigation',
    description: 'Optional secondary category strip or featured navigation rendered on homepage.',
    allowMultipleActive: true,
    defaultMenuType: 'image_based_mega_menu',
  },
  {
    key: 'custom_page_nav',
    label: 'Custom Page Navigation',
    description: 'Targeted menus displayed on specific custom pages or route paths.',
    allowMultipleActive: true,
    defaultMenuType: 'mega_menu',
  },
];

export const MENU_ITEM_TYPES = [
  'category',
  'subcategory',
  'product',
  'brand',
  'collection',
  'featured_products',
  'best_sellers',
  'latest_products',
  'flash_sale',
  'campaign',
  'static_page',
  'blog',
  'blog_category',
  'internal_route',
  'external_url',
  'custom_content',
] as const;

export type NavigationItemType = (typeof MENU_ITEM_TYPES)[number];

export const MENU_ITEM_TYPE_LABELS: Record<NavigationItemType, string> = {
  category: 'Category',
  subcategory: 'Subcategory',
  product: 'Product',
  brand: 'Brand',
  collection: 'Product Collection',
  featured_products: 'Featured Products',
  best_sellers: 'Best Sellers',
  latest_products: 'Latest Products',
  flash_sale: 'Flash Sale',
  campaign: 'Promotional Campaign',
  static_page: 'Static Page',
  blog: 'Blog Post',
  blog_category: 'Blog Category',
  internal_route: 'Internal Website Route',
  external_url: 'External URL',
  custom_content: 'Custom Structured Block',
};

export const MENU_TEMPLATES = [
  'modern_green',
  'minimal_white',
  'premium_dark',
  'luxury',
  'modern_ecommerce',
  'custom',
] as const;

export type MegaMenuTemplateKey = (typeof MENU_TEMPLATES)[number];

export const MENU_STATUSES = ['draft', 'published', 'scheduled', 'disabled'] as const;
export type NavigationMenuStatus = (typeof MENU_STATUSES)[number];

export const MENU_VISIBILITIES = ['public', 'customers_only', 'hidden'] as const;
export type NavigationMenuVisibility = (typeof MENU_VISIBILITIES)[number];

export const MEGA_MENU_SECTION_IDS = ['sidebar', 'grid', 'slider'] as const;
export type MegaMenuSectionId = (typeof MEGA_MENU_SECTION_IDS)[number];

export type MegaMenuColumnLayout = '1' | '2' | '3' | '4' | 'auto' | 'custom';

export interface StructuredContentBlock {
  blockType: 'heading' | 'text' | 'banner_card' | 'feature_list' | 'cta_button';
  title?: string;
  body?: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  badgeText?: string;
  items?: string[];
}

export interface MegaMenuLayoutConfig {
  showSidebar: boolean;
  showGrid: boolean;
  showSlider: boolean;
  sectionOrder: MegaMenuSectionId[];
  sidebarWidthPx: number;
  gridWidthMode: 'flex' | 'custom';
  gridWidthPx: number;
  sliderWidthPx: number;
  columns: MegaMenuColumnLayout;
  customColumnCount: number;
  showAllCategoriesEntry: boolean;
  allCategoriesLabel: string;
  showViewAllLinks: boolean;
  showCategoryIcons: boolean;
  showSubcategoryIcons: boolean;
  showProductImages: boolean;
  showHelpCard: boolean;
  helpCardTitle: string;
  helpCardPhone: string;
  maxSubcategoriesPerGroup: number;
}

export interface MegaMenuAppearanceConfig {
  template: MegaMenuTemplateKey;
  menuWidth: 'container' | 'full' | 'custom';
  customWidthPx: number;
  maxHeightPx: number;
  paddingPx: number;
  gapPx: number;
  borderRadiusPx: number;
  borderColor: string;
  shadow: 'none' | 'sm' | 'md' | 'xl' | '2xl';
  backgroundColor: string;
  sidebarBgColor: string;
  fontFamily: 'Plus Jakarta Sans' | 'Manrope' | 'Poppins' | 'Outfit' | 'Inter';
  fontWeight: '400' | '500' | '600' | '700';
  iconSizePx: number;
  textSizePx: number;
  textColor: string;
  hoverBgColor: string;
  hoverTextColor: string;
  activeBgColor: string;
  activeTextColor: string;
  dividerStyle: 'hairline' | 'dashed' | 'none';
  animation: 'fade' | 'slide_down' | 'scale' | 'none';
  animationDurationMs: number;
  openDirection: 'down' | 'left' | 'right';
  triggerMode: 'hover_or_click' | 'click' | 'hover';
  customCss: string;
}

export interface MegaMenuResponsiveConfig {
  desktopEnabled: boolean;
  tabletEnabled: boolean;
  mobileEnabled: boolean;
  tabletColumns: 1 | 2 | 3;
  mobileDrawerMode: 'accordion' | 'drilldown';
  showPromoSliderOnMobile: boolean;
}

export interface MegaMenuSliderSettings {
  autoplay: boolean;
  pauseOnHover: boolean;
  loop: boolean;
  intervalMs: number;
  showArrows: boolean;
  showDots: boolean;
  transitionEffect: 'fade' | 'slide';
}

export interface NavigationItemRecord {
  _id: string;
  menuId: string;
  parentId?: string | null;
  label: string;
  itemType: NavigationItemType;
  targetId?: string | null;
  targetSlug?: string;
  url: string;
  openInNewTab: boolean;
  iconType: 'lucide' | 'svg' | 'image' | 'none';
  iconName: string;
  iconSvg?: string;
  iconImageUrl?: string;
  iconImagePublicId?: string;
  iconColor?: string;
  iconBgColor?: string;
  imageUrl?: string;
  imagePublicId?: string;
  badgeText?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  description?: string;
  structuredBlocks?: StructuredContentBlock[];
  featuredGroupLimit?: number;
  columnIndex?: number;
  displayOrder: number;
  isVisible: boolean;
  children?: NavigationItemRecord[];
  resolvedProducts?: ResolvedNavProduct[];
  resolvedBrand?: { _id: string; name: string; slug: string; logoUrl?: string } | null;
  resolvedCategory?: ResolvedNavCategory | null;
}

export interface ResolvedNavProduct {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  effectivePrice: number;
  originalPrice: number | null;
  discountPercent: number;
  isFlashSaleActive: boolean;
  ratingAverage: number;
}

export interface ResolvedNavCategory {
  _id: string;
  name: string;
  nameBn?: string;
  slug: string;
  imageUrl?: string;
  iconName?: string;
  iconColor?: string;
  iconBgColor?: string;
  displayOrder: number;
  subcategories: Array<{
    _id: string;
    name: string;
    nameBn?: string;
    slug: string;
    imageUrl?: string;
    displayOrder: number;
  }>;
  featuredProducts?: ResolvedNavProduct[];
}

export interface MegaMenuSlideRecord {
  _id: string;
  menuIds: string[];
  internalName: string;
  badgeText: string;
  mainHeading: string;
  highlightText: string;
  discountText: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  openInNewTab: boolean;
  desktopImageUrl: string;
  desktopImagePublicId?: string;
  mobileImageUrl?: string;
  mobileImagePublicId?: string;
  altText: string;
  imagePosition: 'bottom_right' | 'center' | 'cover' | 'right';
  textColor: string;
  highlightColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  textAlign: 'left' | 'center' | 'right';
  overlayColor: string;
  overlayOpacity: number;
  borderRadiusPx: number;
  customStyleCss?: string;
  priority: number;
  displayOrder: number;
  isActive: boolean;
  status: NavigationMenuStatus;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  productIds?: string[];
  resolvedProducts?: ResolvedNavProduct[];
}

export interface NavigationMenuRecord {
  _id: string;
  name: string;
  slug: string;
  menuType: NavigationMenuType;
  placement: NavigationPlacementKey;
  description?: string;
  status: NavigationMenuStatus;
  visibility: NavigationMenuVisibility;
  displayOrder: number;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  targetPaths: string[];
  categoryMode: 'auto' | 'hybrid' | 'manual';
  includedCategoryIds: string[];
  excludedCategoryIds: string[];
  maxDepth: number;
  megaMenuConfig: MegaMenuLayoutConfig;
  appearanceConfig: MegaMenuAppearanceConfig;
  responsiveConfig: MegaMenuResponsiveConfig;
  sliderSettings: MegaMenuSliderSettings;
  createdByName?: string;
  updatedByName?: string;
  itemCount?: number;
  items?: NavigationItemRecord[];
  categoriesTree?: ResolvedNavCategory[];
  slides?: MegaMenuSlideRecord[];
  resolvedGroups?: {
    featuredProducts?: ResolvedNavProduct[];
    bestSellers?: ResolvedNavProduct[];
    latestProducts?: ResolvedNavProduct[];
    flashSaleProducts?: ResolvedNavProduct[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_MEGA_MENU_LAYOUT: MegaMenuLayoutConfig = {
  showSidebar: true,
  showGrid: true,
  showSlider: true,
  sectionOrder: ['sidebar', 'grid', 'slider'],
  sidebarWidthPx: 235,
  gridWidthMode: 'flex',
  gridWidthPx: 620,
  sliderWidthPx: 330,
  columns: '2',
  customColumnCount: 2,
  showAllCategoriesEntry: true,
  allCategoriesLabel: 'All Categories',
  showViewAllLinks: true,
  showCategoryIcons: true,
  showSubcategoryIcons: false,
  showProductImages: false,
  showHelpCard: true,
  helpCardTitle: 'Need Help?',
  helpCardPhone: '+880 1234 567890',
  maxSubcategoriesPerGroup: 6,
};

export const TEMPLATE_PRESETS: Record<MegaMenuTemplateKey, Partial<MegaMenuAppearanceConfig>> = {
  modern_green: {
    template: 'modern_green',
    backgroundColor: '#FFFFFF',
    sidebarBgColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    textColor: '#0F172A',
    hoverBgColor: '#F0FDF4',
    hoverTextColor: '#15803D',
    activeBgColor: '#DCFCE7',
    activeTextColor: '#15803D',
    dividerStyle: 'hairline',
    shadow: '2xl',
    borderRadiusPx: 18,
  },
  minimal_white: {
    template: 'minimal_white',
    backgroundColor: '#FFFFFF',
    sidebarBgColor: '#FAFAFA',
    borderColor: '#E5E7EB',
    textColor: '#111827',
    hoverBgColor: '#F3F4F6',
    hoverTextColor: '#111827',
    activeBgColor: '#111827',
    activeTextColor: '#FFFFFF',
    dividerStyle: 'hairline',
    shadow: 'xl',
    borderRadiusPx: 12,
  },
  premium_dark: {
    template: 'premium_dark',
    backgroundColor: '#0B1A2B',
    sidebarBgColor: '#081220',
    borderColor: '#1E293B',
    textColor: '#F8FAFC',
    hoverBgColor: '#162840',
    hoverTextColor: '#4ADE80',
    activeBgColor: '#16A34A',
    activeTextColor: '#FFFFFF',
    dividerStyle: 'hairline',
    shadow: '2xl',
    borderRadiusPx: 16,
  },
  luxury: {
    template: 'luxury',
    backgroundColor: '#FFFDF9',
    sidebarBgColor: '#FBF7F0',
    borderColor: '#E7DEC8',
    textColor: '#1C1917',
    hoverBgColor: '#F5EFE1',
    hoverTextColor: '#92400E',
    activeBgColor: '#78350F',
    activeTextColor: '#FEF3C7',
    dividerStyle: 'hairline',
    shadow: '2xl',
    borderRadiusPx: 14,
  },
  modern_ecommerce: {
    template: 'modern_ecommerce',
    backgroundColor: '#FFFFFF',
    sidebarBgColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    textColor: '#0F172A',
    hoverBgColor: '#ECFDF5',
    hoverTextColor: '#059669',
    activeBgColor: '#059669',
    activeTextColor: '#FFFFFF',
    dividerStyle: 'hairline',
    shadow: 'xl',
    borderRadiusPx: 16,
  },
  custom: {
    template: 'custom',
  },
};

export const DEFAULT_MEGA_MENU_APPEARANCE: MegaMenuAppearanceConfig = {
  template: 'modern_green',
  menuWidth: 'container',
  customWidthPx: 1180,
  maxHeightPx: 540,
  paddingPx: 16,
  gapPx: 16,
  borderRadiusPx: 18,
  borderColor: '#E2E8F0',
  shadow: '2xl',
  backgroundColor: '#FFFFFF',
  sidebarBgColor: '#FFFFFF',
  fontFamily: 'Plus Jakarta Sans',
  fontWeight: '500',
  iconSizePx: 18,
  textSizePx: 13,
  textColor: '#0F172A',
  hoverBgColor: '#F0FDF4',
  hoverTextColor: '#15803D',
  activeBgColor: '#DCFCE7',
  activeTextColor: '#15803D',
  dividerStyle: 'hairline',
  animation: 'fade',
  animationDurationMs: 180,
  openDirection: 'down',
  triggerMode: 'hover_or_click',
  customCss: '',
};

export const DEFAULT_RESPONSIVE_CONFIG: MegaMenuResponsiveConfig = {
  desktopEnabled: true,
  tabletEnabled: true,
  mobileEnabled: true,
  tabletColumns: 2,
  mobileDrawerMode: 'accordion',
  showPromoSliderOnMobile: true,
};

export const DEFAULT_SLIDER_SETTINGS: MegaMenuSliderSettings = {
  autoplay: true,
  pauseOnHover: true,
  loop: true,
  intervalMs: 4500,
  showArrows: true,
  showDots: true,
  transitionEffect: 'fade',
};

export function getMegaMenuTemplatePreset(template: MegaMenuTemplateKey): MegaMenuAppearanceConfig {
  return {
    ...DEFAULT_MEGA_MENU_APPEARANCE,
    ...(TEMPLATE_PRESETS[template] || TEMPLATE_PRESETS.modern_green),
  };
}

export function normalizeHexColor(value: string | undefined, fallback = '#16A34A'): string {
  const trimmed = (value || '').trim();
  if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeMenuCustomCss(css?: string | null): string {
  if (!css) return '';
  const cleaned = css
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
  return cleaned.slice(0, 1500);
}

const ALLOWED_SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'defs',
  'lineargradient',
  'stop',
]);

const ALLOWED_SVG_ATTRS = new Set([
  'viewbox',
  'width',
  'height',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'transform',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'clip-rule',
  'offset',
  'stop-color',
  'stop-opacity',
  'id',
  'xmlns',
]);

/**
 * Strictly sanitizes user-provided SVG markup to eliminate XSS vectors
 * (<script>, <foreignObject>, on* attributes, javascript:/data: URIs).
 */
export function sanitizeSvgMarkup(rawSvg?: string | null): string {
  if (!rawSvg) return '';
  const trimmed = rawSvg.trim();
  if (!trimmed || !/<svg[\s>]/i.test(trimmed)) return '';

  // Strip comments, script/style/foreignObject/iframe/object/embed tags completely
  const stripped = trimmed
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|foreignObject|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|foreignObject|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '');

  const out: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g;
  let match: RegExpExecArray | null;
  let hasRootSvg = false;

  while ((match = tagRegex.exec(stripped)) !== null) {
    const fullMatch = match[0];
    const isClosing = fullMatch.startsWith('</');
    const tagLower = match[1].toLowerCase();
    if (!ALLOWED_SVG_TAGS.has(tagLower)) {
      continue;
    }

    if (isClosing) {
      out.push(`</${tagLower}>`);
      continue;
    }

    if (tagLower === 'svg') hasRootSvg = true;

    const rawAttrs = match[2] || '';
    const isSelfClosing = /\/\s*$/.test(rawAttrs);
    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = (attrMatch[2] ?? attrMatch[3] ?? '').trim();
      if (attrName.startsWith('on')) continue;
      if (!ALLOWED_SVG_ATTRS.has(attrName)) continue;
      if (/javascript:|vbscript:|data:/i.test(attrValue)) continue;
      const normalizedName = attrName === 'viewbox' ? 'viewBox' : attrName;
      const escapedVal = attrValue.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      safeAttrs.push(`${normalizedName}="${escapedVal}"`);
    }

    if (tagLower === 'svg' && !safeAttrs.some((a) => a.startsWith('viewBox='))) {
      safeAttrs.push('viewBox="0 0 24 24"');
    }

    out.push(`<${tagLower}${safeAttrs.length ? ` ${safeAttrs.join(' ')}` : ''}${isSelfClosing ? ' /' : ''}>`);
  }

  const result = out.join('');
  if (!hasRootSvg || !result.includes('<svg') || !result.includes('</svg>')) {
    return '';
  }
  return result.slice(0, 8192);
}

export function validateParentRelationship(
  items: Array<{ _id: string; parentId?: string | null }>,
  itemId: string | null,
  proposedParentId: string | null | undefined,
  maxDepth = 4
): { valid: boolean; reason?: string } {
  if (!proposedParentId) {
    return { valid: true };
  }
  if (itemId && String(itemId) === String(proposedParentId)) {
    return { valid: false, reason: 'A menu item cannot be its own parent.' };
  }

  const byId = new Map(items.map((item) => [String(item._id), item]));
  if (!byId.has(String(proposedParentId))) {
    return { valid: false, reason: 'Selected parent menu item does not belong to this menu.' };
  }

  // Walk upward from proposedParentId checking for circular chains and depth limit
  let depth = 1; // new/moved item + proposed parent at least
  let cursor: string | null | undefined = String(proposedParentId);
  const visited = new Set<string>();

  while (cursor) {
    if (visited.has(cursor)) {
      return { valid: false, reason: 'Circular menu item hierarchy detected.' };
    }
    if (itemId && cursor === String(itemId)) {
      return { valid: false, reason: 'Cannot move a menu item underneath one of its own descendants.' };
    }
    visited.add(cursor);
    depth += 1;
    if (depth > Math.max(1, Math.min(5, maxDepth))) {
      return { valid: false, reason: `Maximum menu nesting depth of ${maxDepth} levels exceeded.` };
    }
    const parentNode = byId.get(cursor);
    cursor = parentNode?.parentId ? String(parentNode.parentId) : null;
  }

  // Also ensure subtree beneath itemId doesn't violate maxDepth
  if (itemId) {
    const computeSubtreeDepth = (nodeId: string, seen = new Set<string>()): number => {
      if (seen.has(nodeId)) return 0;
      seen.add(nodeId);
      const children = items.filter((i) => String(i.parentId || '') === nodeId);
      if (children.length === 0) return 0;
      return 1 + Math.max(...children.map((c) => computeSubtreeDepth(String(c._id), new Set(seen))));
    };
    const subtreeExtra = computeSubtreeDepth(String(itemId));
    if (depth + subtreeExtra > Math.max(1, Math.min(5, maxDepth))) {
      return {
        valid: false,
        reason: `Moving this group here exceeds the maximum nesting depth of ${maxDepth} levels.`,
      };
    }
  }

  return { valid: true };
}

export function buildMegaMenuItemTree<
  T extends {
    _id: string;
    parentId?: string | null;
    displayOrder: number;
    isVisible?: boolean;
    children?: T[];
  },
>(
  items: T[],
  options: { includeHidden?: boolean; maxDepth?: number } = {}
): T[] {
  const includeHidden = options.includeHidden ?? false;
  const maxDepth = Math.max(1, Math.min(5, options.maxDepth ?? 4));
  const filtered = items
    .filter((i) => includeHidden || i.isVisible !== false)
    .map((i) => ({ ...i, children: [] as T[] }))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const map = new Map<string, T>();
  for (const node of filtered) {
    map.set(String(node._id), node);
  }

  const roots: T[] = [];
  for (const node of filtered) {
    const pid = node.parentId ? String(node.parentId) : null;
    if (pid && map.has(pid) && pid !== String(node._id)) {
      map.get(pid)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  const pruneDepth = (nodes: T[], currentDepth: number): T[] => {
    return nodes
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((n) => ({
        ...n,
        children: currentDepth >= maxDepth ? [] : pruneDepth(n.children || [], currentDepth + 1),
      }));
  };

  return pruneDepth(roots, 1);
}

export function filterActiveMegaMenuSlides<
  T extends {
    isActive: boolean;
    status?: NavigationMenuStatus;
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
    priority?: number;
    displayOrder?: number;
  },
>(slides: T[], now = new Date()): T[] {
  const nowMs = now.getTime();
  return slides
    .filter((slide) => {
      if (!slide.isActive) return false;
      if (slide.status && slide.status !== 'published' && slide.status !== 'scheduled') {
        return false;
      }
      if (slide.startsAt) {
        const startMs = new Date(slide.startsAt).getTime();
        if (Number.isNaN(startMs) || nowMs < startMs) return false;
      }
      if (slide.endsAt) {
        const endMs = new Date(slide.endsAt).getTime();
        if (Number.isNaN(endMs) || nowMs > endMs) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
}

export function isMenuScheduledActive(
  menu: {
    status: NavigationMenuStatus;
    visibility?: NavigationMenuVisibility;
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
    targetPaths?: string[];
  },
  options: { now?: Date; currentPath?: string; isAuthenticatedCustomer?: boolean } = {}
): boolean {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();

  if (menu.status !== 'published' && menu.status !== 'scheduled') {
    return false;
  }
  if (menu.visibility === 'hidden') return false;
  if (menu.visibility === 'customers_only' && !options.isAuthenticatedCustomer) {
    return false;
  }

  if (menu.startsAt) {
    const s = new Date(menu.startsAt).getTime();
    if (Number.isNaN(s) || nowMs < s) return false;
  }
  if (menu.endsAt) {
    const e = new Date(menu.endsAt).getTime();
    if (Number.isNaN(e) || nowMs > e) return false;
  }

  if (options.currentPath && Array.isArray(menu.targetPaths) && menu.targetPaths.length > 0) {
    const normalizedPath = options.currentPath.toLowerCase();
    const matched = menu.targetPaths.some((p) => {
      const target = p.trim().toLowerCase();
      if (!target) return false;
      if (target.endsWith('*')) {
        return normalizedPath.startsWith(target.slice(0, -1));
      }
      return normalizedPath === target;
    });
    if (!matched) return false;
  }

  return true;
}

export interface RawCategoryDoc {
  _id: string;
  name: string;
  nameBn?: string;
  slug: string;
  parentId?: string | null;
  image?: { url?: string };
  displayOrder?: number;
  isActive?: boolean;
}

const DEFAULT_CATEGORY_ICON_PALETTE: Array<{
  keywords: string[];
  iconName: string;
  iconColor: string;
  iconBgColor: string;
}> = [
  { keywords: ['mobile', 'phone', 'tablet', 'smartphone'], iconName: 'Smartphone', iconColor: '#0284C7', iconBgColor: '#E0F2FE' },
  { keywords: ['computer', 'laptop', 'pc', 'monitor'], iconName: 'Laptop', iconColor: '#2563EB', iconBgColor: '#DBEAFE' },
  { keywords: ['electronic', 'audio', 'headphone', 'camera', 'gadget'], iconName: 'Headphones', iconColor: '#1D4ED8', iconBgColor: '#EFF6FF' },
  { keywords: ['fashion', 'cloth', 'apparel', 'shirt', 'wear'], iconName: 'Shirt', iconColor: '#2563EB', iconBgColor: '#EFF6FF' },
  { keywords: ['home', 'living', 'furniture', 'kitchen'], iconName: 'Home', iconColor: '#0284C7', iconBgColor: '#E0F2FE' },
  { keywords: ['beauty', 'care', 'skin', 'cosmetic'], iconName: 'Sparkles', iconColor: '#DB2777', iconBgColor: '#FCE7F3' },
  { keywords: ['sport', 'outdoor', 'fitness'], iconName: 'Trophy', iconColor: '#16A34A', iconBgColor: '#DCFCE7' },
  { keywords: ['book', 'stationery', 'education'], iconName: 'BookOpen', iconColor: '#7C3AED', iconBgColor: '#EDE9FE' },
  { keywords: ['toy', 'game', 'gaming'], iconName: 'Gamepad2', iconColor: '#4F46E5', iconBgColor: '#E0E7FF' },
  { keywords: ['watch', 'accessor'], iconName: 'Watch', iconColor: '#0F766E', iconBgColor: '#CCFBF1' },
];

export function inferCategoryVisualMeta(nameOrSlug: string): {
  iconName: string;
  iconColor: string;
  iconBgColor: string;
} {
  const lower = (nameOrSlug || '').toLowerCase();
  for (const entry of DEFAULT_CATEGORY_ICON_PALETTE) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return {
        iconName: entry.iconName,
        iconColor: entry.iconColor,
        iconBgColor: entry.iconBgColor,
      };
    }
  }
  return {
    iconName: 'LayoutGrid',
    iconColor: '#16A34A',
    iconBgColor: '#DCFCE7',
  };
}

export function resolveDynamicCategoryHierarchy(
  categories: RawCategoryDoc[],
  options: {
    mode?: 'auto' | 'hybrid' | 'manual';
    includedCategoryIds?: string[];
    excludedCategoryIds?: string[];
  } = {}
): ResolvedNavCategory[] {
  const mode = options.mode ?? 'auto';
  if (mode === 'manual') return [];

  const activeCategories = categories.filter((c) => c.isActive !== false);
  const excludedSet = new Set((options.excludedCategoryIds || []).map((id) => String(id)));
  const includedSet = new Set((options.includedCategoryIds || []).map((id) => String(id)));

  const sortedAll = [...activeCategories].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)
  );

  const subByParent = new Map<string, ResolvedNavCategory['subcategories']>();
  for (const cat of sortedAll) {
    if (!cat.parentId) continue;
    if (excludedSet.has(String(cat._id))) continue;
    const pid = String(cat.parentId);
    const list = subByParent.get(pid) || [];
    list.push({
      _id: String(cat._id),
      name: cat.name,
      nameBn: cat.nameBn,
      slug: cat.slug,
      imageUrl: cat.image?.url,
      displayOrder: cat.displayOrder ?? 0,
    });
    subByParent.set(pid, list);
  }

  const parents = sortedAll.filter((c) => {
    if (c.parentId) return false;
    const idStr = String(c._id);
    if (excludedSet.has(idStr)) return false;
    if (includedSet.size > 0 && !includedSet.has(idStr)) return false;
    return true;
  });

  // Preserve custom order if includedCategoryIds is provided
  if (includedSet.size > 0) {
    const orderIndex = new Map((options.includedCategoryIds || []).map((id, idx) => [String(id), idx]));
    parents.sort(
      (a, b) => (orderIndex.get(String(a._id)) ?? 999) - (orderIndex.get(String(b._id)) ?? 999)
    );
  }

  return parents.map((parent) => {
    const visual = inferCategoryVisualMeta(`${parent.name} ${parent.slug}`);
    return {
      _id: String(parent._id),
      name: parent.name,
      nameBn: parent.nameBn,
      slug: parent.slug,
      imageUrl: parent.image?.url,
      iconName: visual.iconName,
      iconColor: visual.iconColor,
      iconBgColor: visual.iconBgColor,
      displayOrder: parent.displayOrder ?? 0,
      subcategories: subByParent.get(String(parent._id)) || [],
    };
  });
}

export function reorderItemsByOrderedIds<T extends { _id: string; displayOrder?: number }>(
  items: T[],
  orderedIds: string[]
): Array<T & { displayOrder: number }> {
  const byId = new Map(items.map((item) => [String(item._id), item]));
  const result: Array<T & { displayOrder: number }> = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const key = String(id);
    const found = byId.get(key);
    if (found && !seen.has(key)) {
      seen.add(key);
      result.push({ ...found, displayOrder: result.length });
    }
  }

  for (const item of items) {
    const key = String(item._id);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...item, displayOrder: result.length });
    }
  }

  return result;
}

export function isValidNavigationUrl(url: string): boolean {
  return isSafeDestinationUrl(url, { allowRelative: true, allowEmpty: false });
}

export function computeMegaMenuGridColumnsClass(
  columns: MegaMenuColumnLayout,
  customCount = 2
): number {
  if (columns === '1') return 1;
  if (columns === '2') return 2;
  if (columns === '3') return 3;
  if (columns === '4') return 4;
  if (columns === 'custom') return Math.max(1, Math.min(4, Math.round(customCount || 2)));
  return 2;
}
