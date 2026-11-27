import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.ts';
import {
  BANNER_POSITION_OPTIONS,
  filterAndSortActiveBanners,
  normalizeHexColor,
  sanitizeCustomCss,
} from '../../../../shared/bannerHelpers.ts';
import { filterActiveCartBanners } from '../../../../shared/cartHelpers.ts';
import { isSafeDestinationUrl } from '../../../../shared/security.ts';
import {
  filterActiveWishlistSlides,
  hasValidScheduleWindow,
  validateImageUploadMeta,
} from '../../../../shared/wishlistHelpers.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { toPatchSchema } from '../../utils/zodPartial.ts';
import {
  destroyCloudinaryAssetIfUnused,
  uploadBufferToCloudinary,
} from '../../services/cloudinary.service.ts';
import { sendTransactionalEmail } from '../../services/email.service.ts';
import { userHasEffectivePermission } from '../../services/rbac.service.ts';
import { ProductModel } from '../catalog/catalog.model.ts';
import { invalidateFooterCache } from '../footer/footer.cache.ts';
import {
  BannerModel,
  BlogPostModel,
  CartHeroBannerModel,
  FaqItemModel,
  HomepageConfigModel,
  NavigationMenuItemModel,
  PromotionalPlacementModel,
  StaticPageModel,
  StoreSettingsModel,
  WishlistHeroSlideModel,
} from './cms.model.ts';
import { adminSlideshowRouter, publicSlideshowRouter } from './slideshow.routes.ts';

const router = Router();
router.use(requireDatabase);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

export async function ensureDefaultCmsDocuments() {
  let homepage = await HomepageConfigModel.findOne({ key: 'primary' });
  if (!homepage) {
    homepage = await HomepageConfigModel.create({
      key: 'primary',
      announcementItems: [
        { icon: 'truck', text: 'Free Shipping on Orders Over ৳999' },
        { icon: 'rotate', text: '7 Days Easy Return' },
        { icon: 'shield', text: 'Secure Payment' },
      ],
      announcementPhone: '+880 1700 000000',
      heroSlides: [
        {
          badge: 'Big Savings, Big Happiness',
          headlinePrefix: 'Smart Shopping',
          headlineHighlight: 'Bigger',
          headlineSuffix: 'Savings!',
          subtitle: 'Up to 60% Off on Top Brands Across Bangladesh',
          ctaText: 'Shop Now',
          ctaLink: '/shop',
          imageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
          isActive: true,
        },
        {
          badge: 'Authentic Electronics & Gadgets',
          headlinePrefix: 'Upgrade Your',
          headlineHighlight: 'Tech',
          headlineSuffix: 'Setup Today',
          subtitle: 'Official Warranty & Cash on Delivery Nationwide',
          ctaText: 'Explore Electronics',
          ctaLink: '/category/electronics',
          imageUrl: '/src/assets/images/promo_tech_laptops_1795621230990.jpg',
          isActive: true,
        },
      ],
      trustPoints: [
        { title: 'Premium Quality', subtitle: 'Best Products', icon: 'gem' },
        { title: 'Secure Payment', subtitle: '100% Secure', icon: 'shield' },
        { title: 'Easy Return', subtitle: '7 Days Return', icon: 'rotate' },
        { title: '24/7 Support', subtitle: 'Always Here', icon: 'headphones' },
      ],
      dualBanners: [
        {
          eyebrow: 'Up to',
          title: '70% OFF on Electronics',
          ctaText: 'Shop Now',
          ctaLink: '/category/electronics',
          imageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
          theme: 'ice',
        },
        {
          eyebrow: 'Flat',
          title: '50% OFF on Fashion Collection',
          ctaText: 'Shop Now',
          ctaLink: '/category/fashion',
          imageUrl: '/src/assets/images/promo_fashion_bundle_1795621230765.jpg',
          theme: 'blush',
        },
      ],
      sections: [
        { id: 'hero', label: 'Hero Campaign', enabled: true, order: 1, collectionType: 'hero' },
        { id: 'categories', label: 'Shop by Category', enabled: true, order: 2, title: 'Shop by Category', subtitle: 'Explore our wide range of categories', collectionType: 'categories' },
        { id: 'dual_banners', label: 'Dual Category Banners', enabled: true, order: 3, collectionType: 'dual_banners' },
        { id: 'featured_products', label: 'Featured Products', enabled: true, order: 4, title: 'Featured Products', subtitle: 'Handpicked favorites just for you', collectionType: 'featured_products', productLimit: 5, ctaText: 'View All', ctaLink: '/shop' },
        { id: 'promo_placement', label: 'Promotional Ad Placement', enabled: true, order: 5, collectionType: 'promo_placement' },
        { id: 'best_sellers', label: 'Best Sellers', enabled: true, order: 6, title: 'Best Sellers', subtitle: 'Most popular products based on verified orders', collectionType: 'best_sellers', productLimit: 5, ctaText: 'View All', ctaLink: '/shop?sort=best_selling' },
        { id: 'new_arrivals', label: 'New Arrivals', enabled: true, order: 7, title: 'New Arrivals', subtitle: 'Freshly added products across our store', collectionType: 'new_arrivals', productLimit: 5, ctaText: 'View All', ctaLink: '/shop?sort=newest' },
        { id: 'top_rated', label: 'Top Rated Products', enabled: true, order: 8, title: 'Top Rated Products', subtitle: 'Highest rated by verified shoppers', collectionType: 'top_rated', productLimit: 5, ctaText: 'View All', ctaLink: '/shop?sort=top_rated' },
        { id: 'on_sale', label: 'Special Offers & Flash Deals', enabled: true, order: 9, title: 'Special Offers & Deals', subtitle: 'Limited-time price drops across Bangladesh', collectionType: 'on_sale', productLimit: 5, ctaText: 'View Deals', ctaLink: '/deals' },
        { id: 'newsletter', label: 'Newsletter Subscription', enabled: true, order: 10, collectionType: 'newsletter' },
        { id: 'happy_clients', label: 'Authentic Customer Reviews', enabled: true, order: 11, title: 'Our Happy Clients', subtitle: 'Real feedback from verified NOVARA customers', collectionType: 'happy_clients' },
      ],
      status: 'published',
    });
  }

  let settings = await StoreSettingsModel.findOne({ key: 'primary' });
  if (!settings) {
    settings = await StoreSettingsModel.create({ key: 'primary' });
  }

  if (!homepage.wishlistDefaultsSeeded) {
    const wishlistSlidesCount = await WishlistHeroSlideModel.countDocuments();
    if (wishlistSlidesCount === 0) {
      await WishlistHeroSlideModel.insertMany([
        {
          title: 'My Wishlist',
          subtitle: 'Your favorite products, all in one place.',
          ctaText: 'Explore Deals',
          ctaDestination: '/shop?onSale=true',
          desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
          mobileImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
          altText: 'My Wishlist curated favorites banner',
          displayOrder: 0,
          isActive: true,
        },
        {
          title: 'Curated Savings Across Bangladesh',
          subtitle: 'Track flash discounts on electronics, fashion, and everyday essentials.',
          ctaText: 'Shop Flash Deals',
          ctaDestination: '/shop?tab=on_sale',
          desktopImageUrl: '/src/assets/images/promo_fashion_bundle_1795621230765.jpg',
          mobileImageUrl: '/src/assets/images/promo_fashion_bundle_1795621230765.jpg',
          altText: 'Seasonal wishlist savings banner',
          displayOrder: 1,
          isActive: true,
        },
      ]);
    }

    const wishlistBottomPromoExists = await PromotionalPlacementModel.exists({
      placementSlot: 'wishlist_bottom_banner',
    });
    if (!wishlistBottomPromoExists) {
      await PromotionalPlacementModel.create({
        title: "Don't Miss Out!",
        subtitle: 'Explore more amazing products and exclusive deals.',
        ctaText: 'Continue Shopping',
        destinationUrl: '/shop',
        altText: 'Explore more amazing products and exclusive deals on NOVARA COMMERCE',
        imageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
        placementSlot: 'wishlist_bottom_banner',
        layoutStyle: 'soft_sage_banner',
        isEnabled: true,
        status: 'published',
      });
    }

    homepage.wishlistDefaultsSeeded = true;
    await homepage.save();
  }

  if (!homepage.cartDefaultsSeeded) {
    const cartBannerCount = await CartHeroBannerModel.countDocuments();
    if (cartBannerCount === 0) {
      await CartHeroBannerModel.create({
        badgeText: 'Your Shopping Cart',
        heading: 'Your Cart',
        subtitle: 'Review your items and proceed to checkout',
        ctaText: 'Continue Shopping',
        ctaLink: '/shop',
        desktopImageUrl: '',
        mobileImageUrl: '',
        altText: 'Your Shopping Cart Banner',
        imagePosition: 'right',
        displayOrder: 0,
        isEnabled: true,
      });
    }
    homepage.cartDefaultsSeeded = true;
    await homepage.save();
  }

  return { homepage, settings };
}

