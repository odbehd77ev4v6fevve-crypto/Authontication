import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { normalizeHexColor } from '../../../../shared/bannerHelpers.ts';
import { isSafeDestinationUrl } from '../../../../shared/security.ts';
import {
  SLIDESHOW_PLACEMENT_META,
  SLIDESHOW_PLACEMENTS,
  createDefaultSlideForPlacement,
  filterAndSortActiveSlides,
  isSlideScheduleValid,
  reorderSlidesById,
  type SlideshowPlacement,
} from '../../../../shared/slideshowHelpers.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { destroyCloudinaryAssetIfUnused } from '../../services/cloudinary.service.ts';
import { toPatchSchema } from '../../utils/zodPartial.ts';
import { SlideshowModel, type ISlideshow, type ISlideshowSlide } from './cms.model.ts';

const safeUrlSchema = (max = 300) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
      'Unsafe or invalid URL'
    );

const requiredImageUrlSchema = z
  .string()
  .trim()
  .min(1, 'Desktop background image is required')
  .max(600)
  .refine(
    (v) => isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: false }),
    'Invalid desktop background image URL'
  );

const placementEnum = z.enum(['homepage', 'cart', 'wishlist', 'checkout']);
const transitionEnum = z.enum([
  'fade',
  'slide',
  'zoom',
  'zoom_in',
  'zoom_out',
  'ken_burns',
  'none',
]);

