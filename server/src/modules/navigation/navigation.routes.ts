import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  DEFAULT_PLACEMENT_DEFINITIONS,
  DEFAULT_RESPONSIVE_CONFIG,
  DEFAULT_SLIDER_SETTINGS,
  MEGA_MENU_SECTION_IDS,
  MENU_ITEM_TYPES,
  MENU_PLACEMENTS,
  MENU_STATUSES,
  MENU_TEMPLATES,
  MENU_TYPES,
  MENU_VISIBILITIES,
  normalizeHexColor,
  sanitizeMenuCustomCss,
  sanitizeSvgMarkup,
  validateParentRelationship,
  type NavigationPlacementKey,
} from '../../../../shared/megaMenuHelpers.ts';
import { isSafeDestinationUrl } from '../../../../shared/security.ts';
import { hasValidScheduleWindow } from '../../../../shared/wishlistHelpers.ts';
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
import {
  BrandModel,
  CategoryModel,
  CollectionModel,
  ProductModel,
} from '../catalog/catalog.model.ts';
import { BlogPostModel, StaticPageModel } from '../cms/cms.model.ts';
import { CampaignModel } from '../marketing/marketing.model.ts';
import { invalidateNavigationCache } from './navigation.cache.ts';
import {
  MegaMenuSlideModel,
  NavigationItemModel,
  NavigationMenuModel,
  NavigationPlacementModel,
} from './navigation.model.ts';
import {
  ensureDefaultNavigationDocuments,
  resolveMenuPayload,
  resolvePublicNavigation,
} from './navigation.service.ts';

const router = Router();
router.use(requireDatabase);

const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many navigation updates. Please wait a moment and try again.' },
});

const safeUrlSchema = z
  .string()
  .trim()
  .max(360)
  .refine(
    (v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }),
    'Unsafe or invalid URL protocol'
  );

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const megaMenuConfigSchema = z
  .object({
    showSidebar: z.boolean().default(true),
    showGrid: z.boolean().default(true),
    showSlider: z.boolean().default(true),
    sectionOrder: z
      .array(z.enum(MEGA_MENU_SECTION_IDS))
      .min(1)
      .max(3)
      .default(['sidebar', 'grid', 'slider']),
    sidebarWidthPx: z.number().int().min(180).max(360).default(235),
    gridWidthMode: z.enum(['flex', 'custom']).default('flex'),
    gridWidthPx: z.number().int().min(320).max(900).default(620),
    sliderWidthPx: z.number().int().min(220).max(460).default(330),
    columns: z.enum(['1', '2', '3', '4', 'auto', 'custom']).default('2'),
    customColumnCount: z.number().int().min(1).max(4).default(2),
    showAllCategoriesEntry: z.boolean().default(true),
    allCategoriesLabel: z.string().trim().min(1).max(60).default('All Categories'),
    showViewAllLinks: z.boolean().default(true),
    showCategoryIcons: z.boolean().default(true),
    showSubcategoryIcons: z.boolean().default(false),
    showProductImages: z.boolean().default(false),
    showHelpCard: z.boolean().default(true),
    helpCardTitle: z.string().trim().max(60).default('Need Help?'),
    helpCardPhone: z.string().trim().max(40).default('+880 1234 567890'),
    maxSubcategoriesPerGroup: z.number().int().min(2).max(20).default(6),
  })
  .partial();

const appearanceConfigSchema = z
  .object({
    template: z.enum(MENU_TEMPLATES).default('modern_green'),
    menuWidth: z.enum(['container', 'full', 'custom']).default('container'),
    customWidthPx: z.number().int().min(600).max(1600).default(1180),
    maxHeightPx: z.number().int().min(300).max(900).default(540),
    paddingPx: z.number().int().min(4).max(48).default(16),
    gapPx: z.number().int().min(4).max(40).default(16),
    borderRadiusPx: z.number().int().min(0).max(36).default(18),
    borderColor: z.string().trim().max(24).default('#E2E8F0'),
    shadow: z.enum(['none', 'sm', 'md', 'xl', '2xl']).default('2xl'),
    backgroundColor: z.string().trim().max(24).default('#FFFFFF'),
    sidebarBgColor: z.string().trim().max(24).default('#FFFFFF'),
    fontFamily: z
      .enum(['Plus Jakarta Sans', 'Manrope', 'Poppins', 'Outfit', 'Inter'])
      .default('Plus Jakarta Sans'),
    fontWeight: z.enum(['400', '500', '600', '700']).default('500'),
    iconSizePx: z.number().int().min(12).max(32).default(18),
    textSizePx: z.number().int().min(11).max(20).default(13),
    textColor: z.string().trim().max(24).default('#0F172A'),
    hoverBgColor: z.string().trim().max(24).default('#F0FDF4'),
    hoverTextColor: z.string().trim().max(24).default('#15803D'),
    activeBgColor: z.string().trim().max(24).default('#DCFCE7'),
    activeTextColor: z.string().trim().max(24).default('#15803D'),
    dividerStyle: z.enum(['hairline', 'dashed', 'none']).default('hairline'),
    animation: z.enum(['fade', 'slide_down', 'scale', 'none']).default('fade'),
    animationDurationMs: z.number().int().min(0).max(800).default(180),
    openDirection: z.enum(['down', 'left', 'right']).default('down'),
    triggerMode: z.enum(['hover_or_click', 'click', 'hover']).default('hover_or_click'),
    customCss: z.string().max(1500).default(''),
  })
  .partial();

const responsiveConfigSchema = z
  .object({
    desktopEnabled: z.boolean().default(true),
    tabletEnabled: z.boolean().default(true),
    mobileEnabled: z.boolean().default(true),
    tabletColumns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    mobileDrawerMode: z.enum(['accordion', 'drilldown']).default('accordion'),
    showPromoSliderOnMobile: z.boolean().default(true),
  })
  .partial();

const sliderSettingsSchema = z
  .object({
    autoplay: z.boolean().default(true),
    pauseOnHover: z.boolean().default(true),
    loop: z.boolean().default(true),
    intervalMs: z.number().int().min(1500).max(20000).default(4500),
    showArrows: z.boolean().default(true),
    showDots: z.boolean().default(true),
    transitionEffect: z.enum(['fade', 'slide']).default('fade'),
  })
  .partial();