// Public: Homepage Configuration + Active Valid Promotional Placements + Public Store Settings
router.get(
  '/public/homepage',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { homepage, settings } = await ensureDefaultCmsDocuments();
    const now = new Date();

    const activePromos = await PromotionalPlacementModel.find({
      isEnabled: true,
      status: 'published',
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort({ displayOrder: 1, updatedAt: -1 })
      .lean();

    res.json({
      homepage: homepage.status === 'published' ? homepage : null,
      activePromotions: activePromos,
      storeSettings: {
        storeName: settings.storeName,
        tagline: settings.tagline,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        businessAddress: settings.businessAddress,
        socialLinks: settings.socialLinks,
        shipping: settings.shipping,
        taxRate: settings.taxRate ?? 0,
        taxSettings: settings.taxSettings,
        headerSettings: settings.headerSettings,
        footerSettings: settings.footerSettings,
        paymentMethods: settings.paymentMethods,
        policies: settings.policies,
        seoDefaults: settings.seoDefaults,
        adsense: settings.adsense,
      },
    });
  })
);

router.get(
  '/public/settings',
  asyncHandler(async (_req, res) => {
    const { settings } = await ensureDefaultCmsDocuments();
    res.json({
      settings: {
        storeName: settings.storeName,
        tagline: settings.tagline,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        businessAddress: settings.businessAddress,
        socialLinks: settings.socialLinks,
        shipping: settings.shipping,
        taxRate: settings.taxRate ?? 0,
        taxSettings: settings.taxSettings,
        headerSettings: settings.headerSettings,
        footerSettings: settings.footerSettings,
        paymentMethods: settings.paymentMethods,
        policies: settings.policies,
        seoDefaults: settings.seoDefaults,
        adsense: settings.adsense,
      },
    });
  })
);

// Public: Navigation Menu Items
router.get(
  '/public/navigation',
  asyncHandler(async (req, res) => {
    const location = req.query.location === 'footer' ? 'footer' : req.query.location === 'header' ? 'header' : null;
    const filter: Record<string, unknown> = { isVisible: true };
    if (location) filter.location = location;
    const items = await NavigationMenuItemModel.find(filter)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ items });
  })
);

// Public: Static Pages
router.get(
  '/public/pages',
  asyncHandler(async (_req, res) => {
    const pages = await StaticPageModel.find({ isPublished: true })
      .select('title slug pageType showInFooter updatedAt')
      .sort({ title: 1 })
      .lean();
    res.json({ pages });
  })
);

router.get(
  '/public/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await StaticPageModel.findOne({
      slug: req.params.slug.toLowerCase(),
      isPublished: true,
    }).lean();
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json({ page });
  })
);

// Public: FAQs
router.get(
  '/public/faqs',
  asyncHandler(async (_req, res) => {
    const faqs = await FaqItemModel.find({ isPublished: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ faqs });
  })
);

// Public: Blog Posts
router.get(
  '/public/blog',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const posts = await BlogPostModel.find({
      $or: [
        { status: 'published' },
        { status: 'scheduled', publishedAt: { $lte: now } },
      ],
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();
    res.json({ posts });
  })
);

router.get(
  '/public/blog/:slug',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const post = await BlogPostModel.findOne({
      slug: req.params.slug.toLowerCase(),
      $or: [
        { status: 'published' },
        { status: 'scheduled', publishedAt: { $lte: now } },
      ],
    }).lean();
    if (!post) {
      res.status(404).json({ error: 'Blog article not found' });
      return;
    }
    res.json({ post });
  })
);

router.get(
  '/public/wishlist-page',
  asyncHandler(async (_req, res) => {
    const { homepage } = await ensureDefaultCmsDocuments();
    const now = new Date();

    const [allSlides, wishlistPromos] = await Promise.all([
      WishlistHeroSlideModel.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      PromotionalPlacementModel.find({
        placementSlot: { $in: ['wishlist_bottom_banner', 'wishlist_sidebar'] },
        isEnabled: true,
        status: 'published',
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const slides = filterActiveWishlistSlides(allSlides, now);
    const bottomPromo =
      wishlistPromos.find((p) => p.placementSlot === 'wishlist_bottom_banner') || null;
    const sidebarPromo =
      wishlistPromos.find((p) => p.placementSlot === 'wishlist_sidebar') || null;

    res.json({
      slides,
      sliderSettings: homepage.wishlistSliderSettings || {
        autoplay: true,
        transitionDurationMs: 5000,
      },
      bottomPromo,
      sidebarPromo,
    });
  })
);

router.get(
  '/public/checkout-banner',
  asyncHandler(async (_req, res) => {
    const { homepage, settings } = await ensureDefaultCmsDocuments();
    const banner = homepage.checkoutBanner || {
      enabled: true,
      badgeText: 'Secure Checkout',
      heading: 'Checkout',
      subtitle: 'Complete your order quickly and securely',
      desktopImageUrl: '',
      mobileImageUrl: '',
      altText: 'Secure Checkout Banner',
    };
    res.json({
      banner,
      taxRate: settings.taxRate ?? 0,
      taxSettings: settings.taxSettings,
      shipping: settings.shipping,
    });
  })
);

router.get(
  '/public/cart-banner',
  asyncHandler(async (_req, res) => {
    const { homepage, settings } = await ensureDefaultCmsDocuments();
    const now = new Date();
    const candidates = await CartHeroBannerModel.find({ isEnabled: true })
      .sort({ displayOrder: 1, updatedAt: -1 })
      .lean();
    const active = filterActiveCartBanners(candidates, now);

    res.json({
      banner: active[0] || null,
      trustPoints: homepage.trustPoints || [],
      shipping: settings.shipping,
      taxRate: settings.taxRate ?? 0,
      taxSettings: settings.taxSettings,
    });
  })
);

// ADMIN: Cloudinary Image Upload
router.get(
  '/admin/cloudinary/status',
  requireAuth,
  requirePermission('catalog:write'),
  (_req, res) => {
    res.json({
      configured: env.cloudinary.isConfigured,
      cloudName: env.cloudinary.cloudName || null,
    });
  }
);

router.post(
  '/admin/upload',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res, next) => {
    const canCatalog = await userHasEffectivePermission(
      req.user!,
      'catalog:write',
      req.effectivePermissions
    );
    const canCms = await userHasEffectivePermission(
      req.user!,
      'cms:write',
      req.effectivePermissions
    );
    const canAds = await userHasEffectivePermission(
      req.user!,
      'ads:write',
      req.effectivePermissions
    );
    if (!canCatalog && !canCms && !canAds) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        message: 'Required permission: catalog:write, cms:write, or ads:write',
      });
      return;
    }
    next();
  }),
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }

    const metaCheck = validateImageUploadMeta({
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      maxBytes: 6 * 1024 * 1024,
    });
    if (!metaCheck.valid) {
      res.status(400).json({ error: metaCheck.error });
      return;
    }

    const folder = z
      .enum([
        'products',
        'categories',
        'brands',
        'cms',
        'footer',
        'navigation',
        'promotions',
        'banners',
        'slideshows',
        'wishlist',
        'cart',
        'avatars',
      ])
      .catch('products')
      .parse(req.body?.folder);
    const alt = typeof req.body?.alt === 'string' ? req.body.alt.trim().slice(0, 160) : '';

    const asset = await uploadBufferToCloudinary(req.file.buffer, folder, alt);

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CLOUDINARY_UPLOAD',
      resourceType: 'MediaAsset',
      resourceId: asset.publicId,
      details: { folder, url: asset.url },
      ipAddress: req.ip,
    });

    res.status(201).json({ asset });
  })
);