export const slideValidationSchema = z.object({
  internalName: z.string().trim().max(140).optional().default('Campaign Slide'),
  badgeText: z.string().trim().max(80).optional().default(''),
  mainHeading: z.string().trim().min(2).max(120),
  highlightText: z.string().trim().max(60).optional().default(''),
  subtitle: z.string().trim().max(200).optional().default(''),
  description: z.string().trim().max(400).optional().default(''),

  primaryButtonText: z.string().trim().max(40).optional().default(''),
  primaryButtonUrl: safeUrlSchema(300).optional().default(''),
  primaryButtonNewTab: z.boolean().optional().default(false),

  secondaryButtonText: z.string().trim().max(40).optional().default(''),
  secondaryButtonUrl: safeUrlSchema(300).optional().default(''),
  secondaryButtonNewTab: z.boolean().optional().default(false),

  destinationUrl: safeUrlSchema(300).optional().default(''),
  destinationNewTab: z.boolean().optional().default(false),

  desktopImageUrl: requiredImageUrlSchema,
  desktopImagePublicId: z.string().trim().max(200).optional().default(''),
  mobileImageUrl: safeUrlSchema(600).optional().default(''),
  mobileImagePublicId: z.string().trim().max(200).optional().default(''),
  altText: z.string().trim().max(180).optional().default('Promotional slideshow image'),
  imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional().default('center'),

  horizontalAlign: z.enum(['left', 'center', 'right']).optional().default('left'),
  verticalAlign: z.enum(['top', 'center', 'bottom']).optional().default('center'),
  contentMaxWidthPx: z.number().min(260).max(1400).optional().default(620),
  paddingPx: z.number().min(12).max(120).optional().default(40),

  fontFamily: z
    .enum(['Plus Jakarta Sans', 'Poppins', 'Outfit', 'DM Sans', 'Manrope', 'Playfair Display'])
    .optional()
    .default('Poppins'),
  fontWeight: z.enum(['400', '500', '600', '700', '800']).optional().default('700'),
  headingSizePx: z.number().min(16).max(76).optional().default(44),
  subtitleSizePx: z.number().min(12).max(36).optional().default(17),
  lineHeight: z.number().min(0.9).max(2.2).optional().default(1.15),
  letterSpacingPx: z.number().min(-4).max(12).optional().default(0),
  textColor: z.string().trim().max(20).optional().default('#FFFFFF'),
  highlightColor: z.string().trim().max(20).optional().default('#A3E635'),
  primaryBtnBg: z.string().trim().max(20).optional().default('#A3E635'),
  primaryBtnText: z.string().trim().max(20).optional().default('#0F172A'),
  secondaryBtnBg: z.string().trim().max(20).optional().default('#FFFFFF'),
  secondaryBtnText: z.string().trim().max(20).optional().default('#FFFFFF'),

  overlayType: z.enum(['solid', 'gradient']).optional().default('gradient'),
  overlayColor: z.string().trim().max(20).optional().default('#052E16'),
  overlayOpacity: z.number().min(0).max(95).optional().default(52),
  gradientStart: z.string().trim().max(20).optional().default('#041E11'),
  gradientEnd: z.string().trim().max(20).optional().default('#06381C'),
  gradientStartOpacity: z.number().min(0).max(95).optional().default(80),
  gradientEndOpacity: z.number().min(0).max(95).optional().default(28),
  gradientDirection: z
    .enum(['to right', 'to left', 'to bottom', 'to top', '135deg', '45deg'])
    .optional()
    .default('to right'),
  blurPx: z.number().min(0).max(24).optional().default(0),

  animationEffect: transitionEnum.optional().default('fade'),
  animationDurationMs: z.number().min(150).max(3000).optional().default(600),
  animationDelayMs: z.number().min(0).max(5000).optional().default(0),

  displayOrder: z.number().int().min(0).max(10000).optional().default(0),
  status: z.enum(['draft', 'published', 'scheduled', 'inactive']).optional().default('published'),
  isActive: z.boolean().optional().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const slideshowValidationSchema = z.object({
  name: z.string().trim().min(2).max(140),
  placement: placementEnum,
  targetPage: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional().default(true),
  autoplay: z.boolean().optional().default(true),
  infiniteLoop: z.boolean().optional().default(true),
  pauseOnHover: z.boolean().optional().default(true),
  animationSpeed: z.enum(['fast', 'normal', 'slow']).optional().default('normal'),
  transitionEffect: transitionEnum.optional().default('fade'),
  transitionDurationMs: z.number().int().min(150).max(3000).optional().default(600),
  autoplayIntervalMs: z.number().int().min(1500).max(15000).optional().default(5000),
  indicatorStyle: z
    .enum(['dots', 'progress', 'numbers', 'thumbnails', 'none'])
    .optional()
    .default('dots'),
  showIndicators: z.boolean().optional().default(true),
  showArrows: z.boolean().optional().default(true),
  desktopHeightPx: z.number().int().min(120).max(900).optional().default(480),
  tabletHeightPx: z.number().int().min(120).max(800).optional().default(380),
  mobileHeightPx: z.number().int().min(110).max(700).optional().default(300),
  borderRadiusPx: z.number().int().min(0).max(48).optional().default(20),
  compactMode: z.boolean().optional().default(false),
  slides: z.array(slideValidationSchema).max(50).optional(),
});

function sanitizeSlideColors<T extends Record<string, unknown>>(input: T): T {
  const out = { ...input } as Record<string, unknown>;
  if (typeof out.textColor === 'string') {
    out.textColor = normalizeHexColor(out.textColor, '#FFFFFF');
  }
  if (typeof out.highlightColor === 'string') {
    out.highlightColor = normalizeHexColor(out.highlightColor, '#A3E635');
  }
  if (typeof out.primaryBtnBg === 'string') {
    out.primaryBtnBg = normalizeHexColor(out.primaryBtnBg, '#A3E635');
  }
  if (typeof out.primaryBtnText === 'string') {
    out.primaryBtnText = normalizeHexColor(out.primaryBtnText, '#0F172A');
  }
  if (typeof out.secondaryBtnBg === 'string') {
    out.secondaryBtnBg = normalizeHexColor(out.secondaryBtnBg, '#FFFFFF');
  }
  if (typeof out.secondaryBtnText === 'string') {
    out.secondaryBtnText = normalizeHexColor(out.secondaryBtnText, '#FFFFFF');
  }
  if (typeof out.overlayColor === 'string') {
    out.overlayColor = normalizeHexColor(out.overlayColor, '#052E16');
  }
  if (typeof out.gradientStart === 'string') {
    out.gradientStart = normalizeHexColor(out.gradientStart, '#041E11');
  }
  if (typeof out.gradientEnd === 'string') {
    out.gradientEnd = normalizeHexColor(out.gradientEnd, '#06381C');
  }
  return out as T;
}

function buildSeededSlides(placement: SlideshowPlacement) {
  if (placement === 'homepage') {
    return [
      {
        ...createDefaultSlideForPlacement('homepage', 0),
        internalName: 'Smart Shopping Emerald Hero',
        badgeText: 'Big Savings, Big Happiness',
        mainHeading: 'Smart Shopping Bigger Savings!',
        highlightText: 'Bigger',
        subtitle: 'Up to 60% Off on Electronics, Fashion & Daily Essentials Across Bangladesh',
        primaryButtonText: 'Shop Now',
        primaryButtonUrl: '/shop',
        secondaryButtonText: 'View Flash Deals',
        secondaryButtonUrl: '/deals',
        destinationUrl: '/shop',
        desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
        imagePosition: 'top',
        altText: 'Smart shopping bags campaign hero',
      },
      {
        ...createDefaultSlideForPlacement('homepage', 1),
        internalName: 'Official Electronics Tech Showcase',
        badgeText: 'Official Warranty Included',
        mainHeading: 'Upgrade Your Everyday Tech Setup',
        highlightText: 'Tech Setup',
        subtitle: 'Authentic laptops, smartphones & studio audio delivered nationwide with Cash on Delivery.',
        primaryButtonText: 'Explore Electronics',
        primaryButtonUrl: '/category/electronics',
        secondaryButtonText: '',
        secondaryButtonUrl: '',
        destinationUrl: '/category/electronics',
        desktopImageUrl: '/src/assets/images/promo_tech_laptops_1795621230990.jpg',
        imagePosition: 'center',
        altText: 'Electronics tech showcase hero',
        gradientStart: '#031A10',
        gradientEnd: '#0F172A',
      },
    ];
  }

  if (placement === 'wishlist') {
    return [
      {
        ...createDefaultSlideForPlacement('wishlist', 0),
        internalName: 'Wishlist Favorites Spotlight',
        badgeText: 'Saved Favorites',
        mainHeading: 'My Curated Wishlist Collection',
        highlightText: 'Wishlist',
        subtitle: 'Track flash price drops and limited-stock items in one organized place.',
        primaryButtonText: 'Explore Deals',
        primaryButtonUrl: '/deals',
        destinationUrl: '/deals',
        desktopImageUrl: '/src/assets/images/promo_fashion_bundle_1795621230765.jpg',
      },
      {
        ...createDefaultSlideForPlacement('wishlist', 1),
        internalName: 'Wishlist Electronics Bundle Deals',
        badgeText: 'Limited-Time Offer',
        mainHeading: 'Exclusive Savings on Audio & Gear',
        highlightText: 'Exclusive Savings',
        subtitle: 'Move saved tech picks straight to checkout with fast delivery across Bangladesh.',
        primaryButtonText: 'Browse Tech',
        primaryButtonUrl: '/category/electronics',
        destinationUrl: '/category/electronics',
        desktopImageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
      },
    ];
  }

  if (placement === 'cart') {
    return [
      {
        ...createDefaultSlideForPlacement('cart', 0),
        internalName: 'Cart Free Shipping Threshold',
        badgeText: 'Complimentary Delivery',
        mainHeading: 'Unlock Free Nationwide Shipping Over ৳999',
        highlightText: 'Free Nationwide Shipping',
        subtitle: 'Fast dispatch across Dhaka & all 64 districts with 7-day easy returns.',
        primaryButtonText: 'Browse Deals',
        primaryButtonUrl: '/deals',
        destinationUrl: '/deals',
        desktopImageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
      },
      {
        ...createDefaultSlideForPlacement('cart', 1),
        internalName: 'Cart Fashion Add-On Offer',
        badgeText: 'Cart Companion Perks',
        mainHeading: 'Complete Your Look & Save More',
        highlightText: 'Save More',
        subtitle: 'Discover curated accessories & everyday favorites before checking out.',
        primaryButtonText: 'Shop Add-Ons',
        primaryButtonUrl: '/shop',
        destinationUrl: '/shop',
        desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
      },
    ];
  }

  return [
    {
      ...createDefaultSlideForPlacement('checkout', 0),
      internalName: 'Checkout Verified Security & COD',
      badgeText: '100% Protected Checkout',
      mainHeading: 'Verified Cash on Delivery & Instant Online Payment',
      highlightText: 'Protected Checkout',
      subtitle: 'Pay via Cash on Delivery, bKash, Nagad, or SSLCommerz cards with full buyer guarantee.',
      primaryButtonText: '',
      primaryButtonUrl: '',
      destinationUrl: '',
      desktopImageUrl: '/src/assets/images/promo_tech_laptops_1795621230990.jpg',
    },
  ];
}

export async function ensureDefaultSlideshows(): Promise<void> {
  const existing = await SlideshowModel.find().select('placement').lean();
  const existingPlacements = new Set(existing.map((s) => s.placement));

  for (const placement of SLIDESHOW_PLACEMENTS) {
    if (!existingPlacements.has(placement)) {
      const meta = SLIDESHOW_PLACEMENT_META[placement];
      await SlideshowModel.create({
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
        autoplayIntervalMs: placement === 'checkout' ? 6500 : 5000,
        indicatorStyle: 'dots',
        showIndicators: true,
        showArrows: true,
        desktopHeightPx: meta.defaultDesktopHeightPx,
        tabletHeightPx: meta.defaultTabletHeightPx,
        mobileHeightPx: meta.defaultMobileHeightPx,
        borderRadiusPx: meta.defaultBorderRadiusPx,
        compactMode: meta.defaultCompactMode,
        slides: buildSeededSlides(placement),
      });
    }
  }
}

export const publicSlideshowRouter = Router();
publicSlideshowRouter.use(requireDatabase);

publicSlideshowRouter.get(
  '/:placement',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const placementParsed = placementEnum.safeParse(String(req.params.placement || '').toLowerCase());
    if (!placementParsed.success) {
      res.status(400).json({
        error: 'Invalid slideshow placement. Allowed values: homepage, cart, wishlist, checkout.',
      });
      return;
    }

    const placement = placementParsed.data;
    const count = await SlideshowModel.countDocuments({ placement });
    if (count === 0) {
      await ensureDefaultSlideshows();
    }

    const candidates = await SlideshowModel.find({
      placement,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean<Array<ISlideshow & { slides: Array<ISlideshow['slides'][number]> }>>();

    const now = new Date();
    for (const candidate of candidates) {
      const activeSlides = filterAndSortActiveSlides(
        (candidate.slides || []).map((s) => ({
          ...s,
          startsAt: s.startsAt ? new Date(s.startsAt).toISOString() : null,
          endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : null,
        })),
        now
      );
      if (activeSlides.length > 0) {
        res.json({
          slideshow: {
            ...candidate,
            slides: activeSlides,
          },
        });
        return;
      }
    }

    res.json({ slideshow: null });
  })
);

export const adminSlideshowRouter = Router();
adminSlideshowRouter.use(requireDatabase, requireAuth, requirePermission('cms:write'));

// GET /api/admin/slideshows?placement=...
adminSlideshowRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await ensureDefaultSlideshows();

    const placementParam =
      typeof req.query.placement === 'string' ? req.query.placement.trim().toLowerCase() : '';
    const filter: Record<string, unknown> = {};
    if (placementParam && placementParam !== 'all') {
      const parsed = placementEnum.safeParse(placementParam);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid placement filter.' });
        return;
      }
      filter.placement = parsed.data;
    }

    const slideshows = await SlideshowModel.find(filter)
      .sort({ placement: 1, updatedAt: -1 })
      .lean();

    const normalized = slideshows.map((sh) => ({
      ...sh,
      slides: [...(sh.slides || [])].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      ),
    }));

    res.json({ slideshows: normalized });
  })
);