const structuredBlockSchema = z.object({
  blockType: z.enum(['heading', 'text', 'banner_card', 'feature_list', 'cta_button']),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(400).optional(),
  ctaText: z.string().trim().max(40).optional(),
  ctaUrl: safeUrlSchema.optional(),
  imageUrl: safeUrlSchema.optional(),
  badgeText: z.string().trim().max(40).optional(),
  items: z.array(z.string().trim().max(100)).max(10).optional(),
});

const menuItemSchema = z.object({
  parentId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || mongoose.Types.ObjectId.isValid(v), 'Invalid parent item ID'),
  label: z.string().trim().min(1).max(100),
  itemType: z.enum(MENU_ITEM_TYPES).default('internal_route'),
  targetId: z.string().trim().max(80).nullable().optional(),
  targetSlug: z.string().trim().max(120).optional().default(''),
  url: z
    .string()
    .trim()
    .max(360)
    .default('/shop')
    .refine((v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Unsafe or invalid destination URL'),
  openInNewTab: z.boolean().default(false),
  iconType: z.enum(['lucide', 'svg', 'image', 'none']).default('lucide'),
  iconName: z.string().trim().max(60).optional().default('LayoutGrid'),
  iconSvg: z.string().max(9000).optional().default(''),
  iconImageUrl: safeUrlSchema.optional().default(''),
  iconImagePublicId: z.string().trim().max(200).optional().default(''),
  iconColor: z.string().trim().max(24).optional().default('#16A34A'),
  iconBgColor: z.string().trim().max(24).optional().default('#DCFCE7'),
  imageUrl: safeUrlSchema.optional().default(''),
  imagePublicId: z.string().trim().max(200).optional().default(''),
  badgeText: z.string().trim().max(30).optional().default(''),
  badgeBgColor: z.string().trim().max(24).optional().default('#16A34A'),
  badgeTextColor: z.string().trim().max(24).optional().default('#FFFFFF'),
  description: z.string().trim().max(260).optional().default(''),
  structuredBlocks: z.array(structuredBlockSchema).max(10).optional().default([]),
  featuredGroupLimit: z.number().int().min(1).max(12).optional().default(4),
  columnIndex: z.number().int().min(0).max(3).optional().default(0),
  displayOrder: z.number().int().min(0).optional().default(0),
  isVisible: z.boolean().optional().default(true),
});

const menuSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .refine((v) => slugRegex.test(v), 'Slug must contain lowercase letters, numbers, and hyphens only'),
  menuType: z.enum(MENU_TYPES).default('category_mega_menu'),
  placement: z.enum(MENU_PLACEMENTS),
  description: z.string().trim().max(360).optional().default(''),
  status: z.enum(MENU_STATUSES).default('draft'),
  visibility: z.enum(MENU_VISIBILITIES).default('public'),
  displayOrder: z.number().int().min(0).optional().default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  targetPaths: z.array(z.string().trim().max(120)).max(20).optional().default([]),
  categoryMode: z.enum(['auto', 'hybrid', 'manual']).default('auto'),
  includedCategoryIds: z
    .array(z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid category ID'))
    .optional()
    .default([]),
  excludedCategoryIds: z
    .array(z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid category ID'))
    .optional()
    .default([]),
  maxDepth: z.number().int().min(1).max(5).optional().default(4),
  megaMenuConfig: megaMenuConfigSchema.optional(),
  appearanceConfig: appearanceConfigSchema.optional(),
  responsiveConfig: responsiveConfigSchema.optional(),
  sliderSettings: sliderSettingsSchema.optional(),
  replaceExistingActive: z.boolean().optional().default(false),
});

const slideSchema = z.object({
  menuIds: z
    .array(z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid menu ID'))
    .optional()
    .default([]),
  internalName: z.string().trim().min(2).max(120),
  badgeText: z.string().trim().max(50).optional().default('Special Offer'),
  mainHeading: z.string().trim().min(1).max(120),
  highlightText: z.string().trim().max(100).optional().default(''),
  discountText: z.string().trim().max(90).optional().default(''),
  description: z.string().trim().max(260).optional().default(''),
  ctaLabel: z.string().trim().max(40).optional().default('Shop Now'),
  ctaUrl: safeUrlSchema.optional().default('/shop'),
  openInNewTab: z.boolean().optional().default(false),
  desktopImageUrl: safeUrlSchema.optional().default(''),
  desktopImagePublicId: z.string().trim().max(200).optional().default(''),
  mobileImageUrl: safeUrlSchema.optional().default(''),
  mobileImagePublicId: z.string().trim().max(200).optional().default(''),
  altText: z.string().trim().max(180).optional().default('Mega Menu Promotional Slide'),
  imagePosition: z.enum(['bottom_right', 'center', 'cover', 'right']).optional().default('bottom_right'),
  textColor: z.string().trim().max(24).optional().default('#0F172A'),
  highlightColor: z.string().trim().max(24).optional().default('#16A34A'),
  buttonBgColor: z.string().trim().max(24).optional().default('#16A34A'),
  buttonTextColor: z.string().trim().max(24).optional().default('#FFFFFF'),
  badgeBgColor: z.string().trim().max(24).optional().default('#16A34A'),
  badgeTextColor: z.string().trim().max(24).optional().default('#FFFFFF'),
  textAlign: z.enum(['left', 'center', 'right']).optional().default('left'),
  overlayColor: z.string().trim().max(24).optional().default('#DCFCE7'),
  overlayOpacity: z.number().min(0).max(95).optional().default(0),
  borderRadiusPx: z.number().int().min(0).max(32).optional().default(16),
  customStyleCss: z.string().max(1000).optional().default(''),
  priority: z.number().int().min(-100).max(1000).optional().default(10),
  displayOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  status: z.enum(MENU_STATUSES).optional().default('published'),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  productIds: z
    .array(z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid product ID'))
    .optional()
    .default([]),
});

function sanitizeAppearanceConfig(input: Partial<typeof DEFAULT_MEGA_MENU_APPEARANCE> | undefined) {
  const merged = { ...DEFAULT_MEGA_MENU_APPEARANCE, ...(input || {}) };
  return {
    ...merged,
    borderColor: normalizeHexColor(merged.borderColor, '#E2E8F0'),
    backgroundColor: normalizeHexColor(merged.backgroundColor, '#FFFFFF'),
    sidebarBgColor: normalizeHexColor(merged.sidebarBgColor, '#FFFFFF'),
    textColor: normalizeHexColor(merged.textColor, '#0F172A'),
    hoverBgColor: normalizeHexColor(merged.hoverBgColor, '#F0FDF4'),
    hoverTextColor: normalizeHexColor(merged.hoverTextColor, '#15803D'),
    activeBgColor: normalizeHexColor(merged.activeBgColor, '#DCFCE7'),
    activeTextColor: normalizeHexColor(merged.activeTextColor, '#15803D'),
    customCss: sanitizeMenuCustomCss(merged.customCss),
  };
}

function sanitizeSlideColors(parsed: Partial<z.infer<typeof slideSchema>>) {
  return {
    ...parsed,
    ...(parsed.textColor !== undefined ? { textColor: normalizeHexColor(parsed.textColor, '#0F172A') } : {}),
    ...(parsed.highlightColor !== undefined ? { highlightColor: normalizeHexColor(parsed.highlightColor, '#16A34A') } : {}),
    ...(parsed.buttonBgColor !== undefined ? { buttonBgColor: normalizeHexColor(parsed.buttonBgColor, '#16A34A') } : {}),
    ...(parsed.buttonTextColor !== undefined ? { buttonTextColor: normalizeHexColor(parsed.buttonTextColor, '#FFFFFF') } : {}),
    ...(parsed.badgeBgColor !== undefined ? { badgeBgColor: normalizeHexColor(parsed.badgeBgColor, '#16A34A') } : {}),
    ...(parsed.badgeTextColor !== undefined ? { badgeTextColor: normalizeHexColor(parsed.badgeTextColor, '#FFFFFF') } : {}),
    ...(parsed.overlayColor !== undefined ? { overlayColor: normalizeHexColor(parsed.overlayColor, '#DCFCE7') } : {}),
    ...(parsed.customStyleCss !== undefined ? { customStyleCss: sanitizeMenuCustomCss(parsed.customStyleCss) } : {}),
  };
}

function sanitizeMenuItemPayload(parsed: Partial<z.infer<typeof menuItemSchema>>) {
  const cleanSvg =
    parsed.iconSvg !== undefined ? sanitizeSvgMarkup(parsed.iconSvg) : undefined;
  return {
    ...parsed,
    ...(cleanSvg !== undefined ? { iconSvg: cleanSvg } : {}),
    ...(parsed.iconColor !== undefined ? { iconColor: normalizeHexColor(parsed.iconColor, '#16A34A') } : {}),
    ...(parsed.iconBgColor !== undefined ? { iconBgColor: normalizeHexColor(parsed.iconBgColor, '#DCFCE7') } : {}),
    ...(parsed.badgeBgColor !== undefined ? { badgeBgColor: normalizeHexColor(parsed.badgeBgColor, '#16A34A') } : {}),
    ...(parsed.badgeTextColor !== undefined ? { badgeTextColor: normalizeHexColor(parsed.badgeTextColor, '#FFFFFF') } : {}),
  };
}

async function checkPlacementSingleActiveConflict(
  placement: NavigationPlacementKey,
  status: string,
  excludeMenuId?: string,
  replaceExistingActive = false
): Promise<{ conflictMenuName?: string }> {
  if (status !== 'published' && status !== 'scheduled') {
    return {};
  }
  const placementDef =
    (await NavigationPlacementModel.findOne({ key: placement }).lean()) ||
    DEFAULT_PLACEMENT_DEFINITIONS.find((p) => p.key === placement);

  if (!placementDef || placementDef.allowMultipleActive) {
    return {};
  }

  const filter: Record<string, unknown> = {
    placement,
    status: { $in: ['published', 'scheduled'] },
  };
  if (excludeMenuId && mongoose.Types.ObjectId.isValid(excludeMenuId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeMenuId) };
  }

  const existing = await NavigationMenuModel.find(filter).select('_id name').lean();
  if (existing.length === 0) return {};

  if (replaceExistingActive) {
    await NavigationMenuModel.updateMany(
      { _id: { $in: existing.map((m) => m._id) } },
      { status: 'draft' }
    );
    return {};
  }

  return { conflictMenuName: existing[0].name };
}

/* ============================================================================
 * PUBLIC APIs (NEVER EXPOSE DRAFT / DISABLED MENUS OR SLIDES)
 * ========================================================================== */

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const placementQuery =
      typeof req.query.placement === 'string' &&
      (MENU_PLACEMENTS as readonly string[]).includes(req.query.placement)
        ? (req.query.placement as NavigationPlacementKey)
        : undefined;
    const currentPath = typeof req.query.path === 'string' ? req.query.path : undefined;

    const data = await resolvePublicNavigation({
      placement: placementQuery,
      currentPath,
    });
    res.json(data);
  })
);