// ADMIN: Homepage CMS Config
router.get(
  '/admin/homepage',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const { homepage } = await ensureDefaultCmsDocuments();
    res.json({ homepage });
  })
);

router.put(
  '/admin/homepage',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      announcementItems: z.array(z.object({ icon: z.string(), text: z.string().min(1) })).optional(),
      announcementPhone: z.string().max(40).optional(),
      heroSlides: z
        .array(
          z.object({
            badge: z.string().default(''),
            headlinePrefix: z.string().min(1),
            headlineHighlight: z.string().default(''),
            headlineSuffix: z.string().default(''),
            subtitle: z.string().default(''),
            ctaText: z.string().min(1),
            ctaLink: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v), 'Unsafe or invalid CTA URL'),
            imageUrl: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid desktop image URL'),
            imagePublicId: z.string().optional(),
            mobileImageUrl: z
              .string()
              .trim()
              .refine((v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid mobile image URL')
              .optional()
              .default(''),
            mobileImagePublicId: z.string().optional(),
            displayOrder: z.number().int().min(0).optional().default(0),
            isActive: z.boolean().default(true),
          })
        )
        .optional(),
      trustPoints: z
        .array(z.object({ title: z.string(), subtitle: z.string(), icon: z.string() }))
        .optional(),
      dualBanners: z
        .array(
          z.object({
            eyebrow: z.string().default(''),
            title: z.string().min(1),
            ctaText: z.string().min(1),
            ctaLink: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v), 'Unsafe or invalid banner URL'),
            imageUrl: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid banner image URL'),
            imagePublicId: z.string().optional(),
            theme: z.enum(['ice', 'blush']).default('ice'),
          })
        )
        .optional(),
      sections: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            enabled: z.boolean(),
            order: z.number().int(),
            title: z.string().trim().max(120).optional(),
            subtitle: z.string().trim().max(220).optional(),
            collectionType: z
              .enum([
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
              ])
              .optional(),
            productLimit: z.number().int().min(1).max(20).optional(),
            categorySlug: z.string().trim().max(100).optional(),
            ctaText: z.string().trim().max(50).optional(),
            ctaLink: z
              .string()
              .trim()
              .max(240)
              .refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Unsafe or invalid CTA URL')
              .optional(),
          })
        )
        .optional(),
      status: z.enum(['draft', 'published']).optional(),
    });

    const parsed = schema.parse(req.body);
    const { homepage } = await ensureDefaultCmsDocuments();

    Object.assign(homepage, parsed, { updatedBy: req.user!._id });
    await homepage.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_HOMEPAGE_CMS',
      resourceType: 'HomepageConfig',
      resourceId: String(homepage._id),
      details: { status: homepage.status },
      ipAddress: req.ip,
    });

    res.json({ homepage });
  })
);

// ADMIN: Promotional Ad Placements
router.get(
  '/admin/promotions',
  requireAuth,
  requirePermission('ads:write'),
  asyncHandler(async (_req, res) => {
    const promotions = await PromotionalPlacementModel.find().sort({ displayOrder: 1, updatedAt: -1 });
    res.json({ promotions });
  })
);

const promoSchema = z.object({
  title: z.string().trim().min(2).max(140),
  subtitle: z.string().trim().max(220).optional(),
  ctaText: z.string().trim().max(40).optional(),
  destinationUrl: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v), 'Unsafe or invalid URL'),
  altText: z.string().trim().min(2).max(180),
  imageUrl: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid banner image URL'),
  imagePublicId: z.string().optional(),
  placementSlot: z
    .enum([
      'homepage_mid_banner',
      'homepage_secondary_banner',
      'homepage_bottom_banner',
      'homepage_triple_banners',
      'homepage_sidebar',
      'top_strip',
      'wishlist_bottom_banner',
      'wishlist_sidebar',
      'product_sidebar',
    ])
    .default('homepage_mid_banner'),
  layoutStyle: z
    .enum(['dark_emerald_banner', 'clean_card', 'soft_sage_banner'])
    .default('dark_emerald_banner'),
  displayOrder: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('draft'),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

router.post(
  '/admin/promotions',
  requireAuth,
  requirePermission('ads:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = promoSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Promotion end date must be after start date.' });
      return;
    }
    const promotion = await PromotionalPlacementModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      updatedBy: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_PROMO_PLACEMENT',
      resourceType: 'PromotionalPlacement',
      resourceId: String(promotion._id),
      details: { title: promotion.title, isEnabled: promotion.isEnabled, status: promotion.status },
      ipAddress: req.ip,
    });

    res.status(201).json({ promotion });
  })
);

router.patch(
  '/admin/promotions/:id',
  requireAuth,
  requirePermission('ads:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid promotion ID.' });
      return;
    }
    const parsed = toPatchSchema(promoSchema).parse(req.body);
    const existing = await PromotionalPlacementModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Promotional placement not found' });
      return;
    }

    const nextStartsAt =
      parsed.startsAt !== undefined
        ? parsed.startsAt
          ? new Date(parsed.startsAt)
          : null
        : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined
        ? parsed.endsAt
          ? new Date(parsed.endsAt)
          : null
        : existing.endsAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Promotion end date must be after start date.' });
      return;
    }

    const oldPublicId = existing.imagePublicId;
    Object.assign(existing, {
      ...parsed,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      updatedBy: req.user!._id,
    });
    await existing.save();

    if (oldPublicId && parsed.imagePublicId && parsed.imagePublicId !== oldPublicId) {
      void destroyCloudinaryAssetIfUnused(oldPublicId);
    }

    res.json({ promotion: existing });
  })
);

router.delete(
  '/admin/promotions/:id',
  requireAuth,
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid promotion ID.' });
      return;
    }
    const deleted = await PromotionalPlacementModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Promotional placement not found' });
      return;
    }
    if (deleted.imagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.imagePublicId);
    }
    res.json({ ok: true });
  })
);

// ADMIN: Wishlist Hero Slideshow Management
const wishlistSlideSchema = z.object({
  title: z.string().trim().min(2).max(140),
  subtitle: z.string().trim().max(240).default(''),
  ctaText: z.string().trim().max(50).optional().default(''),
  ctaDestination: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Unsafe or invalid CTA URL'
    )
    .optional()
    .default(''),
  desktopImageUrl: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid desktop image URL'),
  desktopImagePublicId: z.string().trim().optional(),
  mobileImageUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid mobile image URL'
    )
    .optional()
    .default(''),
  mobileImagePublicId: z.string().trim().optional(),
  altText: z.string().trim().min(2).max(180).default('Wishlist hero slide'),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

router.get(
  '/admin/wishlist-slides',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const { homepage } = await ensureDefaultCmsDocuments();
    const slides = await WishlistHeroSlideModel.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({
      slides,
      sliderSettings: homepage.wishlistSliderSettings || {
        autoplay: true,
        transitionDurationMs: 5000,
      },
    });
  })
);