// POST /api/admin/slideshows
adminSlideshowRouter.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = slideshowValidationSchema.parse(req.body);
    const meta = SLIDESHOW_PLACEMENT_META[parsed.placement];

    const sanitizedSlides = (parsed.slides || []).map((s, idx) => {
      if (!isSlideScheduleValid(s.startsAt, s.endsAt)) {
        throw Object.assign(new Error('Slide end date must be after start date.'), {
          statusCode: 400,
        });
      }
      return {
        ...sanitizeSlideColors(s),
        displayOrder: s.displayOrder ?? idx,
        startsAt: s.startsAt ? new Date(s.startsAt) : null,
        endsAt: s.endsAt ? new Date(s.endsAt) : null,
      };
    });

    const slideshow = await SlideshowModel.create({
      ...parsed,
      targetPage: parsed.targetPage || meta.targetPage,
      slides: sanitizedSlides,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_SLIDESHOW',
      resourceType: 'Slideshow',
      resourceId: String(slideshow._id),
      details: { name: slideshow.name, placement: slideshow.placement },
      ipAddress: req.ip,
    });

    res.status(201).json({ slideshow });
  })
);

// GET /api/admin/slideshows/:id
adminSlideshowRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slideshow ID.' });
      return;
    }
    const slideshow = await SlideshowModel.findById(req.params.id).lean();
    if (!slideshow) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }
    res.json({
      slideshow: {
        ...slideshow,
        slides: [...(slideshow.slides || [])].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        ),
      },
    });
  })
);