router.get(
  '/public/menus/:slug',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      res.status(400).json({ error: 'Menu slug is required' });
      return;
    }
    const data = await resolvePublicNavigation({ slug });
    if (!data.menus.length) {
      res.status(404).json({ error: 'Active navigation menu not found' });
      return;
    }
    res.json({ menu: data.menus[0] });
  })
);

router.get(
  '/public/:placement',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const placementRaw = String(req.params.placement || '').trim();
    if (!(MENU_PLACEMENTS as readonly string[]).includes(placementRaw)) {
      res.status(400).json({ error: 'Invalid navigation placement' });
      return;
    }
    const placement = placementRaw as NavigationPlacementKey;
    const currentPath = typeof req.query.path === 'string' ? req.query.path : undefined;
    const data = await resolvePublicNavigation({ placement, currentPath });
    res.json({
      placement,
      menu: data.menus[0] || null,
      menus: data.menus,
    });
  })
);

/* ============================================================================
 * ADMIN APIs
 * ========================================================================== */

router.get(
  '/admin/stats',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    await ensureDefaultNavigationDocuments();
    const now = new Date();

    const [menus, itemCount, slides] = await Promise.all([
      NavigationMenuModel.find()
        .select('name slug menuType placement status updatedAt updatedByName')
        .sort({ updatedAt: -1 })
        .lean(),
      NavigationItemModel.countDocuments(),
      MegaMenuSlideModel.find().select('isActive status startsAt endsAt').lean(),
    ]);

    const menuIds = menus.map((m) => m._id);
    const itemCountsAgg = await NavigationItemModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { menuId: { $in: menuIds } } },
      { $group: { _id: '$menuId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(itemCountsAgg.map((r) => [String(r._id), r.count]));

    const activeMenus = menus.filter((m) => m.status === 'published' || m.status === 'scheduled').length;
    const draftMenus = menus.filter((m) => m.status === 'draft').length;
    const megaMenus = menus.filter((m) => String(m.menuType).includes('mega_menu')).length;
    const activeSlides = slides.filter((s) => {
      if (!s.isActive) return false;
      if (s.status !== 'published' && s.status !== 'scheduled') return false;
      if (s.startsAt && new Date(s.startsAt) > now) return false;
      if (s.endsAt && new Date(s.endsAt) < now) return false;
      return true;
    }).length;

    const byPlacementMap = new Map<string, { placement: string; total: number; active: number }>();
    for (const def of DEFAULT_PLACEMENT_DEFINITIONS) {
      byPlacementMap.set(def.key, { placement: def.key, total: 0, active: 0 });
    }
    for (const m of menus) {
      const entry = byPlacementMap.get(m.placement) || { placement: m.placement, total: 0, active: 0 };
      entry.total += 1;
      if (m.status === 'published' || m.status === 'scheduled') entry.active += 1;
      byPlacementMap.set(m.placement, entry);
    }

    res.json({
      stats: {
        totalMenus: menus.length,
        activeMenus,
        draftMenus,
        totalMenuItems: itemCount,
        megaMenus,
        activePromotionalSlides: activeSlides,
        totalPromotionalSlides: slides.length,
      },
      menusByPlacement: Array.from(byPlacementMap.values()),
      recentMenus: menus.slice(0, 6).map((m) => ({
        ...m,
        itemCount: countMap.get(String(m._id)) || 0,
      })),
    });
  })
);