router.post(
  '/admin/wishlist-slides',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = wishlistSlideSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }
    const slide = await WishlistHeroSlideModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      updatedBy: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_WISHLIST_SLIDE',
      resourceType: 'WishlistHeroSlide',
      resourceId: String(slide._id),
      details: { title: slide.title, isActive: slide.isActive },
      ipAddress: req.ip,
    });

    res.status(201).json({ slide });
  })
);

router.put(
  '/admin/wishlist-slides/settings',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({
        autoplay: z.boolean(),
        transitionDurationMs: z.number().int().min(1500).max(20000),
      })
      .parse(req.body);

    const { homepage } = await ensureDefaultCmsDocuments();
    homepage.wishlistSliderSettings = parsed;
    homepage.updatedBy = req.user!._id;
    await homepage.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_WISHLIST_SLIDER_SETTINGS',
      resourceType: 'HomepageConfig',
      resourceId: String(homepage._id),
      details: parsed,
      ipAddress: req.ip,
    });

    res.json({ sliderSettings: homepage.wishlistSliderSettings });
  })
);

router.put(
  '/admin/wishlist-slides/reorder',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({
        orderedIds: z
          .array(
            z
              .string()
              .trim()
              .refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid slide ID')
          )
          .min(1)
          .max(100),
      })
      .parse(req.body);

    const uniqueIds = Array.from(new Set(parsed.orderedIds));
    await Promise.all(
      uniqueIds.map((id, idx) =>
        WishlistHeroSlideModel.findByIdAndUpdate(id, {
          displayOrder: idx,
          updatedBy: req.user!._id,
        })
      )
    );

    const slides = await WishlistHeroSlideModel.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    res.json({ slides });
  })
);

router.patch(
  '/admin/wishlist-slides/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slide ID.' });
      return;
    }
    const parsed = toPatchSchema(wishlistSlideSchema).parse(req.body);
    const existing = await WishlistHeroSlideModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Wishlist hero slide not found' });
      return;
    }

    const nextStartsAt =
      parsed.startsAt !== undefined
        ? parsed.startsAt
          ? new Date(parsed.startsAt)
          : null
        : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined
        ? parsed.endsAt
          ? new Date(parsed.endsAt)
          : null
        : existing.endsAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const oldDesktopPublicId = existing.desktopImagePublicId;
    const oldMobilePublicId = existing.mobileImagePublicId;

    Object.assign(existing, {
      ...parsed,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      updatedBy: req.user!._id,
    });
    await existing.save();

    if (
      oldDesktopPublicId &&
      parsed.desktopImagePublicId !== undefined &&
      parsed.desktopImagePublicId !== oldDesktopPublicId
    ) {
      void destroyCloudinaryAssetIfUnused(oldDesktopPublicId);
    }
    if (
      oldMobilePublicId &&
      parsed.mobileImagePublicId !== undefined &&
      parsed.mobileImagePublicId !== oldMobilePublicId
    ) {
      void destroyCloudinaryAssetIfUnused(oldMobilePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_WISHLIST_SLIDE',
      resourceType: 'WishlistHeroSlide',
      resourceId: String(existing._id),
      details: { title: existing.title, isActive: existing.isActive },
      ipAddress: req.ip,
    });

    res.json({ slide: existing });
  })
);

router.delete(
  '/admin/wishlist-slides/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slide ID.' });
      return;
    }
    const deleted = await WishlistHeroSlideModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Wishlist hero slide not found' });
      return;
    }
    if (deleted.desktopImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.desktopImagePublicId);
    }
    if (deleted.mobileImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.mobileImagePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_WISHLIST_SLIDE',
      resourceType: 'WishlistHeroSlide',
      resourceId: String(deleted._id),
      details: { title: deleted.title },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// ADMIN: Checkout Hero Banner Management
const checkoutBannerSchema = z.object({
  enabled: z.boolean().default(true),
  badgeText: z.string().trim().max(50).default('Secure Checkout'),
  heading: z.string().trim().min(1).max(100).default('Checkout'),
  subtitle: z.string().trim().max(220).default('Complete your order quickly and securely'),
  desktopImageUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid desktop image URL'
    )
    .optional()
    .default(''),
  desktopImagePublicId: z.string().trim().max(200).optional().default(''),
  mobileImageUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid mobile image URL'
    )
    .optional()
    .default(''),
  mobileImagePublicId: z.string().trim().max(200).optional().default(''),
  altText: z.string().trim().max(180).optional().default('Secure Checkout Banner'),
});

router.get(
  '/admin/checkout-banner',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const { homepage } = await ensureDefaultCmsDocuments();
    res.json({
      banner: homepage.checkoutBanner || {
        enabled: true,
        badgeText: 'Secure Checkout',
        heading: 'Checkout',
        subtitle: 'Complete your order quickly and securely',
        desktopImageUrl: '',
        desktopImagePublicId: '',
        mobileImageUrl: '',
        mobileImagePublicId: '',
        altText: 'Secure Checkout Banner',
      },
    });
  })
);

router.put(
  '/admin/checkout-banner',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = checkoutBannerSchema.parse(req.body);
    const { homepage } = await ensureDefaultCmsDocuments();
    const oldDesktopPublicId = homepage.checkoutBanner?.desktopImagePublicId;
    const oldMobilePublicId = homepage.checkoutBanner?.mobileImagePublicId;

    homepage.checkoutBanner = parsed;
    homepage.updatedBy = req.user!._id;
    await homepage.save();

    if (
      oldDesktopPublicId &&
      parsed.desktopImagePublicId !== oldDesktopPublicId
    ) {
      void destroyCloudinaryAssetIfUnused(oldDesktopPublicId);
    }
    if (
      oldMobilePublicId &&
      parsed.mobileImagePublicId !== oldMobilePublicId
    ) {
      void destroyCloudinaryAssetIfUnused(oldMobilePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_CHECKOUT_BANNER',
      resourceType: 'HomepageConfig',
      resourceId: String(homepage._id),
      details: { enabled: parsed.enabled, heading: parsed.heading },
      ipAddress: req.ip,
    });

    res.json({ banner: homepage.checkoutBanner });
  })
);

// ADMIN: Cart Hero Banner Management
const cartBannerSchema = z.object({
  badgeText: z.string().trim().max(60).optional().default('Your Shopping Cart'),
  heading: z.string().trim().min(1).max(120).default('Your Cart'),
  subtitle: z
    .string()
    .trim()
    .max(240)
    .optional()
    .default('Review your items and proceed to checkout'),
  ctaText: z.string().trim().max(50).optional().default('Continue Shopping'),
  ctaLink: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Unsafe or invalid CTA destination URL'
    )
    .optional()
    .default('/shop'),
  desktopImageUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid desktop image URL'
    )
    .optional()
    .default(''),
  desktopImagePublicId: z.string().trim().max(200).optional().default(''),
  mobileImageUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid mobile image URL'
    )
    .optional()
    .default(''),
  mobileImagePublicId: z.string().trim().max(200).optional().default(''),
  altText: z.string().trim().max(180).optional().default('Your Shopping Cart Banner'),
  imagePosition: z.enum(['right', 'background']).optional().default('right'),
  displayOrder: z.number().int().min(0).optional().default(0),
  isEnabled: z.boolean().optional().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

router.get(
  '/admin/cart-banners',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    await ensureDefaultCmsDocuments();
    const banners = await CartHeroBannerModel.find()
      .sort({ displayOrder: 1, updatedAt: -1 })
      .lean();
    res.json({ banners });
  })
);

router.post(
  '/admin/cart-banners',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = cartBannerSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const banner = await CartHeroBannerModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      updatedBy: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_CART_BANNER',
      resourceType: 'CartHeroBanner',
      resourceId: String(banner._id),
      details: { heading: banner.heading, isEnabled: banner.isEnabled, displayOrder: banner.displayOrder },
      ipAddress: req.ip,
    });

    res.status(201).json({ banner });
  })
);