// PATCH /api/admin/slideshows/:id
adminSlideshowRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slideshow ID.' });
      return;
    }

    const parsed = toPatchSchema(slideshowValidationSchema.omit({ slides: true })).parse(req.body);
    const existing = await SlideshowModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    if (parsed.name !== undefined) existing.name = parsed.name;
    if (parsed.placement !== undefined) {
      existing.placement = parsed.placement;
      if (parsed.targetPage === undefined) {
        existing.targetPage = SLIDESHOW_PLACEMENT_META[parsed.placement].targetPage;
      }
    }
    if (parsed.targetPage !== undefined) existing.targetPage = parsed.targetPage;
    if (parsed.isActive !== undefined) existing.isActive = parsed.isActive;
    if (parsed.autoplay !== undefined) existing.autoplay = parsed.autoplay;
    if (parsed.infiniteLoop !== undefined) existing.infiniteLoop = parsed.infiniteLoop;
    if (parsed.pauseOnHover !== undefined) existing.pauseOnHover = parsed.pauseOnHover;
    if (parsed.animationSpeed !== undefined) existing.animationSpeed = parsed.animationSpeed;
    if (parsed.transitionEffect !== undefined) existing.transitionEffect = parsed.transitionEffect;
    if (parsed.transitionDurationMs !== undefined) {
      existing.transitionDurationMs = parsed.transitionDurationMs;
    }
    if (parsed.autoplayIntervalMs !== undefined) {
      existing.autoplayIntervalMs = parsed.autoplayIntervalMs;
    }
    if (parsed.indicatorStyle !== undefined) existing.indicatorStyle = parsed.indicatorStyle;
    if (parsed.showIndicators !== undefined) existing.showIndicators = parsed.showIndicators;
    if (parsed.showArrows !== undefined) existing.showArrows = parsed.showArrows;
    if (parsed.desktopHeightPx !== undefined) existing.desktopHeightPx = parsed.desktopHeightPx;
    if (parsed.tabletHeightPx !== undefined) existing.tabletHeightPx = parsed.tabletHeightPx;
    if (parsed.mobileHeightPx !== undefined) existing.mobileHeightPx = parsed.mobileHeightPx;
    if (parsed.borderRadiusPx !== undefined) existing.borderRadiusPx = parsed.borderRadiusPx;
    if (parsed.compactMode !== undefined) existing.compactMode = parsed.compactMode;

    existing.updatedBy = req.user!._id;
    await existing.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_SLIDESHOW',
      resourceType: 'Slideshow',
      resourceId: String(existing._id),
      details: { placement: existing.placement, isActive: existing.isActive },
      ipAddress: req.ip,
    });

    res.json({ slideshow: existing });
  })
);