router.get(
  '/admin/placements',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    await ensureDefaultNavigationDocuments();
    const [placements, menus] = await Promise.all([
      NavigationPlacementModel.find().sort({ key: 1 }).lean(),
      NavigationMenuModel.find().select('name slug menuType placement status updatedAt').lean(),
    ]);
    res.json({
      placements: placements.map((p) => ({
        ...p,
        assignedMenus: menus.filter((m) => m.placement === p.key),
      })),
    });
  })
);

router.get(
  '/admin/resources',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const [categories, products, brands, collections, campaigns, pages, blogs] = await Promise.all([
      CategoryModel.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }).lean(),
      ProductModel.find({ status: 'published' })
        .select('name slug images basePrice salePrice categoryId')
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
      BrandModel.find({ isActive: true }).select('name slug logo').sort({ name: 1 }).lean(),
      CollectionModel.find({ isActive: true }).select('title slug').sort({ displayOrder: 1 }).lean(),
      CampaignModel.find().select('name slug status discountLabel').sort({ createdAt: -1 }).lean(),
      StaticPageModel.find({ isPublished: true }).select('title slug pageType').sort({ title: 1 }).lean(),
      BlogPostModel.find({ status: { $in: ['published', 'scheduled'] } })
        .select('title slug category')
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
    ]);

    res.json({
      categories,
      products,
      brands,
      collections,
      campaigns,
      pages,
      blogs,
    });
  })
);

router.get(
  '/admin/menus',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    await ensureDefaultNavigationDocuments();

    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const placement = typeof req.query.placement === 'string' ? req.query.placement.trim() : '';
    const menuType = typeof req.query.menuType === 'string' ? req.query.menuType.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'updatedAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    const filter: Record<string, unknown> = {};
    if (placement) filter.placement = placement;
    if (menuType) filter.menuType = menuType;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { slug: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { description: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ];
    }

    const allowedSorts: Record<string, Record<string, 1 | -1>> = {
      updatedAt: { updatedAt: sortDir },
      name: { name: sortDir },
      displayOrder: { displayOrder: sortDir, updatedAt: -1 },
      createdAt: { createdAt: sortDir },
    };

    const [total, rawMenus] = await Promise.all([
      NavigationMenuModel.countDocuments(filter),
      NavigationMenuModel.find(filter)
        .sort(allowedSorts[sortBy] || allowedSorts.updatedAt)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const menuIds = rawMenus.map((m) => m._id);
    const [itemCounts, slideCounts] = await Promise.all([
      NavigationItemModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { menuId: { $in: menuIds } } },
        { $group: { _id: '$menuId', count: { $sum: 1 } } },
      ]),
      MegaMenuSlideModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $unwind: '$menuIds' },
        { $match: { menuIds: { $in: menuIds } } },
        { $group: { _id: '$menuIds', count: { $sum: 1 } } },
      ]),
    ]);

    const itemMap = new Map(itemCounts.map((r) => [String(r._id), r.count]));
    const slideMap = new Map(slideCounts.map((r) => [String(r._id), r.count]));

    res.json({
      menus: rawMenus.map((m) => ({
        ...m,
        itemCount: itemMap.get(String(m._id)) || 0,
        slideCount: slideMap.get(String(m._id)) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

router.get(
  '/admin/menus/:id',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const menu = await NavigationMenuModel.findById(req.params.id).lean();
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }
    const [flatItems, resolved] = await Promise.all([
      NavigationItemModel.find({ menuId: menu._id }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      resolveMenuPayload(menu as unknown as Record<string, unknown>, {
        includeDraftItems: true,
        includeInactiveSlides: true,
      }),
    ]);

    res.json({ menu: resolved, flatItems });
  })
);

router.post(
  '/admin/menus',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = menuSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Schedule end date must be after start date.' });
      return;
    }

    const existingSlug = await NavigationMenuModel.exists({ slug: parsed.slug });
    if (existingSlug) {
      res.status(409).json({ error: `A navigation menu with slug "${parsed.slug}" already exists.` });
      return;
    }

    const conflict = await checkPlacementSingleActiveConflict(
      parsed.placement,
      parsed.status,
      undefined,
      parsed.replaceExistingActive
    );
    if (conflict.conflictMenuName) {
      res.status(409).json({
        error: `Placement "${parsed.placement}" already has an active menu ("${conflict.conflictMenuName}"). Unpublish it first or enable replaceExistingActive.`,
        code: 'PLACEMENT_ACTIVE_CONFLICT',
      });
      return;
    }

    const menu = await NavigationMenuModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      megaMenuConfig: { ...DEFAULT_MEGA_MENU_LAYOUT, ...(parsed.megaMenuConfig || {}) },
      appearanceConfig: sanitizeAppearanceConfig(parsed.appearanceConfig),
      responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG, ...(parsed.responsiveConfig || {}) },
      sliderSettings: { ...DEFAULT_SLIDER_SETTINGS, ...(parsed.sliderSettings || {}) },
      createdBy: req.user!._id,
      createdByName: req.user!.name || req.user!.email,
      updatedBy: req.user!._id,
      updatedByName: req.user!.name || req.user!.email,
    });

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_NAVIGATION_MENU',
      resourceType: 'NavigationMenu',
      resourceId: String(menu._id),
      details: { name: menu.name, slug: menu.slug, placement: menu.placement, status: menu.status },
      ipAddress: req.ip,
    });

    const resolved = await resolveMenuPayload(menu, {
      includeDraftItems: true,
      includeInactiveSlides: true,
    });
    res.status(201).json({ menu: resolved });
  })
);

