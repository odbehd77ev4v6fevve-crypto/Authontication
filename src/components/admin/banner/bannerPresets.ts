import type { BannerDraftConfig } from '../../../../shared/bannerHelpers.ts';

export interface BannerGradientPreset {
  id: string;
  label: string;
  start: string;
  end: string;
  solid: string;
  direction: string;
  textColor: string;
  highlightColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

export const BANNER_GRADIENT_PRESETS: BannerGradientPreset[] = [
  {
    id: 'emerald_lime',
    label: 'Fresh Emerald',
    start: '#06381C',
    end: '#22C55E',
    solid: '#15803D',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#A3E635',
    buttonBgColor: '#A3E635',
    buttonTextColor: '#0F172A',
  },
  {
    id: 'azure_cyan',
    label: 'Ocean Azure',
    start: '#0369A1',
    end: '#38BDF8',
    solid: '#0284C7',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#FDE047',
    buttonBgColor: '#FFFFFF',
    buttonTextColor: '#0369A1',
  },
  {
    id: 'indigo_violet',
    label: 'Royal Indigo',
    start: '#1E1B4B',
    end: '#4F46E5',
    solid: '#3730A3',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#A5B4FC',
    buttonBgColor: '#FFFFFF',
    buttonTextColor: '#1E1B4B',
  },
  {
    id: 'rose_plum',
    label: 'Orchid Plum',
    start: '#701A75',
    end: '#EC4899',
    solid: '#A21CAF',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#FDE68A',
    buttonBgColor: '#FFFFFF',
    buttonTextColor: '#701A75',
  },
  {
    id: 'amber_gold',
    label: 'Solar Amber',
    start: '#9A3412',
    end: '#F59E0B',
    solid: '#D97706',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#FEF08A',
    buttonBgColor: '#0F172A',
    buttonTextColor: '#FFFFFF',
  },
  {
    id: 'crimson_flame',
    label: 'Crimson Sale',
    start: '#7F1D1D',
    end: '#EF4444',
    solid: '#DC2626',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#FDE047',
    buttonBgColor: '#FFFFFF',
    buttonTextColor: '#991B1B',
  },
  {
    id: 'obsidian_slate',
    label: 'Obsidian Pro',
    start: '#0F172A',
    end: '#334155',
    solid: '#0F172A',
    direction: '135deg',
    textColor: '#FFFFFF',
    highlightColor: '#4ADE80',
    buttonBgColor: '#16A34A',
    buttonTextColor: '#FFFFFF',
  },
];

export const BUNDLED_BANNER_IMAGES: Array<{ label: string; url: string }> = [
  { label: 'Smart Shopping Bags', url: '/src/assets/images/hero_shopper_bags_1795621229978.jpg' },
  { label: 'Tech Laptops Showcase', url: '/src/assets/images/promo_tech_laptops_1795621230990.jpg' },
  { label: 'Electronics Bundle', url: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg' },
  { label: 'Fashion Collection', url: '/src/assets/images/promo_fashion_bundle_1795621230765.jpg' },
  { label: 'Smartphone Pro Studio', url: '/src/assets/images/product_smartphone_pro_1795621230630.jpg' },
  { label: 'Wireless Earbuds', url: '/src/assets/images/product_wireless_earbuds_1795621231733.jpg' },
];

export const BANNER_TEMPLATE_PRESETS: Array<{
  id: string;
  label: string;
  patch: Partial<BannerDraftConfig>;
}> = [
  {
    id: 'smart_shopping',
    label: 'Smart Shopping Emerald',
    patch: {
      name: 'Smart Shopping Campaign',
      badgeText: 'Big Savings, Big Happiness',
      mainHeading: 'Smart Shopping Bigger Savings!',
      highlightText: 'Bigger',
      subHeading: 'Up to 70% Off on Top Brands',
      buttonText: 'Shop Now',
      buttonLink: '/shop',
      backgroundType: 'gradient',
      gradientStart: '#06381C',
      gradientEnd: '#22C55E',
      desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
      textColor: '#FFFFFF',
      highlightColor: '#A3E635',
      buttonBgColor: '#A3E635',
      buttonTextColor: '#0F172A',
    },
  },
  {
    id: 'electronics_drop',
    label: 'Electronics Tech Drop',
    patch: {
      name: 'Electronics Flagship Drop',
      badgeText: 'Official Warranty Included',
      mainHeading: 'Upgrade Your Tech Setup Today',
      highlightText: 'Tech',
      subHeading: 'Flagship smartphones, laptops & audio gear across Bangladesh',
      buttonText: 'Explore Tech',
      buttonLink: '/category/electronics',
      backgroundType: 'gradient',
      gradientStart: '#0F172A',
      gradientEnd: '#1E293B',
      desktopImageUrl: '/src/assets/images/promo_tech_laptops_1795621230990.jpg',
      textColor: '#FFFFFF',
      highlightColor: '#4ADE80',
      buttonBgColor: '#22C55E',
      buttonTextColor: '#FFFFFF',
    },
  },
  {
    id: 'fashion_editorial',
    label: 'Fashion Clean Minimal',
    patch: {
      name: 'Seasonal Fashion Edit',
      badgeText: 'New Season Collection',
      mainHeading: 'Effortless Everyday Style',
      highlightText: 'Everyday',
      subHeading: 'Curated apparel & accessories with 7-day easy returns',
      buttonText: 'Shop Collection',
      buttonLink: '/category/fashion',
      backgroundType: 'solid',
      solidColor: '#064E3B',
      desktopImageUrl: '/src/assets/images/promo_fashion_bundle_1795621230765.jpg',
      textColor: '#FFFFFF',
      highlightColor: '#FDE047',
      buttonBgColor: '#FFFFFF',
      buttonTextColor: '#064E3B',
      fontFamily: 'Playfair Display',
    },
  },
];