router.patch(
  '/admin/cart-banners/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid banner ID.' });
      return;
    }
    const parsed = toPatchSchema(cartBannerSchema).parse(req.body);
    const existing = await CartHeroBannerModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Cart hero banner not found' });
      return;
    }

    const nextStartsAt =
      parsed.startsAt !== undefined
        ? parsed.startsAt
          ? new Date(parsed.startsAt)
          : null
        : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined
        ? parsed.endsAt
          ? new Date(parsed.endsAt)
          : null
        : existing.endsAt;

    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const oldDesktopPublicId = existing.desktopImagePublicId;
    const oldMobilePublicId = existing.mobileImagePublicId;

    Object.assign(existing, {
      ...parsed,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      updatedBy: req.user!._id,
    });
    await existing.save();

    if (
      oldDesktopPublicId &&
      parsed.desktopImagePublicId !== undefined &&
      parsed.desktopImagePublicId !== oldDesktopPublicId
    ) {
      void destroyCloudinaryAssetIfUnused(oldDesktopPublicId);
    }
    if (
      oldMobilePublicId &&
      parsed.mobileImagePublicId !== undefined &&
      parsed.mobileImagePublicId !== oldMobilePublicId
    ) {
      void destroyCloudinaryAssetIfUnused(oldMobilePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_CART_BANNER',
      resourceType: 'CartHeroBanner',
      resourceId: String(existing._id),
      details: { heading: existing.heading, isEnabled: existing.isEnabled, displayOrder: existing.displayOrder },
      ipAddress: req.ip,
    });

    res.json({ banner: existing });
  })
);

router.delete(
  '/admin/cart-banners/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid banner ID.' });
      return;
    }
    const deleted = await CartHeroBannerModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Cart hero banner not found' });
      return;
    }

    if (deleted.desktopImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.desktopImagePublicId);
    }
    if (deleted.mobileImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.mobileImagePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_CART_BANNER',
      resourceType: 'CartHeroBanner',
      resourceId: String(deleted._id),
      details: { heading: deleted.heading },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// ADMIN: Store Settings
router.get(
  '/admin/settings',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (_req, res) => {
    const { settings } = await ensureDefaultCmsDocuments();
    res.json({ settings });
  })
);

router.put(
  '/admin/settings',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      storeName: z.string().trim().min(2).max(100).optional(),
      tagline: z.string().trim().max(140).optional(),
      supportEmail: z.string().trim().email().or(z.literal('')).optional(),
      supportPhone: z.string().trim().max(30).optional(),
      businessAddress: z.string().trim().max(240).optional(),
        socialLinks: z
          .object({
            whatsapp: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
            messenger: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
            facebook: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
            instagram: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
            linkedin: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
            youtube: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
            tiktok: z.string().trim().refine((v) => isSafeDestinationUrl(v, { allowRelative: false, allowEmpty: true }), 'Invalid social URL').optional(),
          })
          .optional(),
        shipping: z
          .object({
            dhakaMetroCharge: z.number().min(0),
            dhakaSuburbCharge: z.number().min(0),
            outsideDhakaCharge: z.number().min(0),
            freeShippingThreshold: z.number().min(0),
            expressSurcharge: z.number().min(0),
          })
          .optional(),
        taxRate: z.number().min(0).max(30).optional(),
        taxSettings: z
          .object({
            enabled: z.boolean(),
            taxInclusive: z.boolean(),
            label: z.string().trim().min(1).max(30),
            applyToShipping: z.boolean(),
          })
          .optional(),
        headerSettings: z
          .object({
            logoUrl: z.string().trim().refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid logo URL').optional(),
            logoPublicId: z.string().trim().optional(),
            showSearch: z.boolean(),
            showWishlist: z.boolean(),
            showCart: z.boolean(),
            showAccount: z.boolean(),
            stickyHeader: z.boolean(),
            announcementBar: z.object({
              enabled: z.boolean(),
              text: z.string().trim().max(240),
              backgroundColor: z.string().trim().max(30),
              textColor: z.string().trim().max(30),
              linkUrl: z.string().trim().refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid link URL'),
              startsAt: z.string().datetime().nullable().optional(),
              endsAt: z.string().datetime().nullable().optional(),
            }),
          })
          .optional(),
        footerSettings: z
          .object({
            footerLogoUrl: z.string().trim().refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid logo URL').optional(),
            description: z.string().trim().max(600),
            copyrightText: z.string().trim().max(200),
            showPaymentLogos: z.boolean(),
          })
          .optional(),
        paymentMethods: z
          .array(
            z.object({
              key: z.enum(['cod', 'bkash', 'nagad', 'card', 'sslcommerz']),
              label: z.string().trim().min(1).max(60),
              enabled: z.boolean(),
              displayOrder: z.number().int().min(0),
              instructions: z.string().trim().max(300).default(''),
              mode: z.enum(['sandbox', 'live']).default('sandbox'),
            })
          )
          .optional(),
        emailSettings: z
          .object({
            senderName: z.string().trim().min(1).max(80),
            senderEmail: z.string().trim().email(),
            replyToEmail: z.string().trim().email().or(z.literal('')),
            orderConfirmationEnabled: z.boolean(),
            shipmentUpdateEnabled: z.boolean(),
            lowStockAlertEnabled: z.boolean(),
          })
          .optional(),
        notificationSettings: z
          .object({
            adminNewOrder: z.boolean(),
            adminLowStock: z.boolean(),
            adminReturnRequest: z.boolean(),
            customerOrderUpdates: z.boolean(),
            customerPromotions: z.boolean(),
            lowStockAlertEmail: z.string().trim().email().or(z.literal('')),
          })
          .optional(),
        securitySettings: z
          .object({
            sessionTimeoutMinutes: z.number().int().min(15).max(43200),
            maxLoginAttempts: z.number().int().min(3).max(30),
            lockoutMinutes: z.number().int().min(1).max(240),
            minPasswordLength: z.number().int().min(6).max(32),
            requireStrongPassword: z.boolean(),
            requireEmailVerification: z.boolean(),
          })
          .optional(),
        policies: z
          .object({
            returnPolicy: z.string(),
            shippingPolicy: z.string(),
            privacyPolicy: z.string(),
            termsAndConditions: z.string(),
            aboutUs: z.string(),
          })
          .optional(),
        seoDefaults: z
          .object({
            titleSuffix: z.string(),
            defaultDescription: z.string(),
            ogImageUrl: z.string().trim().refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid OG image URL').optional(),
            robotsTxt: z.string().trim().max(2000).optional(),
            sitemapEnabled: z.boolean().optional(),
          })
          .optional(),
        adsense: z
          .object({
            enabled: z.boolean(),
            publisherId: z.string().optional(),
            adSlotId: z.string().optional(),
          })
          .optional(),
      });

    const parsed = schema.parse(req.body);
    const { settings } = await ensureDefaultCmsDocuments();
    const prevHeaderLogoPublicId = settings.headerSettings?.logoPublicId;
    if (parsed.headerSettings?.announcementBar) {
      const ab = parsed.headerSettings.announcementBar;
      Object.assign(parsed.headerSettings, {
        announcementBar: {
          ...ab,
          startsAt: ab.startsAt ? new Date(ab.startsAt) : null,
          endsAt: ab.endsAt ? new Date(ab.endsAt) : null,
        },
      });
    }
    Object.assign(settings, parsed);
    await settings.save();
    invalidateFooterCache();
    if (
      prevHeaderLogoPublicId &&
      prevHeaderLogoPublicId !== settings.headerSettings?.logoPublicId
    ) {
      void destroyCloudinaryAssetIfUnused(prevHeaderLogoPublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_STORE_SETTINGS',
      resourceType: 'StoreSettings',
      resourceId: String(settings._id),
      ipAddress: req.ip,
    });

    res.json({ settings });
  })
);