async function updateMenuHandler(req: AuthenticatedRequest, res: import('express').Response) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ error: 'Invalid menu ID' });
    return;
  }
  const existing = await NavigationMenuModel.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Navigation menu not found' });
    return;
  }

  const parsed = toPatchSchema(menuSchema).parse(req.body);
  const nextStartsAt =
    parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
  const nextEndsAt =
    parsed.endsAt !== undefined ? (parsed.endsAt ? new Date(parsed.endsAt) : null) : existing.endsAt;

  if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
    res.status(400).json({ error: 'Schedule end date must be after start date.' });
    return;
  }

  if (parsed.slug && parsed.slug !== existing.slug) {
    const slugTaken = await NavigationMenuModel.exists({ slug: parsed.slug, _id: { $ne: existing._id } });
    if (slugTaken) {
      res.status(409).json({ error: `Slug "${parsed.slug}" is already used by another menu.` });
      return;
    }
  }

  const targetPlacement = (parsed.placement || existing.placement) as NavigationPlacementKey;
  const targetStatus = parsed.status || existing.status;
  const conflict = await checkPlacementSingleActiveConflict(
    targetPlacement,
    targetStatus,
    String(existing._id),
    Boolean(parsed.replaceExistingActive)
  );
  if (conflict.conflictMenuName) {
    res.status(409).json({
      error: `Placement "${targetPlacement}" already has an active menu ("${conflict.conflictMenuName}").`,
      code: 'PLACEMENT_ACTIVE_CONFLICT',
    });
    return;
  }

  Object.assign(existing, {
    ...parsed,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    ...(parsed.megaMenuConfig
      ? { megaMenuConfig: { ...DEFAULT_MEGA_MENU_LAYOUT, ...existing.megaMenuConfig, ...parsed.megaMenuConfig } }
      : {}),
    ...(parsed.appearanceConfig
      ? { appearanceConfig: sanitizeAppearanceConfig({ ...existing.appearanceConfig, ...parsed.appearanceConfig }) }
      : {}),
    ...(parsed.responsiveConfig
      ? { responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG, ...existing.responsiveConfig, ...parsed.responsiveConfig } }
      : {}),
    ...(parsed.sliderSettings
      ? { sliderSettings: { ...DEFAULT_SLIDER_SETTINGS, ...existing.sliderSettings, ...parsed.sliderSettings } }
      : {}),
    updatedBy: req.user!._id,
    updatedByName: req.user!.name || req.user!.email,
  });

  await existing.save();
  invalidateNavigationCache();

  await recordAuditLog({
    actorId: req.user!._id,
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    action: 'UPDATE_NAVIGATION_MENU',
    resourceType: 'NavigationMenu',
    resourceId: String(existing._id),
    details: { name: existing.name, placement: existing.placement, status: existing.status },
    ipAddress: req.ip,
  });

  const resolved = await resolveMenuPayload(existing, {
    includeDraftItems: true,
    includeInactiveSlides: true,
  });
  res.json({ menu: resolved });
}

router.put('/admin/menus/:id', requireAuth, requirePermission('cms:write'), adminWriteLimiter, asyncHandler(updateMenuHandler));
router.patch('/admin/menus/:id', requireAuth, requirePermission('cms:write'), adminWriteLimiter, asyncHandler(updateMenuHandler));

