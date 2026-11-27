import { normalizeHexColor, sanitizeMenuCustomCss, sanitizeSvgMarkup } from './megaMenuHelpers.ts';
import { isSafeDestinationUrl } from './security.ts';

export const FOOTER_LAYOUT_PRESETS = [
  'multi_column_grid',
  'split_brand_newsletter',
  'centered_compact',
  'minimal_bar',
] as const;

export type FooterLayoutPreset = (typeof FOOTER_LAYOUT_PRESETS)[number];

export const FOOTER_SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
  'twitter',
  'pinterest',
  'whatsapp',
  'telegram',
  'custom',
] as const;

export type FooterSocialPlatform = (typeof FOOTER_SOCIAL_PLATFORMS)[number];

export const FOOTER_LINK_TYPES = [
  'internal_route',
  'static_page',
  'category',
  'blog',
  'external_url',
  'custom_url',
] as const;

export type FooterLinkType = (typeof FOOTER_LINK_TYPES)[number];

export const FOOTER_VISIBILITIES = ['all', 'guest', 'authenticated'] as const;
export type FooterVisibilityRule = (typeof FOOTER_VISIBILITIES)[number];

export const FOOTER_PAYMENT_KEYS = [
  'visa',
  'mastercard',
  'amex',
  'bkash',
  'nagad',
  'cod',
  'sslcommerz',
  'card',
  'custom',
] as const;

export type FooterPaymentBadgeKey = (typeof FOOTER_PAYMENT_KEYS)[number];
export type StorePaymentChannelKey = 'cod' | 'bkash' | 'nagad' | 'card' | 'sslcommerz';