router.post(
  '/admin/settings/test-email',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const email = z.string().trim().email().parse(req.body?.email || req.user!.email);
    const result = await sendTransactionalEmail({
      userId: String(req.user!._id),
      email,
      type: 'marketing',
      subject: 'NOVARA COMMERCE — SMTP / Resend Configuration Test',
      html: '<p>Your transactional email integration is reachable from NOVARA COMMERCE Admin.</p>',
    });
    res.json({
      ok: result.status === 'sent',
      status: result.status,
      configured: env.resend.isConfigured,
      message:
        result.status === 'sent'
          ? `Test email dispatched to ${email}.`
          : 'RESEND_API_KEY is not configured in .env; logged as skipped_unconfigured.',
    });
  })
);

// ADMIN: Navigation Menu Items CRUD
const navItemSchema = z.object({
  label: z.string().trim().min(1).max(60),
  url: z.string().trim().min(1).max(300).refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid URL'),
  parentId: z.string().nullable().optional(),
  location: z.enum(['header', 'footer']).default('header'),
  displayOrder: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  openInNewTab: z.boolean().default(false),
});

router.get(
  '/admin/navigation',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const items = await NavigationMenuItemModel.find().sort({ location: 1, displayOrder: 1, createdAt: 1 }).lean();
    res.json({ items });
  })
);

router.post(
  '/admin/navigation',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = navItemSchema.parse(req.body);
    const item = await NavigationMenuItemModel.create({
      ...parsed,
      parentId: parsed.parentId || null,
    });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_NAV_ITEM',
      resourceType: 'NavigationMenuItem',
      resourceId: String(item._id),
      details: { label: item.label, location: item.location },
      ipAddress: req.ip,
    });
    res.status(201).json({ item });
  })
);

router.patch(
  '/admin/navigation/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu item ID.' });
      return;
    }
    const parsed = toPatchSchema(navItemSchema).parse(req.body);
    const updated = await NavigationMenuItemModel.findByIdAndUpdate(
      req.params.id,
      { ...parsed, ...(parsed.parentId === '' ? { parentId: null } : {}) },
      { new: true, runValidators: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }
    res.json({ item: updated });
  })
);

router.delete(
  '/admin/navigation/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu item ID.' });
      return;
    }
    await NavigationMenuItemModel.updateMany({ parentId: req.params.id }, { $set: { parentId: null } });
    const deleted = await NavigationMenuItemModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ADMIN: Static Pages CRUD
const staticPageSchema = z.object({
  title: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(150).toLowerCase(),
  content: z.string().trim().min(10).max(30000),
  pageType: z.enum(['policy', 'custom']).default('custom'),
  seoTitle: z.string().trim().max(140).optional(),
  seoDescription: z.string().trim().max(260).optional(),
  isPublished: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
});

router.get(
  '/admin/pages',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const pages = await StaticPageModel.find().sort({ updatedAt: -1 }).lean();
    res.json({ pages });
  })
);

router.post(
  '/admin/pages',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = staticPageSchema.parse(req.body);
    const page = await StaticPageModel.create(parsed);
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_STATIC_PAGE',
      resourceType: 'StaticPage',
      resourceId: String(page._id),
      details: { slug: page.slug },
      ipAddress: req.ip,
    });
    res.status(201).json({ page });
  })
);

router.patch(
  '/admin/pages/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid page ID.' });
      return;
    }
    const parsed = toPatchSchema(staticPageSchema).parse(req.body);
    const page = await StaticPageModel.findByIdAndUpdate(req.params.id, parsed, {
      new: true,
      runValidators: true,
    });
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json({ page });
  })
);

router.delete(
  '/admin/pages/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid page ID.' });
      return;
    }
    const deleted = await StaticPageModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ADMIN: FAQs CRUD
const faqSchema = z.object({
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(4000),
  category: z.string().trim().min(1).max(60).default('General'),
  displayOrder: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

router.get(
  '/admin/faqs',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const faqs = await FaqItemModel.find().sort({ displayOrder: 1, createdAt: 1 }).lean();
    res.json({ faqs });
  })
);

router.post(
  '/admin/faqs',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    const parsed = faqSchema.parse(req.body);
    const faq = await FaqItemModel.create(parsed);
    res.status(201).json({ faq });
  })
);

router.patch(
  '/admin/faqs/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid FAQ ID.' });
      return;
    }
    const parsed = toPatchSchema(faqSchema).parse(req.body);
    const faq = await FaqItemModel.findByIdAndUpdate(req.params.id, parsed, {
      new: true,
      runValidators: true,
    });
    if (!faq) {
      res.status(404).json({ error: 'FAQ not found' });
      return;
    }
    res.json({ faq });
  })
);

router.delete(
  '/admin/faqs/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid FAQ ID.' });
      return;
    }
    const deleted = await FaqItemModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'FAQ not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ADMIN: Blog Posts CRUD
const blogPostSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(2).max(180).toLowerCase(),
  excerpt: z.string().trim().max(400).optional().default(''),
  content: z.string().trim().min(10).max(40000),
  category: z.string().trim().min(1).max(60).default('Guides'),
  featuredImageUrl: z
    .string()
    .trim()
    .refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid image URL')
    .optional()
    .default(''),
  featuredImagePublicId: z.string().trim().optional().default(''),
  authorName: z.string().trim().min(2).max(80).default('NOVARA Editorial'),
  seoTitle: z.string().trim().max(140).optional(),
  seoDescription: z.string().trim().max(260).optional(),
  status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  publishedAt: z.string().datetime().nullable().optional(),
});

router.get(
  '/admin/blog',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const posts = await BlogPostModel.find().sort({ createdAt: -1 }).lean();
    res.json({ posts });
  })
);

router.post(
  '/admin/blog',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = blogPostSchema.parse(req.body);
    const post = await BlogPostModel.create({
      ...parsed,
      publishedAt:
        parsed.publishedAt
          ? new Date(parsed.publishedAt)
          : parsed.status === 'published'
          ? new Date()
          : null,
    });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_BLOG_POST',
      resourceType: 'BlogPost',
      resourceId: String(post._id),
      details: { slug: post.slug, status: post.status },
      ipAddress: req.ip,
    });
    res.status(201).json({ post });
  })
);

router.patch(
  '/admin/blog/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid blog post ID.' });
      return;
    }
    const parsed = toPatchSchema(blogPostSchema).parse(req.body);
    const existing = await BlogPostModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    const prevImageId = existing.featuredImagePublicId;
    Object.assign(existing, {
      ...parsed,
      publishedAt:
        parsed.publishedAt !== undefined
          ? parsed.publishedAt
            ? new Date(parsed.publishedAt)
            : null
          : parsed.status === 'published' && !existing.publishedAt
          ? new Date()
          : existing.publishedAt,
    });
    await existing.save();
    if (prevImageId && prevImageId !== existing.featuredImagePublicId) {
      void destroyCloudinaryAssetIfUnused(prevImageId);
    }
    res.json({ post: existing });
  })
);

router.delete(
  '/admin/blog/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid blog post ID.' });
      return;
    }
    const deleted = await BlogPostModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    if (deleted.featuredImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.featuredImagePublicId);
    }
    res.json({ ok: true });
  })
);

// PUBLIC & ADMIN: Dynamic Banner Creator & Storefront Banner Engine
const allowedPositions = BANNER_POSITION_OPTIONS.map((p) => p.value) as [string, ...string[]];