router.delete(
  '/admin/menus/:id',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const menu = await NavigationMenuModel.findByIdAndDelete(req.params.id);
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const items = await NavigationItemModel.find({ menuId: menu._id }).lean();
    await Promise.all([
      NavigationItemModel.deleteMany({ menuId: menu._id }),
      MegaMenuSlideModel.updateMany({ menuIds: menu._id }, { $pull: { menuIds: menu._id } }),
    ]);

    for (const item of items) {
      if (item.iconImagePublicId) void destroyCloudinaryAssetIfUnused(item.iconImagePublicId);
      if (item.imagePublicId) void destroyCloudinaryAssetIfUnused(item.imagePublicId);
    }

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_NAVIGATION_MENU',
      resourceType: 'NavigationMenu',
      resourceId: String(menu._id),
      details: { name: menu.name, slug: menu.slug },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

router.post(
  '/admin/menus/:id/duplicate',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const source = await NavigationMenuModel.findById(req.params.id).lean();
    if (!source) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const uniqueSuffix = Date.now().toString(36).slice(-5);
    const clonedMenu = await NavigationMenuModel.create({
      ...source,
      _id: undefined,
      name: `${source.name} (Copy)`,
      slug: `${source.slug}-copy-${uniqueSuffix}`.slice(0, 118),
      status: 'draft',
      createdBy: req.user!._id,
      createdByName: req.user!.name || req.user!.email,
      updatedBy: req.user!._id,
      updatedByName: req.user!.name || req.user!.email,
    });

    // Clone items preserving parentId hierarchy
    const sourceItems = await NavigationItemModel.find({ menuId: source._id })
      .sort({ displayOrder: 1 })
      .lean();
    const idMap = new Map<string, mongoose.Types.ObjectId>();
    for (const it of sourceItems) {
      idMap.set(String(it._id), new mongoose.Types.ObjectId());
    }
    if (sourceItems.length > 0) {
      await NavigationItemModel.insertMany(
        sourceItems.map((it) => ({
          ...it,
          _id: idMap.get(String(it._id)),
          menuId: clonedMenu._id,
          parentId: it.parentId ? idMap.get(String(it.parentId)) || null : null,
          createdBy: req.user!._id,
          updatedBy: req.user!._id,
        }))
      );
    }

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DUPLICATE_NAVIGATION_MENU',
      resourceType: 'NavigationMenu',
      resourceId: String(clonedMenu._id),
      details: { sourceId: String(source._id), name: clonedMenu.name },
      ipAddress: req.ip,
    });

    const resolved = await resolveMenuPayload(clonedMenu, {
      includeDraftItems: true,
      includeInactiveSlides: true,
    });
    res.status(201).json({ menu: resolved });
  })
);

router.post(
  '/admin/menus/:id/publish',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const menu = await NavigationMenuModel.findById(req.params.id);
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const replaceExistingActive = Boolean(req.body?.replaceExistingActive);
    const conflict = await checkPlacementSingleActiveConflict(
      menu.placement as NavigationPlacementKey,
      'published',
      String(menu._id),
      replaceExistingActive
    );
    if (conflict.conflictMenuName) {
      res.status(409).json({
        error: `Placement "${menu.placement}" already has an active menu ("${conflict.conflictMenuName}").`,
        code: 'PLACEMENT_ACTIVE_CONFLICT',
      });
      return;
    }

    menu.status = 'published';
    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'PUBLISH_NAVIGATION_MENU',
      resourceType: 'NavigationMenu',
      resourceId: String(menu._id),
      details: { placement: menu.placement, slug: menu.slug },
      ipAddress: req.ip,
    });

    const resolved = await resolveMenuPayload(menu, {
      includeDraftItems: true,
      includeInactiveSlides: true,
    });
    res.json({ menu: resolved });
  })
);

router.post(
  '/admin/menus/:id/unpublish',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const menu = await NavigationMenuModel.findById(req.params.id);
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    menu.status = 'draft';
    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UNPUBLISH_NAVIGATION_MENU',
      resourceType: 'NavigationMenu',
      resourceId: String(menu._id),
      details: { placement: menu.placement, slug: menu.slug },
      ipAddress: req.ip,
    });

    const resolved = await resolveMenuPayload(menu, {
      includeDraftItems: true,
      includeInactiveSlides: true,
    });
    res.json({ menu: resolved });
  })
);

router.put(
  '/admin/menus/:id/reorder',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const menu = await NavigationMenuModel.findById(req.params.id);
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const parsed = z
      .object({
        items: z
          .array(
            z.object({
              _id: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid item ID'),
              parentId: z
                .string()
                .nullable()
                .optional()
                .refine((v) => !v || mongoose.Types.ObjectId.isValid(v), 'Invalid parentId'),
              displayOrder: z.number().int().min(0),
            })
          )
          .min(1)
          .max(250),
      })
      .parse(req.body);

    const existingItems = await NavigationItemModel.find({ menuId: menu._id }).lean();
    const existingSet = new Set(existingItems.map((i) => String(i._id)));

    // Build proposed parent map to validate against cycles & maxDepth
    const simulated = existingItems.map((i) => {
      const patch = parsed.items.find((p) => p._id === String(i._id));
      return {
        _id: String(i._id),
        parentId: patch && patch.parentId !== undefined ? patch.parentId : i.parentId ? String(i.parentId) : null,
      };
    });

    for (const patch of parsed.items) {
      if (!existingSet.has(patch._id)) {
        res.status(400).json({ error: `Item ${patch._id} does not belong to this menu.` });
        return;
      }
      if (patch.parentId !== undefined) {
        const check = validateParentRelationship(simulated, patch._id, patch.parentId, menu.maxDepth);
        if (!check.valid) {
          res.status(400).json({ error: check.reason || 'Invalid hierarchy update' });
          return;
        }
      }
    }

    await Promise.all(
      parsed.items.map((patch) =>
        NavigationItemModel.findOneAndUpdate(
          { _id: patch._id, menuId: menu._id },
          {
            displayOrder: patch.displayOrder,
            ...(patch.parentId !== undefined ? { parentId: patch.parentId || null } : {}),
            updatedBy: req.user!._id,
          }
        )
      )
    );

    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();
    invalidateNavigationCache();

    const [flatItems, resolved] = await Promise.all([
      NavigationItemModel.find({ menuId: menu._id }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      resolveMenuPayload(menu, { includeDraftItems: true, includeInactiveSlides: true }),
    ]);

    res.json({ menu: resolved, flatItems });
  })
);

router.post(
  '/admin/menus/:id/preview',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const baseMenu = await NavigationMenuModel.findById(req.params.id).lean();
    if (!baseMenu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const mergedMenu = {
      ...baseMenu,
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.menuType === 'string' ? { menuType: body.menuType } : {}),
      ...(typeof body.categoryMode === 'string' ? { categoryMode: body.categoryMode } : {}),
      ...(Array.isArray(body.includedCategoryIds) ? { includedCategoryIds: body.includedCategoryIds } : {}),
      ...(Array.isArray(body.excludedCategoryIds) ? { excludedCategoryIds: body.excludedCategoryIds } : {}),
      ...(body.megaMenuConfig && typeof body.megaMenuConfig === 'object'
        ? { megaMenuConfig: { ...baseMenu.megaMenuConfig, ...body.megaMenuConfig } }
        : {}),
      ...(body.appearanceConfig && typeof body.appearanceConfig === 'object'
        ? { appearanceConfig: sanitizeAppearanceConfig({ ...baseMenu.appearanceConfig, ...body.appearanceConfig }) }
        : {}),
      ...(body.responsiveConfig && typeof body.responsiveConfig === 'object'
        ? { responsiveConfig: { ...baseMenu.responsiveConfig, ...body.responsiveConfig } }
        : {}),
      ...(body.sliderSettings && typeof body.sliderSettings === 'object'
        ? { sliderSettings: { ...baseMenu.sliderSettings, ...body.sliderSettings } }
        : {}),
    };

    const resolved = await resolveMenuPayload(mergedMenu, {
      includeDraftItems: true,
      includeInactiveSlides: Boolean(body.includeInactiveSlides),
    });

    res.json({ menu: resolved, isPreview: true });
  })
);