// DELETE /api/admin/slideshows/:id
adminSlideshowRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slideshow ID.' });
      return;
    }
    const deleted = await SlideshowModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    for (const slide of deleted.slides || []) {
      if (slide.desktopImagePublicId) {
        void destroyCloudinaryAssetIfUnused(slide.desktopImagePublicId);
      }
      if (slide.mobileImagePublicId) {
        void destroyCloudinaryAssetIfUnused(slide.mobileImagePublicId);
      }
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_SLIDESHOW',
      resourceType: 'Slideshow',
      resourceId: req.params.id,
      details: { name: deleted.name, placement: deleted.placement },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// POST /api/admin/slideshows/:id/slides
adminSlideshowRouter.post(
  '/:id/slides',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slideshow ID.' });
      return;
    }
    const parsed = slideValidationSchema.parse(req.body);
    if (!isSlideScheduleValid(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const slideshow = await SlideshowModel.findById(req.params.id);
    if (!slideshow) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    const cleaned = sanitizeSlideColors(parsed);
    const nextOrder =
      parsed.displayOrder !== undefined ? parsed.displayOrder : slideshow.slides.length;

    slideshow.slides.push({
      ...cleaned,
      displayOrder: nextOrder,
      startsAt: cleaned.startsAt ? new Date(cleaned.startsAt) : null,
      endsAt: cleaned.endsAt ? new Date(cleaned.endsAt) : null,
    } as never);
    slideshow.updatedBy = req.user!._id;
    await slideshow.save();

    const createdSlide = slideshow.slides[slideshow.slides.length - 1];

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ADD_SLIDESHOW_SLIDE',
      resourceType: 'Slideshow',
      resourceId: String(slideshow._id),
      details: {
        placement: slideshow.placement,
        slideId: String(createdSlide?._id || ''),
        heading: parsed.mainHeading,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({ slideshow, slide: createdSlide });
  })
);

// POST /api/admin/slideshows/:id/slides/:slideId/duplicate
adminSlideshowRouter.post(
  '/:id/slides/:slideId/duplicate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.slideId)
    ) {
      res.status(400).json({ error: 'Invalid slideshow or slide ID.' });
      return;
    }

    const slideshow = await SlideshowModel.findById(req.params.id);
    if (!slideshow) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    const source = slideshow.slides.find((s: ISlideshowSlide) => String(s._id) === req.params.slideId);
    if (!source) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    const raw =
      typeof (source as unknown as { toObject?: () => Record<string, unknown> }).toObject === 'function'
        ? (source as unknown as { toObject: () => Record<string, unknown> }).toObject()
        : { ...source };

    const { _id: _omitId, createdAt: _omitC, updatedAt: _omitU, ...copyFields } = raw;
    slideshow.slides.push({
      ...copyFields,
      internalName: `${String(copyFields.internalName || 'Slide')} (Copy)`.slice(0, 140),
      isActive: false,
      status: 'draft',
      displayOrder: slideshow.slides.length,
    } as never);

    slideshow.updatedBy = req.user!._id;
    await slideshow.save();

    const duplicated = slideshow.slides[slideshow.slides.length - 1];

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DUPLICATE_SLIDESHOW_SLIDE',
      resourceType: 'Slideshow',
      resourceId: String(slideshow._id),
      details: {
        placement: slideshow.placement,
        sourceSlideId: req.params.slideId,
        newSlideId: String(duplicated?._id || ''),
      },
      ipAddress: req.ip,
    });

    res.status(201).json({ slideshow, slide: duplicated });
  })
);