const bannerValidationSchema = z.object({
  name: z.string().trim().min(2).max(140),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '21:9', 'custom']).default('16:9'),
  customAspectWidth: z.number().int().min(1).max(40).default(16),
  customAspectHeight: z.number().int().min(1).max(40).default(9),
  bannerSize: z
    .enum(['full_width', 'container_width', 'large', 'medium', 'small', 'custom'])
    .default('full_width'),
  position: z.enum(allowedPositions).default('homepage_top_slider'),
  displayOrder: z.number().int().min(0).max(10000).default(1),
  priority: z.number().int().min(0).max(1000).default(10),
  isActive: z.boolean().default(true),
  status: z.enum(['draft', 'published']).default('published'),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),

  badgeText: z.string().trim().max(80).optional().default(''),
  mainHeading: z.string().trim().min(2).max(100),
  highlightText: z.string().trim().max(60).optional().default(''),
  subHeading: z.string().trim().max(160).optional().default(''),
  buttonText: z.string().trim().max(30).optional().default('Shop Now'),
  buttonLink: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Unsafe or invalid CTA URL'
    )
    .optional()
    .default('/shop'),
  altText: z.string().trim().max(180).optional().default('Promotional storefront banner'),
  fontFamily: z
    .enum(['Plus Jakarta Sans', 'Poppins', 'Outfit', 'DM Sans', 'Manrope', 'Playfair Display'])
    .default('Poppins'),
  fontWeight: z.enum(['400', '500', '600', '700', '800']).default('700'),
  textAlignment: z.enum(['left', 'center', 'right']).default('left'),
  letterSpacingPx: z.number().min(-4).max(12).default(0),
  textColor: z.string().trim().max(20).default('#FFFFFF'),
  highlightColor: z.string().trim().max(20).default('#A3E635'),
  buttonBgColor: z.string().trim().max(20).default('#A3E635'),
  buttonTextColor: z.string().trim().max(20).default('#0F172A'),

  backgroundType: z.enum(['solid', 'gradient', 'image', 'overlay']).default('gradient'),
  solidColor: z.string().trim().max(20).default('#15803D'),
  gradientStart: z.string().trim().max(20).default('#06381C'),
  gradientEnd: z.string().trim().max(20).default('#22C55E'),
  gradientDirection: z
    .enum(['to right', 'to bottom right', 'to bottom', 'to top right', '135deg', '90deg', '180deg'])
    .default('135deg'),
  backgroundOpacity: z.number().min(0).max(100).default(100),
  desktopImageUrl: z
    .string()
    .trim()
    .max(600)
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid desktop image URL'
    )
    .optional()
    .default(''),
  desktopImagePublicId: z.string().trim().max(200).optional().default(''),
  mobileImageUrl: z
    .string()
    .trim()
    .max(600)
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Invalid mobile image URL'
    )
    .optional()
    .default(''),
  mobileImagePublicId: z.string().trim().max(200).optional().default(''),

  productSelectionMode: z
    .enum(['none', 'featured', 'best_sellers', 'latest', 'custom'])
    .default('none'),
  selectedProductIds: z
    .array(
      z
        .string()
        .trim()
        .refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid product ID')
    )
    .max(12)
    .optional()
    .default([]),
  targetCategorySlugs: z.array(z.string().trim().max(100).toLowerCase()).max(30).optional().default([]),
  targetCustomPageSlugs: z.array(z.string().trim().max(140).toLowerCase()).max(30).optional().default([]),

  animationEffect: z.enum(['fade', 'slide_up', 'slide_left', 'zoom', 'none']).default('fade'),
  animationSpeed: z.enum(['fast', 'normal', 'slow']).default('normal'),
  autoPlay: z.boolean().default(true),
  loop: z.boolean().default(true),
  animationDelaySec: z.number().min(1).max(30).default(3),

  bannerWidthPx: z.number().int().min(200).max(3840).default(1920),
  bannerHeightPx: z.number().int().min(80).max(1400).default(460),
  paddingPx: z.number().int().min(0).max(120).default(36),
  borderRadiusPx: z.number().int().min(0).max(64).default(20),
  boxShadow: z.boolean().default(true),

  overlayEnabled: z.boolean().default(true),
  overlayColor: z.string().trim().max(20).default('#052E16'),
  overlayOpacity: z.number().min(0).max(95).default(35),
  patternEnabled: z.boolean().default(false),
  patternType: z.enum(['dots', 'grid', 'diagonal']).default('dots'),
  blurEnabled: z.boolean().default(false),
  blurPx: z.number().int().min(0).max(32).default(6),
  customCss: z.string().max(2000).optional().default(''),
});

function sanitizeBannerFields<T extends Partial<z.infer<typeof bannerValidationSchema>>>(input: T): T {
  const sanitized = { ...input };
  if (sanitized.textColor !== undefined) {
    sanitized.textColor = normalizeHexColor(sanitized.textColor, '#FFFFFF');
  }
  if (sanitized.highlightColor !== undefined) {
    sanitized.highlightColor = normalizeHexColor(sanitized.highlightColor, '#A3E635');
  }
  if (sanitized.buttonBgColor !== undefined) {
    sanitized.buttonBgColor = normalizeHexColor(sanitized.buttonBgColor, '#A3E635');
  }
  if (sanitized.buttonTextColor !== undefined) {
    sanitized.buttonTextColor = normalizeHexColor(sanitized.buttonTextColor, '#0F172A');
  }
  if (sanitized.solidColor !== undefined) {
    sanitized.solidColor = normalizeHexColor(sanitized.solidColor, '#15803D');
  }
  if (sanitized.gradientStart !== undefined) {
    sanitized.gradientStart = normalizeHexColor(sanitized.gradientStart, '#06381C');
  }
  if (sanitized.gradientEnd !== undefined) {
    sanitized.gradientEnd = normalizeHexColor(sanitized.gradientEnd, '#22C55E');
  }
  if (sanitized.overlayColor !== undefined) {
    sanitized.overlayColor = normalizeHexColor(sanitized.overlayColor, '#052E16');
  }
  if (sanitized.customCss !== undefined) {
    sanitized.customCss = sanitizeCustomCss(sanitized.customCss).sanitizedCssText;
  }
  return sanitized;
}

const PUBLIC_PRODUCT_SELECT = 'name slug basePrice salePrice flashSalePrice flashSaleStart flashSaleEnd images ratingAverage ratingCount isFeatured isBestSeller isNewArrival status';

async function attachResolvedProductsToBanners<
  T extends {
    productSelectionMode?: string;
    selectedProductIds?: unknown[];
  },