export interface FooterSubMenuItemConfig {
  id: string;
  label: string;
  url: string;
  openInNewTab: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface FooterMenuItemConfig {
  id: string;
  label: string;
  iconType: 'lucide' | 'svg' | 'image' | 'none';
  iconName: string;
  iconSvg?: string;
  iconImageUrl?: string;
  linkType: FooterLinkType;
  targetSlug?: string;
  url: string;
  target: '_self' | '_blank';
  openInNewTab: boolean;
  displayOrder: number;
  isActive: boolean;
  visibility: FooterVisibilityRule;
  description?: string;
  badgeText?: string;
  children?: FooterSubMenuItemConfig[];
}

export interface FooterColumnConfig {
  id: string;
  title: string;
  iconType: 'lucide' | 'svg' | 'image' | 'none';
  iconName: string;
  iconSvg?: string;
  iconImageUrl?: string;
  iconColor?: string;
  description?: string;
  isVisible: boolean;
  isActive: boolean;
  displayOrder: number;
  width: 'auto' | '1fr' | '1.25fr' | '1.5fr' | '2fr' | 'custom';
  customWidthPx: number;
  alignment: 'left' | 'center' | 'right';
  customStyleCss?: string;
  items: FooterMenuItemConfig[];
}

export interface FooterSocialLinkConfig {
  id: string;
  platform: FooterSocialPlatform;
  label: string;
  url: string;
  iconType: 'brand' | 'lucide' | 'svg' | 'image';
  iconName: string;
  iconSvg?: string;
  iconImageUrl?: string;
  iconImagePublicId?: string;
  openInNewTab: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface FooterSocialSectionConfig {
  enabled: boolean;
  title: string;
  iconSizePx: number;
  iconColor: string;
  hoverColor: string;
  backgroundColor: string;
  buttonStyle: 'rounded' | 'circle' | 'square' | 'ghost';
  borderRadiusPx: number;
  showLabels: boolean;
  links: FooterSocialLinkConfig[];
}

export interface FooterBrandConfig {
  enabled: boolean;
  showLogo: boolean;
  logoUrl: string;
  logoPublicId: string;
  altLogoUrl: string;
  altLogoPublicId: string;
  logoHeightPx: number;
  storeName: string;
  tagline: string;
  showTagline: boolean;
  description: string;
  showDescription: boolean;
  showContactInfo: boolean;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  businessHours: string;
  registrationInfo: string;
}

export interface FooterNewsletterConfig {
  enabled: boolean;
  placement: 'top_banner' | 'column' | 'above_bottom_bar';
  heading: string;
  description: string;
  inputPlaceholder: string;
  buttonLabel: string;
  consentLabel: string;
  requireConsent: boolean;
  successMessage: string;
  errorMessage: string;
  duplicateMessage: string;
  backgroundColor: string;
  textColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

export interface FooterPaymentBadgeConfig {
  id: string;
  key: FooterPaymentBadgeKey;
  storeChannelKey: StorePaymentChannelKey | 'always';
  label: string;
  isActive: boolean;
  displayOrder: number;
  iconImageUrl?: string;
  iconImagePublicId?: string;
  bgColor: string;
  textColor: string;
}

export interface FooterTrustBadgeConfig {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  isActive: boolean;
  displayOrder: number;
}

export interface FooterBottomLinkConfig {
  id: string;
  label: string;
  url: string;
  openInNewTab: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface FooterBottomBarConfig {
  enabled: boolean;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  copyrightTemplate: string;
  copyrightYear: string;
  companyName: string;
  developerCreditText: string;
  developerCreditUrl: string;
  showAdminAccess: boolean;
  links: FooterBottomLinkConfig[];
}

export interface FooterGeneralConfig {
  enabled: boolean;
  layoutPreset: FooterLayoutPreset;
  backgroundColor: string;
  backgroundGradientEnabled: boolean;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  backgroundGradientDirection: string;
  textColor: string;
  headingColor: string;
  linkColor: string;
  linkHoverColor: string;
  accentColor: string;
  borderColor: string;
  paddingTopPx: number;
  paddingBottomPx: number;
  paddingXPx: number;
  maxWidth: 'container' | 'full' | '1280px' | '1440px' | 'custom';
  customMaxWidthPx: number;
  borderTopWidthPx: number;
  borderRadiusPx: number;
  shadow: 'none' | 'sm' | 'md' | 'lg';
  fontFamily: 'Plus Jakarta Sans' | 'Manrope' | 'Poppins' | 'Outfit' | 'Inter';
  headingFontWeight: '500' | '600' | '700' | '800';
  headingSizePx: number;
  bodySizePx: number;
  columnGapPx: number;
  sectionGapPx: number;
  desktopColumns: number;
  tabletColumns: 1 | 2 | 3;
  mobileColumns: 1 | 2;
  mobileLayoutMode: 'accordion' | 'stacked';
  desktopEnabled: boolean;
  tabletEnabled: boolean;
  mobileEnabled: boolean;
}

export interface FooterAdvancedConfig {
  customCss: string;
  showDividerAboveBottomBar: boolean;
  enableHoverAnimations: boolean;
  backToTopEnabled: boolean;
  notes: string;
}

export interface FooterConfigPayload {
  general: FooterGeneralConfig;
  brand: FooterBrandConfig;
  columns: FooterColumnConfig[];
  social: FooterSocialSectionConfig;
  newsletter: FooterNewsletterConfig;
  payments: {
    enabled: boolean;
    title: string;
    badges: FooterPaymentBadgeConfig[];
  };
  trustBadges: {
    enabled: boolean;
    items: FooterTrustBadgeConfig[];
  };
  bottomBar: FooterBottomBarConfig;
  advanced: FooterAdvancedConfig;
}

export const DEFAULT_FOOTER_CONFIG: FooterConfigPayload = {
  general: {
    enabled: true,
    layoutPreset: 'split_brand_newsletter',
    backgroundColor: '#0B1524',
    backgroundGradientEnabled: false,
    backgroundGradientStart: '#0B1524',
    backgroundGradientEnd: '#08101C',
    backgroundGradientDirection: '135deg',
    textColor: '#CBD5E1',
    headingColor: '#FFFFFF',
    linkColor: '#94A3B8',
    linkHoverColor: '#4ADE80',
    accentColor: '#16A34A',
    borderColor: '#1E293B',
    paddingTopPx: 48,
    paddingBottomPx: 40,
    paddingXPx: 16,
    maxWidth: '1280px',
    customMaxWidthPx: 1280,
    borderTopWidthPx: 1,
    borderRadiusPx: 0,
    shadow: 'none',
    fontFamily: 'Plus Jakarta Sans',
    headingFontWeight: '700',
    headingSizePx: 14,
    bodySizePx: 13,
    columnGapPx: 32,
    sectionGapPx: 28,
    desktopColumns: 4,
    tabletColumns: 2,
    mobileColumns: 1,
    mobileLayoutMode: 'accordion',
    desktopEnabled: true,
    tabletEnabled: true,
    mobileEnabled: true,
  },
  brand: {
    enabled: true,
    showLogo: true,
    logoUrl: '',
    logoPublicId: '',
    altLogoUrl: '',
    altLogoPublicId: '',
    logoHeightPx: 36,
    storeName: 'NOVARA COMMERCE',
    tagline: 'Shop Smart, Live Better',
    showTagline: true,
    description:
      'Your trusted Bangladesh retail storefront for authentic electronics, fashion, books, beauty, and home essentials.',
    showDescription: true,
    showContactInfo: true,
    contactEmail: 'support@novaracommerce.com',
    contactPhone: '+880 1700-000000',
    businessAddress: 'Banani, Dhaka 1213, Bangladesh',
    businessHours: 'Sat – Thu: 9:00 AM – 9:00 PM',
    registrationInfo: 'Verified Retail Storefront',
  },
  columns: [
    {
      id: 'col-customer-service',
      title: 'Customer Service',
      iconType: 'none',
      iconName: 'Headset',
      iconSvg: '',
      iconImageUrl: '',
      iconColor: '#4ADE80',
      description: '',
      isVisible: true,
      isActive: true,
      displayOrder: 0,
      width: '1fr',
      customWidthPx: 220,
      alignment: 'left',
      customStyleCss: '',
      items: [
        {
          id: 'item-contact',
          label: 'Contact Us',
          iconType: 'none',
          iconName: 'Phone',
          linkType: 'internal_route',
          url: '/contact',
          target: '_self',
          openInNewTab: false,
          displayOrder: 0,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-faq',
          label: 'FAQ & Help Center',
          iconType: 'none',
          iconName: 'Info',
          linkType: 'internal_route',
          url: '/faq',
          target: '_self',
          openInNewTab: false,
          displayOrder: 1,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-shipping',
          label: 'Shipping Information',
          iconType: 'none',
          iconName: 'Truck',
          linkType: 'static_page',
          targetSlug: 'shipping',
          url: '/policies/shipping',
          target: '_self',
          openInNewTab: false,
          displayOrder: 2,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-returns',
          label: 'Return & Refund Policy',
          iconType: 'none',
          iconName: 'ShieldCheck',
          linkType: 'static_page',
          targetSlug: 'return',
          url: '/policies/return',
          target: '_self',
          openInNewTab: false,
          displayOrder: 3,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-track',
          label: 'Track Order',
          iconType: 'none',
          iconName: 'Package',
          linkType: 'internal_route',
          url: '/track-order',
          target: '_self',
          openInNewTab: false,
          displayOrder: 4,
          isActive: true,
          visibility: 'all',
          children: [],
        },
      ],
    },
    {
      id: 'col-company',
      title: 'About Our Company',
      iconType: 'none',
      iconName: 'Info',
      iconSvg: '',
      iconImageUrl: '',
      iconColor: '#4ADE80',
      description: '',
      isVisible: true,
      isActive: true,
      displayOrder: 1,
      width: '1fr',
      customWidthPx: 220,
      alignment: 'left',
      customStyleCss: '',
      items: [
        {
          id: 'item-about',
          label: 'About Us',
          iconType: 'none',
          iconName: 'Info',
          linkType: 'static_page',
          targetSlug: 'about',
          url: '/policies/about',
          target: '_self',
          openInNewTab: false,
          displayOrder: 0,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-shop',
          label: 'Shop Catalog',
          iconType: 'none',
          iconName: 'ShoppingBag',
          linkType: 'internal_route',
          url: '/shop',
          target: '_self',
          openInNewTab: false,
          displayOrder: 1,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-deals',
          label: 'Hot Deals',
          iconType: 'none',
          iconName: 'Flame',
          linkType: 'internal_route',
          url: '/deals',
          target: '_self',
          openInNewTab: false,
          displayOrder: 2,
          isActive: true,
          visibility: 'all',
          badgeText: 'Hot',
          children: [],
        },
        {
          id: 'item-blog',
          label: 'Journal & Guides',
          iconType: 'none',
          iconName: 'BookOpen',
          linkType: 'blog',
          url: '/blog',
          target: '_self',
          openInNewTab: false,
          displayOrder: 3,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-privacy',
          label: 'Privacy Policy',
          iconType: 'none',
          iconName: 'ShieldCheck',
          linkType: 'static_page',
          targetSlug: 'privacy',
          url: '/policies/privacy',
          target: '_self',
          openInNewTab: false,
          displayOrder: 4,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-terms',
          label: 'Terms & Conditions',
          iconType: 'none',
          iconName: 'ShieldCheck',
          linkType: 'static_page',
          targetSlug: 'terms',
          url: '/policies/terms',
          target: '_self',
          openInNewTab: false,
          displayOrder: 5,
          isActive: true,
          visibility: 'all',
          children: [],
        },
      ],
    },
    {
      id: 'col-account',
      title: 'Customer Account',
      iconType: 'none',
      iconName: 'Heart',
      iconSvg: '',
      iconImageUrl: '',
      iconColor: '#4ADE80',
      description: '',
      isVisible: true,
      isActive: true,
      displayOrder: 2,
      width: '1fr',
      customWidthPx: 220,
      alignment: 'left',
      customStyleCss: '',
      items: [
        {
          id: 'item-my-account',
          label: 'My Account',
          iconType: 'none',
          iconName: 'Home',
          linkType: 'internal_route',
          url: '/account',
          target: '_self',
          openInNewTab: false,
          displayOrder: 0,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-my-orders',
          label: 'My Orders',
          iconType: 'none',
          iconName: 'Package',
          linkType: 'internal_route',
          url: '/account/orders',
          target: '_self',
          openInNewTab: false,
          displayOrder: 1,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-wishlist',
          label: 'Wishlist',
          iconType: 'none',
          iconName: 'Heart',
          linkType: 'internal_route',
          url: '/account/wishlist',
          target: '_self',
          openInNewTab: false,
          displayOrder: 2,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-cart',
          label: 'Shopping Cart',
          iconType: 'none',
          iconName: 'ShoppingBag',
          linkType: 'internal_route',
          url: '/cart',
          target: '_self',
          openInNewTab: false,
          displayOrder: 3,
          isActive: true,
          visibility: 'all',
          children: [],
        },
        {
          id: 'item-addresses',
          label: 'Saved Addresses',
          iconType: 'none',
          iconName: 'Compass',
          linkType: 'internal_route',
          url: '/account/addresses',
          target: '_self',
          openInNewTab: false,
          displayOrder: 4,
          isActive: true,
          visibility: 'authenticated',
          children: [],
        },
      ],
    },
  ],
  social: {
    enabled: true,
    title: 'Connect With Us',
    iconSizePx: 16,
    iconColor: '#E2E8F0',
    hoverColor: '#FFFFFF',
    backgroundColor: '#1E293B',
    buttonStyle: 'rounded',
    borderRadiusPx: 10,
    showLabels: false,
    links: [
      {
        id: 'soc-facebook',
        platform: 'facebook',
        label: 'Facebook',
        url: 'https://facebook.com',
        iconType: 'brand',
        iconName: 'Globe',
        openInNewTab: true,
        displayOrder: 0,
        isActive: true,
      },
      {
        id: 'soc-instagram',
        platform: 'instagram',
        label: 'Instagram',
        url: 'https://instagram.com',
        iconType: 'brand',
        iconName: 'Camera',
        openInNewTab: true,
        displayOrder: 1,
        isActive: true,
      },
      {
        id: 'soc-youtube',
        platform: 'youtube',
        label: 'YouTube',
        url: 'https://youtube.com',
        iconType: 'brand',
        iconName: 'Tv',
        openInNewTab: true,
        displayOrder: 2,
        isActive: true,
      },
    ],
  },
  newsletter: {
    enabled: true,
    placement: 'top_banner',
    heading: 'Get Exclusive Offers & New Arrivals',
    description: 'Subscribe to receive seasonal vouchers, flash-sale alerts, and curated product drops.',
    inputPlaceholder: 'Enter your email address',
    buttonLabel: 'Subscribe',
    consentLabel: 'I agree to receive promotional updates and accept the Privacy Policy.',
    requireConsent: true,
    successMessage: 'Thank you for subscribing to our newsletter!',
    errorMessage: 'Unable to subscribe right now. Please try again.',
    duplicateMessage: 'This email address is already subscribed.',
    backgroundColor: '#112238',
    textColor: '#F8FAFC',
    buttonBgColor: '#16A34A',
    buttonTextColor: '#FFFFFF',
  },
  payments: {
    enabled: true,
    title: 'Payment Methods:',
    badges: [
      {
        id: 'pay-visa',
        key: 'visa',
        storeChannelKey: 'card',
        label: 'VISA',
        isActive: true,
        displayOrder: 0,
        bgColor: '#FFFFFF',
        textColor: '#1E40AF',
      },
      {
        id: 'pay-mastercard',
        key: 'mastercard',
        storeChannelKey: 'card',
        label: 'Mastercard',
        isActive: true,
        displayOrder: 1,
        bgColor: '#FFFFFF',
        textColor: '#EA580C',
      },
      {
        id: 'pay-bkash',
        key: 'bkash',
        storeChannelKey: 'bkash',
        label: 'bKash',
        isActive: true,
        displayOrder: 2,
        bgColor: '#DB2777',
        textColor: '#FFFFFF',
      },
      {
        id: 'pay-nagad',
        key: 'nagad',
        storeChannelKey: 'nagad',
        label: 'Nagad',
        isActive: true,
        displayOrder: 3,
        bgColor: '#EA580C',
        textColor: '#FFFFFF',
      },
      {
        id: 'pay-cod',
        key: 'cod',
        storeChannelKey: 'cod',
        label: 'COD',
        isActive: true,
        displayOrder: 4,
        bgColor: '#047857',
        textColor: '#FFFFFF',
      },
    ],
  },
  trustBadges: {
    enabled: true,
    items: [
      {
        id: 'trust-secure',
        title: '100% Secure Payment',
        subtitle: 'SSL Encrypted Checkout',
        iconName: 'ShieldCheck',
        isActive: true,
        displayOrder: 0,
      },
      {
        id: 'trust-return',
        title: '7 Days Easy Return',
        subtitle: 'Hassle-free replacement',
        iconName: 'Package',
        isActive: true,
        displayOrder: 1,
      },
      {
        id: 'trust-delivery',
        title: 'Nationwide Delivery',
        subtitle: 'Fast courier across Bangladesh',
        iconName: 'Truck',
        isActive: true,
        displayOrder: 2,
      },
    ],
  },
  bottomBar: {
    enabled: true,
    backgroundColor: '#08101C',
    textColor: '#94A3B8',
    borderColor: '#1E293B',
    copyrightTemplate: '© {year} {company}. All Rights Reserved.',
    copyrightYear: 'auto',
    companyName: 'NOVARA COMMERCE',
    developerCreditText: '',
    developerCreditUrl: '',
    showAdminAccess: true,
    links: [
      {
        id: 'bot-privacy',
        label: 'Privacy Policy',
        url: '/policies/privacy',
        openInNewTab: false,
        isActive: true,
        displayOrder: 0,
      },
      {
        id: 'bot-terms',
        label: 'Terms & Conditions',
        url: '/policies/terms',
        openInNewTab: false,
        isActive: true,
        displayOrder: 1,
      },
      {
        id: 'bot-shipping',
        label: 'Shipping Policy',
        url: '/policies/shipping',
        openInNewTab: false,
        isActive: true,
        displayOrder: 2,
      },
    ],
  },
  advanced: {
    customCss: '',
    showDividerAboveBottomBar: true,
    enableHoverAnimations: true,
    backToTopEnabled: true,
    notes: '',
  },
};

export interface StorePaymentMethodFlag {
  key: StorePaymentChannelKey;
  enabled: boolean;
  label?: string;
}

export function cloneFooterConfig(config: FooterConfigPayload): FooterConfigPayload {
  return JSON.parse(JSON.stringify(config)) as FooterConfigPayload;
}

export function formatCopyrightText(
  template: string | undefined,
  companyName: string | undefined,
  yearSetting: string | undefined,
  now = new Date()
): string {
  const year =
    !yearSetting || yearSetting.trim().toLowerCase() === 'auto'
      ? String(now.getFullYear())
      : yearSetting.trim();
  const company = (companyName || 'NOVARA COMMERCE').trim();
  const raw = (template || '© {year} {company}. All Rights Reserved.').trim();
  return raw.replace(/\{year\}/gi, year).replace(/\{company\}/gi, company);
}

/**
 * Only returns active payment badges whose corresponding store payment channel is enabled.
 * Ensures the storefront never advertises disabled payment methods.
 */
export function filterEnabledFooterPaymentBadges(
  badges: FooterPaymentBadgeConfig[] | undefined,
  storePaymentMethods?: StorePaymentMethodFlag[] | null
): FooterPaymentBadgeConfig[] {
  const list = [...(badges || [])]
    .filter((b) => b.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  if (!storePaymentMethods || storePaymentMethods.length === 0) {
    return list;
  }

  const channelMap = new Map<string, boolean>();
  for (const ch of storePaymentMethods) {
    channelMap.set(ch.key, Boolean(ch.enabled));
  }

  return list.filter((badge) => {
    const channel = badge.storeChannelKey || inferStoreChannelForBadge(badge.key);
    if (channel === 'always') return true;
    if (!channelMap.has(channel)) {
      // If sslcommerz isn't separately listed in StoreSettings, fall back to whether card/bkash/nagad/sslcommerz is enabled
      if (channel === 'sslcommerz') {
        return Boolean(channelMap.get('card') || channelMap.get('bkash') || channelMap.get('nagad'));
      }
      return false;
    }
    return channelMap.get(channel) === true;
  });
}

export function inferStoreChannelForBadge(
  key: FooterPaymentBadgeKey
): StorePaymentChannelKey | 'always' {
  if (key === 'visa' || key === 'mastercard' || key === 'amex' || key === 'card') return 'card';
  if (key === 'bkash') return 'bkash';
  if (key === 'nagad') return 'nagad';
  if (key === 'cod') return 'cod';
  if (key === 'sslcommerz') return 'sslcommerz';
  return 'always';
}

export function filterVisibleFooterColumns(
  columns: FooterColumnConfig[] | undefined,
  options: { isAuthenticated?: boolean; includeHidden?: boolean } = {}
): FooterColumnConfig[] {
  const isAuthenticated = Boolean(options.isAuthenticated);
  const includeHidden = Boolean(options.includeHidden);

  return [...(columns || [])]
    .filter((col) => includeHidden || (col.isActive !== false && col.isVisible !== false))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((col) => ({
      ...col,
      items: filterVisibleFooterMenuItems(col.items || [], { isAuthenticated, includeHidden }),
    }));
}

export function filterVisibleFooterMenuItems(
  items: FooterMenuItemConfig[] | undefined,
  options: { isAuthenticated?: boolean; includeHidden?: boolean } = {}
): FooterMenuItemConfig[] {
  const isAuthenticated = Boolean(options.isAuthenticated);
  const includeHidden = Boolean(options.includeHidden);

  return [...(items || [])]
    .filter((item) => {
      if (includeHidden) return true;
      if (item.isActive === false) return false;
      if (item.visibility === 'guest' && isAuthenticated) return false;
      if (item.visibility === 'authenticated' && !isAuthenticated) return false;
      return true;
    })
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((item) => ({
      ...item,
      children: (item.children || [])
        .filter((sub) => includeHidden || sub.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    }));
}

export function reorderListByIds<T extends { id: string; displayOrder?: number }>(
  list: T[],
  orderedIds: string[]
): T[] {
  const byId = new Map(list.map((entry) => [entry.id, entry]));
  const result: T[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const found = byId.get(id);
    if (found && !seen.has(id)) {
      seen.add(id);
      result.push({ ...found, displayOrder: result.length });
    }
  }
  for (const entry of list) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      result.push({ ...entry, displayOrder: result.length });
    }
  }
  return result;
}

export function moveArrayItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return [...list];
  }
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

export function duplicateFooterColumn(
  column: FooterColumnConfig,
  newColumnId: string,
  generateItemId: (idx: number) => string
): FooterColumnConfig {
  return {
    ...column,
    id: newColumnId,
    title: `${column.title} (Copy)`,
    items: (column.items || []).map((item, idx) => ({
      ...item,
      id: generateItemId(idx),
      children: (item.children || []).map((sub, sIdx) => ({
        ...sub,
        id: `${generateItemId(idx)}-sub-${sIdx}`,
      })),
    })),
  };
}

export function sanitizeFooterCustomCss(css?: string | null): string {
  return sanitizeMenuCustomCss(css);
}

export function isValidFooterUrl(url: string, allowEmpty = false): boolean {
  return isSafeDestinationUrl(url, { allowRelative: true, allowEmpty });
}

export function normalizeFooterConfig(raw?: Partial<FooterConfigPayload> | null): FooterConfigPayload {
  const base = cloneFooterConfig(DEFAULT_FOOTER_CONFIG);
  if (!raw || typeof raw !== 'object') return base;

  const general: FooterGeneralConfig = {
    ...base.general,
    ...(raw.general || {}),
    backgroundColor: normalizeHexColor(raw.general?.backgroundColor, base.general.backgroundColor),
    backgroundGradientStart: normalizeHexColor(
      raw.general?.backgroundGradientStart,
      base.general.backgroundGradientStart
    ),
    backgroundGradientEnd: normalizeHexColor(
      raw.general?.backgroundGradientEnd,
      base.general.backgroundGradientEnd
    ),
    textColor: normalizeHexColor(raw.general?.textColor, base.general.textColor),
    headingColor: normalizeHexColor(raw.general?.headingColor, base.general.headingColor),
    linkColor: normalizeHexColor(raw.general?.linkColor, base.general.linkColor),
    linkHoverColor: normalizeHexColor(raw.general?.linkHoverColor, base.general.linkHoverColor),
    accentColor: normalizeHexColor(raw.general?.accentColor, base.general.accentColor),
    borderColor: normalizeHexColor(raw.general?.borderColor, base.general.borderColor),
    paddingTopPx: clampInt(raw.general?.paddingTopPx, 12, 120, base.general.paddingTopPx),
    paddingBottomPx: clampInt(raw.general?.paddingBottomPx, 12, 120, base.general.paddingBottomPx),
    paddingXPx: clampInt(raw.general?.paddingXPx, 8, 64, base.general.paddingXPx),
    customMaxWidthPx: clampInt(raw.general?.customMaxWidthPx, 960, 1920, base.general.customMaxWidthPx),
    borderTopWidthPx: clampInt(raw.general?.borderTopWidthPx, 0, 8, base.general.borderTopWidthPx),
    borderRadiusPx: clampInt(raw.general?.borderRadiusPx, 0, 48, base.general.borderRadiusPx),
    headingSizePx: clampInt(raw.general?.headingSizePx, 12, 24, base.general.headingSizePx),
    bodySizePx: clampInt(raw.general?.bodySizePx, 11, 18, base.general.bodySizePx),
    columnGapPx: clampInt(raw.general?.columnGapPx, 12, 64, base.general.columnGapPx),
    sectionGapPx: clampInt(raw.general?.sectionGapPx, 12, 64, base.general.sectionGapPx),
    desktopColumns: clampInt(raw.general?.desktopColumns, 1, 6, base.general.desktopColumns),
  };

  const brand: FooterBrandConfig = {
    ...base.brand,
    ...(raw.brand || {}),
    logoHeightPx: clampInt(raw.brand?.logoHeightPx, 20, 96, base.brand.logoHeightPx),
  };

  const columns: FooterColumnConfig[] = Array.isArray(raw.columns)
    ? raw.columns.slice(0, 8).map((col, cIdx) => ({
        id: String(col.id || `col-${cIdx}`),
        title: String(col.title || 'Footer Column').slice(0, 80),
        iconType: col.iconType || 'none',
        iconName: String(col.iconName || 'LayoutGrid'),
        iconSvg: col.iconSvg ? sanitizeSvgMarkup(col.iconSvg) : '',
        iconImageUrl: col.iconImageUrl && isValidFooterUrl(col.iconImageUrl, true) ? col.iconImageUrl : '',
        iconColor: normalizeHexColor(col.iconColor, '#4ADE80'),
        description: String(col.description || '').slice(0, 240),
        isVisible: col.isVisible !== false,
        isActive: col.isActive !== false,
        displayOrder: typeof col.displayOrder === 'number' ? col.displayOrder : cIdx,
        width: col.width || '1fr',
        customWidthPx: clampInt(col.customWidthPx, 140, 520, 220),
        alignment: col.alignment || 'left',
        customStyleCss: sanitizeFooterCustomCss(col.customStyleCss),
        items: Array.isArray(col.items)
          ? col.items.slice(0, 20).map((item, iIdx) => ({
              id: String(item.id || `item-${cIdx}-${iIdx}`),
              label: String(item.label || 'Link').slice(0, 80),
              iconType: item.iconType || 'none',
              iconName: String(item.iconName || 'ChevronRight'),
              iconSvg: item.iconSvg ? sanitizeSvgMarkup(item.iconSvg) : '',
              iconImageUrl:
                item.iconImageUrl && isValidFooterUrl(item.iconImageUrl, true) ? item.iconImageUrl : '',
              linkType: item.linkType || 'internal_route',
              targetSlug: String(item.targetSlug || ''),
              url: isValidFooterUrl(item.url || '/') ? String(item.url || '/').trim() : '/',
              target: item.target === '_blank' || item.openInNewTab ? '_blank' : '_self',
              openInNewTab: Boolean(item.openInNewTab || item.target === '_blank'),
              displayOrder: typeof item.displayOrder === 'number' ? item.displayOrder : iIdx,
              isActive: item.isActive !== false,
              visibility: item.visibility || 'all',
              description: String(item.description || '').slice(0, 180),
              badgeText: String(item.badgeText || '').slice(0, 24),
              children: Array.isArray(item.children)
                ? item.children.slice(0, 10).map((sub, sIdx) => ({
                    id: String(sub.id || `sub-${iIdx}-${sIdx}`),
                    label: String(sub.label || 'Sub Link').slice(0, 80),
                    url: isValidFooterUrl(sub.url || '/') ? String(sub.url || '/').trim() : '/',
                    openInNewTab: Boolean(sub.openInNewTab),
                    displayOrder: typeof sub.displayOrder === 'number' ? sub.displayOrder : sIdx,
                    isActive: sub.isActive !== false,
                  }))
                : [],
            }))
          : [],
      }))
    : base.columns;

  const social: FooterSocialSectionConfig = {
    ...base.social,
    ...(raw.social || {}),
    iconSizePx: clampInt(raw.social?.iconSizePx, 12, 32, base.social.iconSizePx),
    iconColor: normalizeHexColor(raw.social?.iconColor, base.social.iconColor),
    hoverColor: normalizeHexColor(raw.social?.hoverColor, base.social.hoverColor),
    backgroundColor: normalizeHexColor(raw.social?.backgroundColor, base.social.backgroundColor),
    borderRadiusPx: clampInt(raw.social?.borderRadiusPx, 0, 99, base.social.borderRadiusPx),
    links: Array.isArray(raw.social?.links)
      ? raw.social.links.slice(0, 20).map((lnk, idx) => ({
          id: String(lnk.id || `soc-${idx}`),
          platform: lnk.platform || 'custom',
          label: String(lnk.label || 'Social').slice(0, 60),
          url: isValidFooterUrl(lnk.url || '') ? String(lnk.url).trim() : 'https://facebook.com',
          iconType: lnk.iconType || 'brand',
          iconName: String(lnk.iconName || 'Globe'),
          iconSvg: lnk.iconSvg ? sanitizeSvgMarkup(lnk.iconSvg) : '',
          iconImageUrl:
            lnk.iconImageUrl && isValidFooterUrl(lnk.iconImageUrl, true) ? lnk.iconImageUrl : '',
          iconImagePublicId: String(lnk.iconImagePublicId || ''),
          openInNewTab: lnk.openInNewTab !== false,
          displayOrder: typeof lnk.displayOrder === 'number' ? lnk.displayOrder : idx,
          isActive: lnk.isActive !== false,
        }))
      : base.social.links,
  };

  const newsletter: FooterNewsletterConfig = {
    ...base.newsletter,
    ...(raw.newsletter || {}),
    backgroundColor: normalizeHexColor(raw.newsletter?.backgroundColor, base.newsletter.backgroundColor),
    textColor: normalizeHexColor(raw.newsletter?.textColor, base.newsletter.textColor),
    buttonBgColor: normalizeHexColor(raw.newsletter?.buttonBgColor, base.newsletter.buttonBgColor),
    buttonTextColor: normalizeHexColor(raw.newsletter?.buttonTextColor, base.newsletter.buttonTextColor),
  };

  const payments = {
    enabled: raw.payments?.enabled ?? base.payments.enabled,
    title: String(raw.payments?.title ?? base.payments.title).slice(0, 60),
    badges: Array.isArray(raw.payments?.badges)
      ? raw.payments.badges.slice(0, 16).map((b, idx) => ({
          id: String(b.id || `pay-${idx}`),
          key: b.key || 'custom',
          storeChannelKey: b.storeChannelKey || inferStoreChannelForBadge(b.key || 'custom'),
          label: String(b.label || 'Payment').slice(0, 40),
          isActive: b.isActive !== false,
          displayOrder: typeof b.displayOrder === 'number' ? b.displayOrder : idx,
          iconImageUrl:
            b.iconImageUrl && isValidFooterUrl(b.iconImageUrl, true) ? b.iconImageUrl : '',
          iconImagePublicId: String(b.iconImagePublicId || ''),
          bgColor: normalizeHexColor(b.bgColor, '#FFFFFF'),
          textColor: normalizeHexColor(b.textColor, '#0F172A'),
        }))
      : base.payments.badges,
  };

  const trustBadges = {
    enabled: raw.trustBadges?.enabled ?? base.trustBadges.enabled,
    items: Array.isArray(raw.trustBadges?.items)
      ? raw.trustBadges.items.slice(0, 8).map((t, idx) => ({
          id: String(t.id || `trust-${idx}`),
          title: String(t.title || 'Trusted Store').slice(0, 60),
          subtitle: String(t.subtitle || '').slice(0, 120),
          iconName: String(t.iconName || 'ShieldCheck'),
          isActive: t.isActive !== false,
          displayOrder: typeof t.displayOrder === 'number' ? t.displayOrder : idx,
        }))
      : base.trustBadges.items,
  };

  const bottomBar: FooterBottomBarConfig = {
    ...base.bottomBar,
    ...(raw.bottomBar || {}),
    backgroundColor: normalizeHexColor(raw.bottomBar?.backgroundColor, base.bottomBar.backgroundColor),
    textColor: normalizeHexColor(raw.bottomBar?.textColor, base.bottomBar.textColor),
    borderColor: normalizeHexColor(raw.bottomBar?.borderColor, base.bottomBar.borderColor),
    developerCreditUrl:
      raw.bottomBar?.developerCreditUrl && isValidFooterUrl(raw.bottomBar.developerCreditUrl, true)
        ? raw.bottomBar.developerCreditUrl
        : '',
    links: Array.isArray(raw.bottomBar?.links)
      ? raw.bottomBar.links.slice(0, 12).map((l, idx) => ({
          id: String(l.id || `bot-${idx}`),
          label: String(l.label || 'Link').slice(0, 60),
          url: isValidFooterUrl(l.url || '/') ? String(l.url).trim() : '/',
          openInNewTab: Boolean(l.openInNewTab),
          isActive: l.isActive !== false,
          displayOrder: typeof l.displayOrder === 'number' ? l.displayOrder : idx,
        }))
      : base.bottomBar.links,
  };

  const advanced: FooterAdvancedConfig = {
    ...base.advanced,
    ...(raw.advanced || {}),
    customCss: sanitizeFooterCustomCss(raw.advanced?.customCss),
  };

  return {
    general,
    brand,
    columns,
    social,
    newsletter,
    payments,
    trustBadges,
    bottomBar,
    advanced,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