// PATCH /api/admin/slideshows/:id/slides/:slideId
adminSlideshowRouter.patch(
  '/:id/slides/:slideId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.slideId)
    ) {
      res.status(400).json({ error: 'Invalid slideshow or slide ID.' });
      return;
    }

    const parsed = toPatchSchema(slideValidationSchema).parse(req.body);
    const slideshow = await SlideshowModel.findById(req.params.id);
    if (!slideshow) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    const target = slideshow.slides.find((s: ISlideshowSlide) => String(s._id) === req.params.slideId);
    if (!target) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    const nextStartsAt =
      parsed.startsAt !== undefined
        ? parsed.startsAt
          ? new Date(parsed.startsAt)
          : null
        : target.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined
        ? parsed.endsAt
          ? new Date(parsed.endsAt)
          : null
        : target.endsAt;

    if (!isSlideScheduleValid(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const prevDesktopPublicId = target.desktopImagePublicId;
    const prevMobilePublicId = target.mobileImagePublicId;
    const cleaned = sanitizeSlideColors(parsed);

    Object.assign(target, {
      ...cleaned,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
    });
    slideshow.updatedBy = req.user!._id;
    await slideshow.save();

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
      action: 'UPDATE_SLIDESHOW_SLIDE',
      resourceType: 'Slideshow',
      resourceId: String(slideshow._id),
      details: { slideId: req.params.slideId, isActive: target.isActive, status: target.status },
      ipAddress: req.ip,
    });

    res.json({ slideshow, slide: target });
  })
);