>(banners: T[]): Promise<Array<T & { resolvedProducts?: unknown[] }>> {
  const modesNeeded = new Set(
    banners
      .map((b) => b.productSelectionMode)
      .filter((m): m is string => Boolean(m && m !== 'none'))
  );
  if (modesNeeded.size === 0) {
    return banners;
  }

  const [featuredProducts, bestSellerProducts, latestProducts] = await Promise.all([
    modesNeeded.has('featured')
      ? ProductModel.find({ status: 'published', isFeatured: true })
          .select(PUBLIC_PRODUCT_SELECT)
          .sort({ salesCount: -1, createdAt: -1 })
          .limit(4)
          .lean()
      : Promise.resolve([]),
    modesNeeded.has('best_sellers')
      ? ProductModel.find({ status: 'published' })
          .select(PUBLIC_PRODUCT_SELECT)
          .sort({ salesCount: -1, ratingAverage: -1 })
          .limit(4)
          .lean()
      : Promise.resolve([]),
    modesNeeded.has('latest')
      ? ProductModel.find({ status: 'published' })
          .select(PUBLIC_PRODUCT_SELECT)
          .sort({ createdAt: -1 })
          .limit(4)
          .lean()
      : Promise.resolve([]),
  ]);

  const customIds = Array.from(
    new Set(
      banners
        .filter((b) => b.productSelectionMode === 'custom' && Array.isArray(b.selectedProductIds))
        .flatMap((b) => (b.selectedProductIds || []).map(String))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  const customProducts =
    customIds.length > 0
      ? await ProductModel.find({ _id: { $in: customIds }, status: 'published' })
          .select(PUBLIC_PRODUCT_SELECT)
          .lean()
      : [];
  const customProductMap = new Map(customProducts.map((p) => [String(p._id), p]));

  return banners.map((banner) => {
    if (banner.productSelectionMode === 'featured') {
      return { ...banner, resolvedProducts: featuredProducts };
    }
    if (banner.productSelectionMode === 'best_sellers') {
      return { ...banner, resolvedProducts: bestSellerProducts };
    }
    if (banner.productSelectionMode === 'latest') {
      return { ...banner, resolvedProducts: latestProducts };
    }
    if (banner.productSelectionMode === 'custom') {
      const matched = (banner.selectedProductIds || [])
        .map((id) => customProductMap.get(String(id)))
        .filter(Boolean)
        .slice(0, 4);
      return { ...banner, resolvedProducts: matched };
    }
    return { ...banner, resolvedProducts: [] };
  });
}

router.get(
  '/public/banners',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const position = typeof req.query.position === 'string' ? req.query.position.trim() : '';
    const positionsParam = typeof req.query.positions === 'string' ? req.query.positions.trim() : '';
    const categorySlug =
      typeof req.query.categorySlug === 'string' ? req.query.categorySlug.trim().toLowerCase() : '';
    const pageSlug =
      typeof req.query.pageSlug === 'string' ? req.query.pageSlug.trim().toLowerCase() : '';
    const includeProducts = req.query.includeProducts !== 'false';

    const queryFilter: Record<string, unknown> = {
      isActive: true,
      status: 'published',
    };

    if (position) {
      queryFilter.position = position;
    } else if (positionsParam) {
      const positionList = positionsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (positionList.length > 0) {
        queryFilter.position = { $in: positionList };
      }
    }

    const candidates = await BannerModel.find(queryFilter)
      .sort({ displayOrder: 1, priority: -1, updatedAt: -1 })
      .lean();

    const filtered = filterAndSortActiveBanners(candidates, {
      position: position || undefined,
      categorySlug: categorySlug || undefined,
      pageSlug: pageSlug || undefined,
      now: new Date(),
    });

    const enriched = includeProducts
      ? await attachResolvedProductsToBanners(filtered)
      : filtered;

    res.json({ banners: enriched });
  })
);

router.get(
  '/admin/banners',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const position = typeof req.query.position === 'string' ? req.query.position.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const activeFilter = typeof req.query.active === 'string' ? req.query.active.trim() : '';

    const query: Record<string, unknown> = {};
    if (position && position !== 'all') query.position = position;
    if (status === 'draft' || status === 'published') query.status = status;
    if (activeFilter === 'true') query.isActive = true;
    if (activeFilter === 'false') query.isActive = false;

    const rawBanners = await BannerModel.find(query)
      .sort({ displayOrder: 1, priority: -1, updatedAt: -1 })
      .lean();

    const banners = search
      ? rawBanners.filter(
          (b) =>
            b.name?.toLowerCase().includes(search) ||
            b.mainHeading?.toLowerCase().includes(search) ||
            b.position?.toLowerCase().includes(search)
        )
      : rawBanners;

    res.json({ banners });
  })
);

router.put(
  '/admin/banners/reorder',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .union([
        z.object({
          orderedIds: z
            .array(
              z
                .string()
                .trim()
                .refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid banner ID')
            )
            .min(1)
            .max(200),
        }),
        z.object({
          items: z
            .array(
              z.object({
                id: z
                  .string()
                  .trim()
                  .refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid banner ID'),
                displayOrder: z.number().int().min(0).max(10000),
              })
            )
            .min(1)
            .max(200),
        }),
      ])
      .parse(req.body);

    const updates: Array<{ id: string; displayOrder: number }> =
      'orderedIds' in parsed
        ? Array.from(new Set(parsed.orderedIds)).map((id, idx) => ({
            id,
            displayOrder: idx + 1,
          }))
        : parsed.items;

    await Promise.all(
      updates.map((entry) =>
        BannerModel.findByIdAndUpdate(entry.id, {
          displayOrder: entry.displayOrder,
          updatedBy: req.user!._id,
        })
      )
    );

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'REORDER_BANNERS',
      resourceType: 'Banner',
      details: { count: updates.length },
      ipAddress: req.ip,
    });

    const banners = await BannerModel.find()
      .sort({ displayOrder: 1, priority: -1, updatedAt: -1 })
      .lean();
    res.json({ banners });
  })
);

router.get(
  '/admin/banners/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid banner ID.' });
      return;
    }
    const banner = await BannerModel.findById(req.params.id).lean();
    if (!banner) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    res.json({ banner });
  })
);

router.post(
  '/admin/banners',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = bannerValidationSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }
    const cleaned = sanitizeBannerFields(parsed);
    const banner = await BannerModel.create({
      ...cleaned,
      startsAt: cleaned.startsAt ? new Date(cleaned.startsAt) : null,
      endsAt: cleaned.endsAt ? new Date(cleaned.endsAt) : null,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_BANNER',
      resourceType: 'Banner',
      resourceId: String(banner._id),
      details: {
        name: banner.name,
        position: banner.position,
        isActive: banner.isActive,
        status: banner.status,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({ banner });
  })
);

router.patch(
  '/admin/banners/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid banner ID.' });
      return;
    }
    const parsed = toPatchSchema(bannerValidationSchema).parse(req.body);
    const existing = await BannerModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }

    const nextStartsAt =
      parsed.startsAt !== undefined
        ? parsed.startsAt
          ? new Date(parsed.startsAt)
          : null
        : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined
        ? parsed.endsAt
          ? new Date(parsed.endsAt)
          : null
        : existing.endsAt;

    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const prevDesktopPublicId = existing.desktopImagePublicId;
    const prevMobilePublicId = existing.mobileImagePublicId;
    const cleaned = sanitizeBannerFields(parsed);

    Object.assign(existing, {
      ...cleaned,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      updatedBy: req.user!._id,
    });
    await existing.save();

    if (
      prevDesktopPublicId &&
      cleaned.desktopImagePublicId !== undefined &&
      cleaned.desktopImagePublicId !== prevDesktopPublicId
    ) {
      void destroyCloudinaryAssetIfUnused(prevDesktopPublicId);
    }
    if (
      prevMobilePublicId &&
      cleaned.mobileImagePublicId !== undefined &&
      cleaned.mobileImagePublicId !== prevMobilePublicId
    ) {
      void destroyCloudinaryAssetIfUnused(prevMobilePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_BANNER',
      resourceType: 'Banner',
      resourceId: String(existing._id),
      details: {
        name: existing.name,
        position: existing.position,
        isActive: existing.isActive,
        status: existing.status,
      },
      ipAddress: req.ip,
    });

    res.json({ banner: existing });
  })
);

router.post(
  '/admin/banners/:id/duplicate',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid banner ID.' });
      return;
    }
    const existing = await BannerModel.findById(req.params.id).lean();
    if (!existing) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }

    const { _id: _omitId, createdAt: _omitCreated, updatedAt: _omitUpdated, ...rest } = existing;
    const duplicate = await BannerModel.create({
      ...rest,
      name: `${existing.name} (Copy)`.slice(0, 140),
      isActive: false,
      status: 'draft',
      displayOrder: (existing.displayOrder ?? 0) + 1,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DUPLICATE_BANNER',
      resourceType: 'Banner',
      resourceId: String(duplicate._id),
      details: { sourceBannerId: req.params.id },
      ipAddress: req.ip,
    });

    res.status(201).json({ banner: duplicate });
  })
);

router.delete(
  '/admin/banners/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid banner ID.' });
      return;
    }
    const deleted = await BannerModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }

    if (deleted.desktopImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.desktopImagePublicId);
    }
    if (deleted.mobileImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.mobileImagePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_BANNER',
      resourceType: 'Banner',
      resourceId: req.params.id,
      details: { name: deleted.name, position: deleted.position },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

router.use('/admin/slideshows', adminSlideshowRouter);
router.use('/public/slideshows', publicSlideshowRouter);

export default router;