/* ============================================================================
 * MENU ITEMS CRUD
 * ========================================================================== */

router.post(
  '/admin/menus/:id/items',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid menu ID' });
      return;
    }
    const menu = await NavigationMenuModel.findById(req.params.id);
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const parsed = menuItemSchema.parse(req.body);
    const existingItems = await NavigationItemModel.find({ menuId: menu._id })
      .select('_id parentId')
      .lean();

    if (parsed.parentId) {
      const check = validateParentRelationship(
        existingItems.map((i) => ({ _id: String(i._id), parentId: i.parentId ? String(i.parentId) : null })),
        null,
        parsed.parentId,
        menu.maxDepth
      );
      if (!check.valid) {
        res.status(400).json({ error: check.reason || 'Invalid parent item' });
        return;
      }
    }

    const clean = sanitizeMenuItemPayload(parsed);
    const item = await NavigationItemModel.create({
      ...clean,
      menuId: menu._id,
      parentId: parsed.parentId || null,
      displayOrder: parsed.displayOrder ?? existingItems.length,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });

    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();
    invalidateNavigationCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_NAVIGATION_ITEM',
      resourceType: 'NavigationItem',
      resourceId: String(item._id),
      details: { menuId: String(menu._id), label: item.label, itemType: item.itemType },
      ipAddress: req.ip,
    });

    const [flatItems, resolved] = await Promise.all([
      NavigationItemModel.find({ menuId: menu._id }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      resolveMenuPayload(menu, { includeDraftItems: true, includeInactiveSlides: true }),
    ]);

    res.status(201).json({ item, flatItems, menu: resolved });
  })
);

router.put(
  '/admin/menus/:id/items/:itemId',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.itemId)
    ) {
      res.status(400).json({ error: 'Invalid menu or item ID' });
      return;
    }

    const [menu, item] = await Promise.all([
      NavigationMenuModel.findById(req.params.id),
      NavigationItemModel.findOne({ _id: req.params.itemId, menuId: req.params.id }),
    ]);

    if (!menu || !item) {
      res.status(404).json({ error: 'Menu or item not found' });
      return;
    }

    const parsed = toPatchSchema(menuItemSchema).parse(req.body);
    if (parsed.parentId !== undefined) {
      const existingItems = await NavigationItemModel.find({ menuId: menu._id })
        .select('_id parentId')
        .lean();
      const check = validateParentRelationship(
        existingItems.map((i) => ({ _id: String(i._id), parentId: i.parentId ? String(i.parentId) : null })),
        String(item._id),
        parsed.parentId,
        menu.maxDepth
      );
      if (!check.valid) {
        res.status(400).json({ error: check.reason || 'Circular or invalid parent reference' });
        return;
      }
    }

    const oldIconPublicId = item.iconImagePublicId;
    const oldImgPublicId = item.imagePublicId;
    const clean = sanitizeMenuItemPayload(parsed);

    Object.assign(item, {
      ...clean,
      ...(parsed.parentId !== undefined ? { parentId: parsed.parentId || null } : {}),
      updatedBy: req.user!._id,
    });
    await item.save();

    if (oldIconPublicId && parsed.iconImagePublicId !== undefined && parsed.iconImagePublicId !== oldIconPublicId) {
      void destroyCloudinaryAssetIfUnused(oldIconPublicId);
    }
    if (oldImgPublicId && parsed.imagePublicId !== undefined && parsed.imagePublicId !== oldImgPublicId) {
      void destroyCloudinaryAssetIfUnused(oldImgPublicId);
    }

    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();
    invalidateNavigationCache();

    const [flatItems, resolved] = await Promise.all([
      NavigationItemModel.find({ menuId: menu._id }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      resolveMenuPayload(menu, { includeDraftItems: true, includeInactiveSlides: true }),
    ]);

    res.json({ item, flatItems, menu: resolved });
  })
);

router.delete(
  '/admin/menus/:id/items/:itemId',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.itemId)
    ) {
      res.status(400).json({ error: 'Invalid menu or item ID' });
      return;
    }

    const menu = await NavigationMenuModel.findById(req.params.id);
    if (!menu) {
      res.status(404).json({ error: 'Navigation menu not found' });
      return;
    }

    const allItems = await NavigationItemModel.find({ menuId: menu._id }).lean();
    const targetExists = allItems.some((i) => String(i._id) === String(req.params.itemId));
    if (!targetExists) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    // Collect target and all descendants to prevent orphaned records
    const toDelete = new Set<string>([String(req.params.itemId)]);
    let added = true;
    while (added) {
      added = false;
      for (const it of allItems) {
        if (it.parentId && toDelete.has(String(it.parentId)) && !toDelete.has(String(it._id))) {
          toDelete.add(String(it._id));
          added = true;
        }
      }
    }

    const deletedDocs = allItems.filter((i) => toDelete.has(String(i._id)));
    await NavigationItemModel.deleteMany({
      menuId: menu._id,
      _id: { $in: Array.from(toDelete).map((id) => new mongoose.Types.ObjectId(id)) },
    });

    for (const d of deletedDocs) {
      if (d.iconImagePublicId) void destroyCloudinaryAssetIfUnused(d.iconImagePublicId);
      if (d.imagePublicId) void destroyCloudinaryAssetIfUnused(d.imagePublicId);
    }

    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();
    invalidateNavigationCache();

    const [flatItems, resolved] = await Promise.all([
      NavigationItemModel.find({ menuId: menu._id }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      resolveMenuPayload(menu, { includeDraftItems: true, includeInactiveSlides: true }),
    ]);

    res.json({ ok: true, deletedCount: toDelete.size, flatItems, menu: resolved });
  })
);