// DELETE /api/admin/slideshows/:id/slides/:slideId
adminSlideshowRouter.delete(
  '/:id/slides/:slideId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.slideId)
    ) {
      res.status(400).json({ error: 'Invalid slideshow or slide ID.' });
      return;
    }

    const slideshow = await SlideshowModel.findById(req.params.id);
    if (!slideshow) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    const targetIdx = slideshow.slides.findIndex((s: ISlideshowSlide) => String(s._id) === req.params.slideId);
    if (targetIdx === -1) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    const removed = slideshow.slides[targetIdx];
    slideshow.slides.splice(targetIdx, 1);
    slideshow.slides.forEach((s: ISlideshowSlide, idx: number) => {
      s.displayOrder = idx;
    });
    slideshow.updatedBy = req.user!._id;
    await slideshow.save();

    if (removed.desktopImagePublicId) {
      void destroyCloudinaryAssetIfUnused(removed.desktopImagePublicId);
    }
    if (removed.mobileImagePublicId) {
      void destroyCloudinaryAssetIfUnused(removed.mobileImagePublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_SLIDESHOW_SLIDE',
      resourceType: 'Slideshow',
      resourceId: String(slideshow._id),
      details: { slideId: req.params.slideId },
      ipAddress: req.ip,
    });

    res.json({ ok: true, slideshow });
  })
);

// PATCH /api/admin/slideshows/:id/reorder
adminSlideshowRouter.patch(
  '/:id/reorder',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slideshow ID.' });
      return;
    }

    const parsed = z
      .object({
        orderedSlideIds: z.array(z.string().trim().min(1)).min(1).max(100),
      })
      .parse(req.body);

    const slideshow = await SlideshowModel.findById(req.params.id);
    if (!slideshow) {
      res.status(404).json({ error: 'Slideshow not found' });
      return;
    }

    const reorderedMeta = reorderSlidesById(
      slideshow.slides.map((s: ISlideshowSlide) => ({ _id: String(s._id), displayOrder: s.displayOrder })),
      parsed.orderedSlideIds
    );
    const orderMap = new Map<string, number>();
    reorderedMeta.forEach((item, idx) => {
      if (item._id) orderMap.set(String(item._id), idx);
    });
    slideshow.slides.forEach((slide: ISlideshowSlide) => {
      const nextOrder = orderMap.get(String(slide._id));
      if (nextOrder !== undefined) {
        slide.displayOrder = nextOrder;
      }
    });
    slideshow.slides.sort(
      (a: ISlideshowSlide, b: ISlideshowSlide) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
    slideshow.updatedBy = req.user!._id;
    await slideshow.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'REORDER_SLIDESHOW_SLIDES',
      resourceType: 'Slideshow',
      resourceId: String(slideshow._id),
      details: { count: slideshow.slides.length },
      ipAddress: req.ip,
    });

    res.json({ slideshow });
  })
);
