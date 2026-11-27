import mongoose, { Schema, type Document } from 'mongoose';

export interface IHomepageSectionConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  title?: string;
  subtitle?: string;
  collectionType?:
    | 'hero'
    | 'categories'
    | 'dual_banners'
    | 'featured_products'
    | 'best_sellers'
    | 'new_arrivals'
    | 'top_rated'
    | 'on_sale'
    | 'promo_placement'
    | 'category_collection'
    | 'happy_clients'
    | 'newsletter';
  productLimit?: number;
  categorySlug?: string;
  ctaText?: string;
  ctaLink?: string;
}

export interface IHomepageConfig extends Document {
  key: 'primary';
  announcementItems: Array<{ icon: string; text: string }>;
  announcementPhone: string;
  heroSlides: Array<{
    badge: string;
    headlinePrefix: string;
    headlineHighlight: string;
    headlineSuffix: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    imageUrl: string;
    imagePublicId?: string;
    mobileImageUrl?: string;
    mobileImagePublicId?: string;
    displayOrder?: number;
    isActive: boolean;
  }>;
  trustPoints: Array<{ title: string; subtitle: string; icon: string }>;
  dualBanners: Array<{
    eyebrow: string;
    title: string;
    ctaText: string;
    ctaLink: string;
    imageUrl: string;
    imagePublicId?: string;
    theme: 'ice' | 'blush';
  }>;
  sections: IHomepageSectionConfig[];
  wishlistSliderSettings?: {
    autoplay: boolean;
    transitionDurationMs: number;
  };
  wishlistDefaultsSeeded?: boolean;
  cartDefaultsSeeded?: boolean;
  checkoutBanner?: {
    enabled: boolean;
    badgeText: string;
    heading: string;
    subtitle: string;
    desktopImageUrl?: string;
    desktopImagePublicId?: string;
    mobileImageUrl?: string;
    mobileImagePublicId?: string;
    altText?: string;
  };
  status: 'draft' | 'published';
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const HomepageConfigSchema = new Schema<IHomepageConfig>(
  {
    key: { type: String, default: 'primary', unique: true },
    announcementItems: [
      {
        icon: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    announcementPhone: { type: String, default: '' },
    heroSlides: [
      {
        badge: { type: String, default: '' },
        headlinePrefix: { type: String, required: true },
        headlineHighlight: { type: String, default: '' },
        headlineSuffix: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        ctaText: { type: String, default: 'Shop Now' },
        ctaLink: { type: String, default: '/shop' },
        imageUrl: { type: String, required: true },
        imagePublicId: { type: String },
        mobileImageUrl: { type: String, default: '' },
        mobileImagePublicId: { type: String },
        displayOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],
    trustPoints: [
      {
        title: { type: String, required: true },
        subtitle: { type: String, required: true },
        icon: { type: String, required: true },
      },
    ],
    dualBanners: [
      {
        eyebrow: { type: String, default: '' },
        title: { type: String, required: true },
        ctaText: { type: String, default: 'Shop Now' },
        ctaLink: { type: String, default: '/shop' },
        imageUrl: { type: String, required: true },
        imagePublicId: { type: String },
        theme: { type: String, enum: ['ice', 'blush'], default: 'ice' },
      },
    ],
    sections: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        enabled: { type: Boolean, default: true },
        order: { type: Number, required: true },
        title: { type: String, trim: true, maxlength: 120 },
        subtitle: { type: String, trim: true, maxlength: 220 },
        collectionType: {
          type: String,
          enum: [
            'hero',
            'categories',
            'dual_banners',
            'featured_products',
            'best_sellers',
            'new_arrivals',
            'top_rated',
            'on_sale',
            'promo_placement',
            'category_collection',
            'happy_clients',
            'newsletter',
          ],
        },
        productLimit: { type: Number, min: 1, max: 20, default: 5 },
        categorySlug: { type: String, trim: true, maxlength: 100 },
        ctaText: { type: String, trim: true, maxlength: 50 },
        ctaLink: { type: String, trim: true, maxlength: 240 },
      },
    ],
    wishlistSliderSettings: {
      autoplay: { type: Boolean, default: true },
      transitionDurationMs: { type: Number, default: 5000, min: 1500, max: 20000 },
    },
    wishlistDefaultsSeeded: { type: Boolean, default: false },
    cartDefaultsSeeded: { type: Boolean, default: false },
    checkoutBanner: {
      enabled: { type: Boolean, default: true },
      badgeText: { type: String, default: 'Secure Checkout' },
      heading: { type: String, default: 'Checkout' },
      subtitle: { type: String, default: 'Complete your order quickly and securely' },
      desktopImageUrl: { type: String, default: '' },
      desktopImagePublicId: { type: String, default: '' },
      mobileImageUrl: { type: String, default: '' },
      mobileImagePublicId: { type: String, default: '' },
      altText: { type: String, default: 'Secure Checkout Banner' },
    },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const HomepageConfigModel =
  mongoose.models.HomepageConfig ||
  mongoose.model<IHomepageConfig>('HomepageConfig', HomepageConfigSchema);

export interface IWishlistHeroSlide extends Document {
  title: string;
  subtitle: string;
  ctaText?: string;
  ctaDestination?: string;
  desktopImageUrl: string;
  desktopImagePublicId?: string;
  mobileImageUrl?: string;
  mobileImagePublicId?: string;
  altText: string;
  displayOrder: number;
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistHeroSlideSchema = new Schema<IWishlistHeroSlide>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    subtitle: { type: String, trim: true, maxlength: 240, default: '' },
    ctaText: { type: String, trim: true, maxlength: 50, default: '' },
    ctaDestination: { type: String, trim: true, maxlength: 300, default: '' },
    desktopImageUrl: { type: String, required: true },
    desktopImagePublicId: { type: String },
    mobileImageUrl: { type: String, default: '' },
    mobileImagePublicId: { type: String },
    altText: { type: String, trim: true, maxlength: 180, default: 'Wishlist hero slide' },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

WishlistHeroSlideSchema.index({ isActive: 1, displayOrder: 1 });

export const WishlistHeroSlideModel =
  mongoose.models.WishlistHeroSlide ||
  mongoose.model<IWishlistHeroSlide>('WishlistHeroSlide', WishlistHeroSlideSchema);

export interface ICartHeroBanner extends Document {
  badgeText: string;
  heading: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  desktopImageUrl?: string;
  desktopImagePublicId?: string;
  mobileImageUrl?: string;
  mobileImagePublicId?: string;
  altText: string;
  imagePosition: 'right' | 'background';
  displayOrder: number;
  isEnabled: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CartHeroBannerSchema = new Schema<ICartHeroBanner>(
  {
    badgeText: { type: String, trim: true, maxlength: 60, default: 'Your Shopping Cart' },
    heading: { type: String, required: true, trim: true, maxlength: 120, default: 'Your Cart' },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 240,
      default: 'Review your items and proceed to checkout',
    },
    ctaText: { type: String, trim: true, maxlength: 50, default: 'Continue Shopping' },
    ctaLink: { type: String, trim: true, maxlength: 300, default: '/shop' },
    desktopImageUrl: { type: String, trim: true, default: '' },
    desktopImagePublicId: { type: String, trim: true, default: '' },
    mobileImageUrl: { type: String, trim: true, default: '' },
    mobileImagePublicId: { type: String, trim: true, default: '' },
    altText: { type: String, trim: true, maxlength: 180, default: 'Your Shopping Cart Banner' },
    imagePosition: { type: String, enum: ['right', 'background'], default: 'right' },
    displayOrder: { type: Number, default: 0, index: true },
    isEnabled: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CartHeroBannerSchema.index({ isEnabled: 1, displayOrder: 1 });

export const CartHeroBannerModel =
  mongoose.models.CartHeroBanner ||
  mongoose.model<ICartHeroBanner>('CartHeroBanner', CartHeroBannerSchema);

export interface IPromotionalPlacement extends Document {
  title: string;
  subtitle?: string;
  ctaText?: string;
  destinationUrl: string;
  altText: string;
  imageUrl: string;
  imagePublicId?: string;
  placementSlot:
    | 'homepage_mid_banner'
    | 'homepage_secondary_banner'
    | 'homepage_bottom_banner'
    | 'homepage_triple_banners'
    | 'homepage_sidebar'
    | 'top_strip'
    | 'wishlist_bottom_banner'
    | 'wishlist_sidebar'
    | 'product_sidebar';
  layoutStyle: 'dark_emerald_banner' | 'clean_card' | 'soft_sage_banner';
  displayOrder: number;
  isEnabled: boolean;
  status: 'draft' | 'published';
  startsAt?: Date | null;
  endsAt?: Date | null;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionalPlacementSchema = new Schema<IPromotionalPlacement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    subtitle: { type: String, trim: true, maxlength: 220 },
    ctaText: { type: String, trim: true, maxlength: 40 },
    destinationUrl: { type: String, required: true, trim: true },
    altText: { type: String, required: true, trim: true, maxlength: 180 },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String },
    placementSlot: {
      type: String,
      enum: [
        'homepage_mid_banner',
        'homepage_secondary_banner',
        'homepage_bottom_banner',
        'homepage_triple_banners',
        'homepage_sidebar',
        'top_strip',
        'wishlist_bottom_banner',
        'wishlist_sidebar',
        'product_sidebar',
      ],
      default: 'homepage_mid_banner',
    },
    layoutStyle: {
      type: String,
      enum: ['dark_emerald_banner', 'clean_card', 'soft_sage_banner'],
      default: 'dark_emerald_banner',
    },
    displayOrder: { type: Number, default: 0, index: true },
    isEnabled: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PromotionalPlacementSchema.index({ placementSlot: 1, isEnabled: 1, status: 1, displayOrder: 1 });

export const PromotionalPlacementModel =
  mongoose.models.PromotionalPlacement ||
  mongoose.model<IPromotionalPlacement>('PromotionalPlacement', PromotionalPlacementSchema);

export interface IStoreSettings extends Document {
  key: 'primary';
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  businessAddress: string;
  socialLinks: {
    whatsapp?: string;
    messenger?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  shipping: {
    dhakaMetroCharge: number;
    dhakaSuburbCharge: number;
    outsideDhakaCharge: number;
    freeShippingThreshold: number;
    expressSurcharge: number;
  };
  taxRate: number;
  taxSettings?: {
    enabled: boolean;
    taxInclusive: boolean;
    label: string;
    applyToShipping: boolean;
  };
  headerSettings?: {
    logoUrl?: string;
    logoPublicId?: string;
    showSearch: boolean;
    showWishlist: boolean;
    showCart: boolean;
    showAccount: boolean;
    stickyHeader: boolean;
    announcementBar: {
      enabled: boolean;
      text: string;
      backgroundColor: string;
      textColor: string;
      linkUrl: string;
      startsAt?: Date | null;
      endsAt?: Date | null;
    };
  };
  footerSettings?: {
    footerLogoUrl?: string;
    description: string;
    copyrightText: string;
    showPaymentLogos: boolean;
  };
  paymentMethods?: Array<{
    key: 'cod' | 'bkash' | 'nagad' | 'card' | 'sslcommerz';
    label: string;
    enabled: boolean;
    displayOrder: number;
    instructions: string;
    mode: 'sandbox' | 'live';
  }>;
  emailSettings?: {
    senderName: string;
    senderEmail: string;
    replyToEmail: string;
    orderConfirmationEnabled: boolean;
    shipmentUpdateEnabled: boolean;
    lowStockAlertEnabled: boolean;
  };
  notificationSettings?: {
    adminNewOrder: boolean;
    adminLowStock: boolean;
    adminReturnRequest: boolean;
    customerOrderUpdates: boolean;
    customerPromotions: boolean;
    lowStockAlertEmail: string;
  };
  securitySettings?: {
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    lockoutMinutes: number;
    minPasswordLength: number;
    requireStrongPassword: boolean;
    requireEmailVerification: boolean;
  };
  policies: {
    returnPolicy: string;
    shippingPolicy: string;
    privacyPolicy: string;
    termsAndConditions: string;
    aboutUs: string;
  };
  seoDefaults: {
    titleSuffix: string;
    defaultDescription: string;
    ogImageUrl?: string;
    robotsTxt?: string;
    sitemapEnabled?: boolean;
  };
  adsense: {
    enabled: boolean;
    publisherId?: string;
    adSlotId?: string;
  };
  updatedAt: Date;
}

const StoreSettingsSchema = new Schema<IStoreSettings>(
  {
    key: { type: String, default: 'primary', unique: true },
    storeName: { type: String, default: 'NOVARA COMMERCE' },
    tagline: { type: String, default: 'Shop Smart, Live Better' },
    supportEmail: { type: String, default: '' },
    supportPhone: { type: String, default: '' },
    businessAddress: { type: String, default: 'Dhaka, Bangladesh' },
    socialLinks: {
      whatsapp: { type: String, default: '' },
      messenger: { type: String, default: '' },
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      youtube: { type: String, default: '' },
      tiktok: { type: String, default: '' },
    },
    shipping: {
      dhakaMetroCharge: { type: Number, default: 60 },
      dhakaSuburbCharge: { type: Number, default: 90 },
      outsideDhakaCharge: { type: Number, default: 130 },
      freeShippingThreshold: { type: Number, default: 999 },
      expressSurcharge: { type: Number, default: 80 },
    },
    taxRate: { type: Number, default: 0, min: 0, max: 30 },
    taxSettings: {
      enabled: { type: Boolean, default: false },
      taxInclusive: { type: Boolean, default: true },
      label: { type: String, default: 'VAT' },
      applyToShipping: { type: Boolean, default: false },
    },
    headerSettings: {
      logoUrl: { type: String, default: '' },
      logoPublicId: { type: String, default: '' },
      showSearch: { type: Boolean, default: true },
      showWishlist: { type: Boolean, default: true },
      showCart: { type: Boolean, default: true },
      showAccount: { type: Boolean, default: true },
      stickyHeader: { type: Boolean, default: true },
      announcementBar: {
        enabled: { type: Boolean, default: true },
        text: { type: String, default: '' },
        backgroundColor: { type: String, default: '#0B1A2B' },
        textColor: { type: String, default: '#FFFFFF' },
        linkUrl: { type: String, default: '' },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
      },
    },
    footerSettings: {
      footerLogoUrl: { type: String, default: '' },
      description: {
        type: String,
        default:
          'Your trusted Bangladesh retail storefront for authentic electronics, fashion, books, beauty, and home essentials.',
      },
      copyrightText: { type: String, default: 'All Rights Reserved.' },
      showPaymentLogos: { type: Boolean, default: true },
    },
    paymentMethods: {
      type: [
        {
          _id: false,
          key: { type: String, enum: ['cod', 'bkash', 'nagad', 'card', 'sslcommerz'], required: true },
          label: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          displayOrder: { type: Number, default: 0 },
          instructions: { type: String, default: '' },
          mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
        },
      ],
      default: [
        { key: 'cod', label: 'Cash on Delivery', enabled: true, displayOrder: 1, instructions: 'Pay in cash upon doorstep delivery across Bangladesh.', mode: 'live' },
        { key: 'bkash', label: 'bKash', enabled: true, displayOrder: 2, instructions: 'Pay securely via SSLCommerz bKash wallet checkout.', mode: 'sandbox' },
        { key: 'nagad', label: 'Nagad', enabled: true, displayOrder: 3, instructions: 'Pay securely via SSLCommerz Nagad wallet checkout.', mode: 'sandbox' },
        { key: 'card', label: 'Debit / Credit Card', enabled: true, displayOrder: 4, instructions: 'Visa, Mastercard & DBBL Nexus via SSLCommerz.', mode: 'sandbox' },
      ],
    },
    emailSettings: {
      senderName: { type: String, default: 'NOVARA COMMERCE' },
      senderEmail: { type: String, default: 'no-reply@novaracommerce.com' },
      replyToEmail: { type: String, default: 'support@novaracommerce.com' },
      orderConfirmationEnabled: { type: Boolean, default: true },
      shipmentUpdateEnabled: { type: Boolean, default: true },
      lowStockAlertEnabled: { type: Boolean, default: true },
    },
    notificationSettings: {
      adminNewOrder: { type: Boolean, default: true },
      adminLowStock: { type: Boolean, default: true },
      adminReturnRequest: { type: Boolean, default: true },
      customerOrderUpdates: { type: Boolean, default: true },
      customerPromotions: { type: Boolean, default: false },
      lowStockAlertEmail: { type: String, default: '' },
    },
    securitySettings: {
      sessionTimeoutMinutes: { type: Number, default: 10080 },
      maxLoginAttempts: { type: Number, default: 10 },
      lockoutMinutes: { type: Number, default: 15 },
      minPasswordLength: { type: Number, default: 8 },
      requireStrongPassword: { type: Boolean, default: false },
      requireEmailVerification: { type: Boolean, default: false },
    },
    policies: {
      returnPolicy: {
        type: String,
        default: 'Customers in Bangladesh may request a return or replacement within 7 days of delivery for eligible unused items in original packaging.',
      },
      shippingPolicy: {
        type: String,
        default: 'Standard delivery across Dhaka takes 1-2 business days and 2-5 business days nationwide. Free standard shipping applies on eligible orders over ৳999.',
      },
      privacyPolicy: {
        type: String,
        default: 'NOVARA COMMERCE collects only the personal and delivery details required to fulfill orders and provide requested customer support.',
      },
      termsAndConditions: {
        type: String,
        default: 'All prices are displayed in BDT (৳). Orders are subject to stock verification and server-side pricing confirmation.',
      },
      aboutUs: {
        type: String,
        default: 'NOVARA COMMERCE is a single-vendor retail storefront serving customers across Bangladesh with curated electronics, fashion, books, beauty, and home essentials.',
      },
    },
    seoDefaults: {
      titleSuffix: { type: String, default: 'NOVARA COMMERCE' },
      defaultDescription: {
        type: String,
        default: 'Shop electronics, fashion, books, beauty, and home essentials across Bangladesh at NOVARA COMMERCE.',
      },
      ogImageUrl: { type: String, default: '' },
      robotsTxt: { type: String, default: 'User-agent: *\nAllow: /\nDisallow: /admin' },
      sitemapEnabled: { type: Boolean, default: true },
    },
    adsense: {
      enabled: { type: Boolean, default: false },
      publisherId: { type: String, default: '' },
      adSlotId: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export const StoreSettingsModel =
  mongoose.models.StoreSettings || mongoose.model<IStoreSettings>('StoreSettings', StoreSettingsSchema);

export interface INavigationMenuItem extends Document {
  label: string;
  url: string;
  parentId?: mongoose.Types.ObjectId | null;
  location: 'header' | 'footer';
  displayOrder: number;
  isVisible: boolean;
  openInNewTab: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NavigationMenuItemSchema = new Schema<INavigationMenuItem>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    url: { type: String, required: true, trim: true, maxlength: 300 },
    parentId: { type: Schema.Types.ObjectId, ref: 'NavigationMenuItem', default: null },
    location: { type: String, enum: ['header', 'footer'], default: 'header', index: true },
    displayOrder: { type: Number, default: 0, index: true },
    isVisible: { type: Boolean, default: true },
    openInNewTab: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const NavigationMenuItemModel =
  mongoose.models.NavigationMenuItem ||
  mongoose.model<INavigationMenuItem>('NavigationMenuItem', NavigationMenuItemSchema);

export interface IStaticPage extends Document {
  title: string;
  slug: string;
  content: string;
  pageType: 'policy' | 'custom';
  seoTitle?: string;
  seoDescription?: string;
  isPublished: boolean;
  showInFooter: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StaticPageSchema = new Schema<IStaticPage>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    content: { type: String, required: true, maxlength: 30000 },
    pageType: { type: String, enum: ['policy', 'custom'], default: 'custom' },
    seoTitle: { type: String, maxlength: 140 },
    seoDescription: { type: String, maxlength: 260 },
    isPublished: { type: Boolean, default: true, index: true },
    showInFooter: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const StaticPageModel =
  mongoose.models.StaticPage || mongoose.model<IStaticPage>('StaticPage', StaticPageSchema);

export interface IFaqItem extends Document {
  question: string;
  answer: string;
  category: string;
  displayOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FaqItemSchema = new Schema<IFaqItem>(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 4000 },
    category: { type: String, trim: true, maxlength: 60, default: 'General' },
    displayOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const FaqItemModel =
  mongoose.models.FaqItem || mongoose.model<IFaqItem>('FaqItem', FaqItemSchema);

export interface IBlogPost extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  featuredImageUrl?: string;
  featuredImagePublicId?: string;
  authorName: string;
  seoTitle?: string;
  seoDescription?: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, trim: true, maxlength: 400, default: '' },
    content: { type: String, required: true, maxlength: 40000 },
    category: { type: String, trim: true, maxlength: 60, default: 'Guides' },
    featuredImageUrl: { type: String, trim: true, default: '' },
    featuredImagePublicId: { type: String, trim: true, default: '' },
    authorName: { type: String, trim: true, maxlength: 80, default: 'NOVARA Editorial' },
    seoTitle: { type: String, maxlength: 140 },
    seoDescription: { type: String, maxlength: 260 },
    status: { type: String, enum: ['draft', 'published', 'scheduled'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const BlogPostModel =
  mongoose.models.BlogPost || mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);

export interface IBanner extends Document {
  name: string;
  aspectRatio: '16:9' | '4:3' | '1:1' | '21:9' | 'custom';
  customAspectWidth: number;
  customAspectHeight: number;
  bannerSize: 'full_width' | 'container_width' | 'large' | 'medium' | 'small' | 'custom';
  position: string;
  displayOrder: number;
  priority: number;
  isActive: boolean;
  status: 'draft' | 'published';
  startsAt?: Date | null;
  endsAt?: Date | null;

  badgeText: string;
  mainHeading: string;
  highlightText: string;
  subHeading: string;
  buttonText: string;
  buttonLink: string;
  altText: string;
  fontFamily: string;
  fontWeight: string;
  textAlignment: 'left' | 'center' | 'right';
  letterSpacingPx: number;
  textColor: string;
  highlightColor: string;
  buttonBgColor: string;
  buttonTextColor: string;

  backgroundType: 'solid' | 'gradient' | 'image' | 'overlay';
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientDirection: string;
  backgroundOpacity: number;
  desktopImageUrl: string;
  desktopImagePublicId?: string;
  mobileImageUrl: string;
  mobileImagePublicId?: string;

  productSelectionMode: 'none' | 'featured' | 'best_sellers' | 'latest' | 'custom';
  selectedProductIds: mongoose.Types.ObjectId[];
  targetCategorySlugs: string[];
  targetCustomPageSlugs: string[];

  animationEffect: 'fade' | 'slide_up' | 'slide_left' | 'zoom' | 'none';
  animationSpeed: 'fast' | 'normal' | 'slow';
  autoPlay: boolean;
  loop: boolean;
  animationDelaySec: number;

  bannerWidthPx: number;
  bannerHeightPx: number;
  paddingPx: number;
  borderRadiusPx: number;
  boxShadow: boolean;

  overlayEnabled: boolean;
  overlayColor: string;
  overlayOpacity: number;
  patternEnabled: boolean;
  patternType: 'dots' | 'grid' | 'diagonal';
  blurEnabled: boolean;
  blurPx: number;
  customCss: string;

  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    aspectRatio: {
      type: String,
      enum: ['16:9', '4:3', '1:1', '21:9', 'custom'],
      default: '16:9',
    },
    customAspectWidth: { type: Number, min: 1, max: 40, default: 16 },
    customAspectHeight: { type: Number, min: 1, max: 40, default: 9 },
    bannerSize: {
      type: String,
      enum: ['full_width', 'container_width', 'large', 'medium', 'small', 'custom'],
      default: 'full_width',
    },
    position: { type: String, required: true, trim: true, default: 'homepage_top_slider', index: true },
    displayOrder: { type: Number, default: 1, min: 0, index: true },
    priority: { type: Number, default: 10, min: 0, max: 1000 },
    isActive: { type: Boolean, default: true, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published', index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    badgeText: { type: String, trim: true, maxlength: 80, default: '' },
    mainHeading: { type: String, required: true, trim: true, maxlength: 100 },
    highlightText: { type: String, trim: true, maxlength: 60, default: '' },
    subHeading: { type: String, trim: true, maxlength: 160, default: '' },
    buttonText: { type: String, trim: true, maxlength: 30, default: 'Shop Now' },
    buttonLink: { type: String, trim: true, maxlength: 300, default: '/shop' },
    altText: { type: String, trim: true, maxlength: 180, default: 'Storefront promotional banner' },
    fontFamily: { type: String, trim: true, maxlength: 60, default: 'Poppins' },
    fontWeight: { type: String, enum: ['400', '500', '600', '700', '800'], default: '700' },
    textAlignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    letterSpacingPx: { type: Number, min: -4, max: 12, default: 0 },
    textColor: { type: String, trim: true, maxlength: 20, default: '#FFFFFF' },
    highlightColor: { type: String, trim: true, maxlength: 20, default: '#A3E635' },
    buttonBgColor: { type: String, trim: true, maxlength: 20, default: '#A3E635' },
    buttonTextColor: { type: String, trim: true, maxlength: 20, default: '#0F172A' },

    backgroundType: {
      type: String,
      enum: ['solid', 'gradient', 'image', 'overlay'],
      default: 'gradient',
    },
    solidColor: { type: String, trim: true, maxlength: 20, default: '#15803D' },
    gradientStart: { type: String, trim: true, maxlength: 20, default: '#06381C' },
    gradientEnd: { type: String, trim: true, maxlength: 20, default: '#22C55E' },
    gradientDirection: { type: String, trim: true, maxlength: 40, default: '135deg' },
    backgroundOpacity: { type: Number, min: 0, max: 100, default: 100 },
    desktopImageUrl: { type: String, trim: true, maxlength: 600, default: '' },
    desktopImagePublicId: { type: String, trim: true, maxlength: 200, default: '' },
    mobileImageUrl: { type: String, trim: true, maxlength: 600, default: '' },
    mobileImagePublicId: { type: String, trim: true, maxlength: 200, default: '' },

    productSelectionMode: {
      type: String,
      enum: ['none', 'featured', 'best_sellers', 'latest', 'custom'],
      default: 'none',
    },
    selectedProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    targetCategorySlugs: [{ type: String, trim: true, lowercase: true }],
    targetCustomPageSlugs: [{ type: String, trim: true, lowercase: true }],

    animationEffect: {
      type: String,
      enum: ['fade', 'slide_up', 'slide_left', 'zoom', 'none'],
      default: 'fade',
    },
    animationSpeed: { type: String, enum: ['fast', 'normal', 'slow'], default: 'normal' },
    autoPlay: { type: Boolean, default: true },
    loop: { type: Boolean, default: true },
    animationDelaySec: { type: Number, min: 1, max: 30, default: 3 },

    bannerWidthPx: { type: Number, min: 200, max: 3840, default: 1920 },
    bannerHeightPx: { type: Number, min: 80, max: 1400, default: 460 },
    paddingPx: { type: Number, min: 0, max: 120, default: 36 },
    borderRadiusPx: { type: Number, min: 0, max: 64, default: 20 },
    boxShadow: { type: Boolean, default: true },

    overlayEnabled: { type: Boolean, default: true },
    overlayColor: { type: String, trim: true, maxlength: 20, default: '#052E16' },
    overlayOpacity: { type: Number, min: 0, max: 95, default: 35 },
    patternEnabled: { type: Boolean, default: false },
    patternType: { type: String, enum: ['dots', 'grid', 'diagonal'], default: 'dots' },
    blurEnabled: { type: Boolean, default: false },
    blurPx: { type: Number, min: 0, max: 32, default: 6 },
    customCss: { type: String, maxlength: 2000, default: '' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

BannerSchema.index({ position: 1, isActive: 1, status: 1, displayOrder: 1, priority: -1 });

export const BannerModel =
  mongoose.models.Banner || mongoose.model<IBanner>('Banner', BannerSchema);

export interface ISlideshowSlide {
  _id: mongoose.Types.ObjectId;
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
  imagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right';

  horizontalAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  contentMaxWidthPx: number;
  paddingPx: number;

  fontFamily: string;
  fontWeight: '400' | '500' | '600' | '700' | '800';
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

  overlayType: 'solid' | 'gradient';
  overlayColor: string;
  overlayOpacity: number;
  gradientStart: string;
  gradientEnd: string;
  gradientStartOpacity: number;
  gradientEndOpacity: number;
  gradientDirection: string;
  blurPx: number;

  animationEffect: 'fade' | 'slide' | 'zoom' | 'zoom_in' | 'zoom_out' | 'ken_burns' | 'none';
  animationDurationMs: number;
  animationDelayMs: number;

  displayOrder: number;
  status: 'draft' | 'published' | 'scheduled' | 'inactive';
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISlideshow extends Document {
  name: string;
  placement: 'homepage' | 'cart' | 'wishlist' | 'checkout';
  targetPage: string;
  isActive: boolean;
  autoplay: boolean;
  infiniteLoop: boolean;
  pauseOnHover: boolean;
  animationSpeed: 'fast' | 'normal' | 'slow';
  transitionEffect: 'fade' | 'slide' | 'zoom' | 'zoom_in' | 'zoom_out' | 'ken_burns' | 'none';
  transitionDurationMs: number;
  autoplayIntervalMs: number;
  indicatorStyle: 'dots' | 'progress' | 'numbers' | 'thumbnails' | 'none';
  showIndicators: boolean;
  showArrows: boolean;
  desktopHeightPx: number;
  tabletHeightPx: number;
  mobileHeightPx: number;
  borderRadiusPx: number;
  compactMode: boolean;
  slides: ISlideshowSlide[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SlideshowSlideSchema = new Schema<ISlideshowSlide>(
  {
    internalName: { type: String, trim: true, maxlength: 140, default: 'Untitled Slide' },
    badgeText: { type: String, trim: true, maxlength: 80, default: '' },
    mainHeading: { type: String, required: true, trim: true, maxlength: 120 },
    highlightText: { type: String, trim: true, maxlength: 60, default: '' },
    subtitle: { type: String, trim: true, maxlength: 200, default: '' },
    description: { type: String, trim: true, maxlength: 400, default: '' },

    primaryButtonText: { type: String, trim: true, maxlength: 40, default: '' },
    primaryButtonUrl: { type: String, trim: true, maxlength: 300, default: '' },
    primaryButtonNewTab: { type: Boolean, default: false },

    secondaryButtonText: { type: String, trim: true, maxlength: 40, default: '' },
    secondaryButtonUrl: { type: String, trim: true, maxlength: 300, default: '' },
    secondaryButtonNewTab: { type: Boolean, default: false },

    destinationUrl: { type: String, trim: true, maxlength: 300, default: '' },
    destinationNewTab: { type: Boolean, default: false },

    desktopImageUrl: { type: String, required: true, trim: true, maxlength: 600 },
    desktopImagePublicId: { type: String, trim: true, maxlength: 200, default: '' },
    mobileImageUrl: { type: String, trim: true, maxlength: 600, default: '' },
    mobileImagePublicId: { type: String, trim: true, maxlength: 200, default: '' },
    altText: { type: String, trim: true, maxlength: 180, default: 'Promotional slideshow image' },
    imagePosition: {
      type: String,
      enum: ['center', 'top', 'bottom', 'left', 'right'],
      default: 'center',
    },

    horizontalAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    verticalAlign: { type: String, enum: ['top', 'center', 'bottom'], default: 'center' },
    contentMaxWidthPx: { type: Number, min: 260, max: 1400, default: 620 },
    paddingPx: { type: Number, min: 12, max: 120, default: 40 },

    fontFamily: { type: String, trim: true, maxlength: 60, default: 'Poppins' },
    fontWeight: { type: String, enum: ['400', '500', '600', '700', '800'], default: '700' },
    headingSizePx: { type: Number, min: 16, max: 76, default: 44 },
    subtitleSizePx: { type: Number, min: 12, max: 36, default: 17 },
    lineHeight: { type: Number, min: 0.9, max: 2.2, default: 1.15 },
    letterSpacingPx: { type: Number, min: -4, max: 12, default: 0 },
    textColor: { type: String, trim: true, maxlength: 20, default: '#FFFFFF' },
    highlightColor: { type: String, trim: true, maxlength: 20, default: '#A3E635' },
    primaryBtnBg: { type: String, trim: true, maxlength: 20, default: '#A3E635' },
    primaryBtnText: { type: String, trim: true, maxlength: 20, default: '#0F172A' },
    secondaryBtnBg: { type: String, trim: true, maxlength: 20, default: '#FFFFFF' },
    secondaryBtnText: { type: String, trim: true, maxlength: 20, default: '#FFFFFF' },

    overlayType: { type: String, enum: ['solid', 'gradient'], default: 'gradient' },
    overlayColor: { type: String, trim: true, maxlength: 20, default: '#052E16' },
    overlayOpacity: { type: Number, min: 0, max: 95, default: 52 },
    gradientStart: { type: String, trim: true, maxlength: 20, default: '#041E11' },
    gradientEnd: { type: String, trim: true, maxlength: 20, default: '#06381C' },
    gradientStartOpacity: { type: Number, min: 0, max: 95, default: 80 },
    gradientEndOpacity: { type: Number, min: 0, max: 95, default: 28 },
    gradientDirection: { type: String, trim: true, maxlength: 40, default: 'to right' },
    blurPx: { type: Number, min: 0, max: 24, default: 0 },

    animationEffect: {
      type: String,
      enum: ['fade', 'slide', 'zoom', 'zoom_in', 'zoom_out', 'ken_burns', 'none'],
      default: 'fade',
    },
    animationDurationMs: { type: Number, min: 150, max: 3000, default: 600 },
    animationDelayMs: { type: Number, min: 0, max: 5000, default: 0 },

    displayOrder: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled', 'inactive'],
      default: 'published',
    },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SlideshowSchema = new Schema<ISlideshow>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    placement: {
      type: String,
      enum: ['homepage', 'cart', 'wishlist', 'checkout'],
      required: true,
      index: true,
    },
    targetPage: { type: String, trim: true, maxlength: 120, default: '/' },
    isActive: { type: Boolean, default: true, index: true },
    autoplay: { type: Boolean, default: true },
    infiniteLoop: { type: Boolean, default: true },
    pauseOnHover: { type: Boolean, default: true },
    animationSpeed: { type: String, enum: ['fast', 'normal', 'slow'], default: 'normal' },
    transitionEffect: {
      type: String,
      enum: ['fade', 'slide', 'zoom', 'zoom_in', 'zoom_out', 'ken_burns', 'none'],
      default: 'fade',
    },
    transitionDurationMs: { type: Number, min: 150, max: 3000, default: 600 },
    autoplayIntervalMs: { type: Number, min: 1500, max: 15000, default: 5000 },
    indicatorStyle: {
      type: String,
      enum: ['dots', 'progress', 'numbers', 'thumbnails', 'none'],
      default: 'dots',
    },
    showIndicators: { type: Boolean, default: true },
    showArrows: { type: Boolean, default: true },
    desktopHeightPx: { type: Number, min: 120, max: 900, default: 480 },
    tabletHeightPx: { type: Number, min: 120, max: 800, default: 380 },
    mobileHeightPx: { type: Number, min: 110, max: 700, default: 300 },
    borderRadiusPx: { type: Number, min: 0, max: 48, default: 20 },
    compactMode: { type: Boolean, default: false },
    slides: [SlideshowSlideSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SlideshowSchema.index({ placement: 1, isActive: 1, updatedAt: -1 });
SlideshowSchema.index({ 'slides.displayOrder': 1 });

export const SlideshowModel =
  mongoose.models.Slideshow || mongoose.model<ISlideshow>('Slideshow', SlideshowSchema);