router.post(
  '/admin/menus/:id/items/:itemId/duplicate',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.itemId)
    ) {
      res.status(400).json({ error: 'Invalid menu or item ID' });
      return;
    }

    const [menu, sourceItem] = await Promise.all([
      NavigationMenuModel.findById(req.params.id),
      NavigationItemModel.findOne({ _id: req.params.itemId, menuId: req.params.id }).lean(),
    ]);

    if (!menu || !sourceItem) {
      res.status(404).json({ error: 'Menu or item not found' });
      return;
    }

    const siblingCount = await NavigationItemModel.countDocuments({
      menuId: menu._id,
      parentId: sourceItem.parentId || null,
    });

    const duplicated = await NavigationItemModel.create({
      ...sourceItem,
      _id: undefined,
      label: `${sourceItem.label} (Copy)`,
      displayOrder: siblingCount,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });

    menu.updatedBy = req.user!._id;
    menu.updatedByName = req.user!.name || req.user!.email;
    await menu.save();
    invalidateNavigationCache();

    const [flatItems, resolved] = await Promise.all([
      NavigationItemModel.find({ menuId: menu._id }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      resolveMenuPayload(menu, { includeDraftItems: true, includeInactiveSlides: true }),
    ]);

    res.status(201).json({ item: duplicated, flatItems, menu: resolved });
  })
);

/* ============================================================================
 * PROMOTIONAL SLIDES MANAGEMENT
 * ========================================================================== */

router.get(
  '/admin/slides',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (req, res) => {
    await ensureDefaultNavigationDocuments();
    const menuId = typeof req.query.menuId === 'string' ? req.query.menuId.trim() : '';
    const filter: Record<string, unknown> = {};
    if (menuId && mongoose.Types.ObjectId.isValid(menuId)) {
      filter.menuIds = new mongoose.Types.ObjectId(menuId);
    }

    const slides = await MegaMenuSlideModel.find(filter)
      .sort({ displayOrder: 1, priority: -1, createdAt: -1 })
      .lean();
    res.json({ slides });
  })
);

router.post(
  '/admin/slides',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = slideSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Slide end date must be after start date.' });
      return;
    }

    const clean = sanitizeSlideColors(parsed);
    const slide = await MegaMenuSlideModel.create({
      ...clean,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_MEGA_MENU_SLIDE',
      resourceType: 'MegaMenuSlide',
      resourceId: String(slide._id),
      details: { internalName: slide.internalName, mainHeading: slide.mainHeading },
      ipAddress: req.ip,
    });

    res.status(201).json({ slide });
  })
);

router.put(
  '/admin/slides/reorder',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({
        orderedIds: z
          .array(z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid slide ID'))
          .min(1)
          .max(100),
      })
      .parse(req.body);

    const uniqueIds = Array.from(new Set(parsed.orderedIds));
    await Promise.all(
      uniqueIds.map((id, idx) =>
        MegaMenuSlideModel.findByIdAndUpdate(id, {
          displayOrder: idx,
          updatedBy: req.user!._id,
        })
      )
    );

    invalidateNavigationCache();
    const slides = await MegaMenuSlideModel.find()
      .sort({ displayOrder: 1, priority: -1 })
      .lean();
    res.json({ slides });
  })
);

async function updateSlideHandler(req: AuthenticatedRequest, res: import('express').Response) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ error: 'Invalid slide ID' });
    return;
  }
  const existing = await MegaMenuSlideModel.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Mega menu promotional slide not found' });
    return;
  }

  const parsed = toPatchSchema(slideSchema).parse(req.body);
  const nextStartsAt =
    parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
  const nextEndsAt =
    parsed.endsAt !== undefined ? (parsed.endsAt ? new Date(parsed.endsAt) : null) : existing.endsAt;

  if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
    res.status(400).json({ error: 'Slide end date must be after start date.' });
    return;
  }

  const oldDesktopId = existing.desktopImagePublicId;
  const oldMobileId = existing.mobileImagePublicId;
  const clean = sanitizeSlideColors(parsed);

  Object.assign(existing, {
    ...clean,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    updatedBy: req.user!._id,
  });
  await existing.save();

  if (oldDesktopId && parsed.desktopImagePublicId !== undefined && parsed.desktopImagePublicId !== oldDesktopId) {
    void destroyCloudinaryAssetIfUnused(oldDesktopId);
  }
  if (oldMobileId && parsed.mobileImagePublicId !== undefined && parsed.mobileImagePublicId !== oldMobileId) {
    void destroyCloudinaryAssetIfUnused(oldMobileId);
  }

  invalidateNavigationCache();
  await recordAuditLog({
    actorId: req.user!._id,
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    action: 'UPDATE_MEGA_MENU_SLIDE',
    resourceType: 'MegaMenuSlide',
    resourceId: String(existing._id),
    details: { internalName: existing.internalName, isActive: existing.isActive },
    ipAddress: req.ip,
  });

  res.json({ slide: existing });
}

router.put('/admin/slides/:id', requireAuth, requirePermission('cms:write'), adminWriteLimiter, asyncHandler(updateSlideHandler));
router.patch('/admin/slides/:id', requireAuth, requirePermission('cms:write'), adminWriteLimiter, asyncHandler(updateSlideHandler));

router.delete(
  '/admin/slides/:id',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid slide ID' });
      return;
    }
    const deleted = await MegaMenuSlideModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Mega menu promotional slide not found' });
      return;
    }
    if (deleted.desktopImagePublicId) void destroyCloudinaryAssetIfUnused(deleted.desktopImagePublicId);
    if (deleted.mobileImagePublicId) void destroyCloudinaryAssetIfUnused(deleted.mobileImagePublicId);

    invalidateNavigationCache();
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_MEGA_MENU_SLIDE',
      resourceType: 'MegaMenuSlide',
      resourceId: String(deleted._id),
      details: { internalName: deleted.internalName },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

export default router;
