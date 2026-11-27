import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  DEFAULT_FOOTER_CONFIG,
  FOOTER_LAYOUT_PRESETS,
  FOOTER_LINK_TYPES,
  FOOTER_PAYMENT_KEYS,
  FOOTER_SOCIAL_PLATFORMS,
  FOOTER_VISIBILITIES,
  cloneFooterConfig,
  duplicateFooterColumn,
  isValidFooterUrl,
  normalizeFooterConfig,
  reorderListByIds,
  type FooterColumnConfig,
  type FooterConfigPayload,
  type FooterMenuItemConfig,
  type FooterSocialLinkConfig,
} from '../../../../shared/footerHelpers.ts';
import { sanitizeMenuCustomCss, sanitizeSvgMarkup } from '../../../../shared/megaMenuHelpers.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  optionalAuth,
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { destroyCloudinaryAssetIfUnused } from '../../services/cloudinary.service.ts';
import { toPatchSchema } from '../../utils/zodPartial.ts';
import { CategoryModel } from '../catalog/catalog.model.ts';
import { BlogPostModel, StaticPageModel, StoreSettingsModel } from '../cms/cms.model.ts';
import { invalidateFooterCache } from './footer.cache.ts';
import {
  ensureDefaultFooterConfig,
  resolvePublicFooter,
  syncPublishedFooterToStoreSettings,
} from './footer.service.ts';

const router = Router();
router.use(requireDatabase);

const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
}

const safeRequiredUrl = z
  .string()
  .trim()
  .min(1, 'URL is required')
  .max(400)
  .refine((u) => isValidFooterUrl(u, false), 'Invalid or unsafe destination URL');

const safeOptionalUrl = z
  .string()
  .trim()
  .max(400)
  .optional()
  .default('')
  .refine((u) => isValidFooterUrl(u, true), 'Invalid or unsafe URL');

const subMenuItemSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1, 'Label is required').max(80),
  url: safeRequiredUrl,
  openInNewTab: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(500).default(0),
  isActive: z.boolean().default(true),
});

const menuItemSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1, 'Menu label is required').max(80),
  iconType: z.enum(['lucide', 'svg', 'image', 'none']).default('none'),
  iconName: z.string().trim().max(60).default('ChevronRight'),
  iconSvg: z.string().max(9000).optional().default(''),
  iconImageUrl: safeOptionalUrl,
  linkType: z.enum(FOOTER_LINK_TYPES).default('internal_route'),
  targetSlug: z.string().trim().max(120).optional().default(''),
  url: safeRequiredUrl,
  target: z.enum(['_self', '_blank']).default('_self'),
  openInNewTab: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(500).default(0),
  isActive: z.boolean().default(true),
  visibility: z.enum(FOOTER_VISIBILITIES).default('all'),
  description: z.string().trim().max(180).optional().default(''),
  badgeText: z.string().trim().max(24).optional().default(''),
  children: z.array(subMenuItemSchema).max(10).optional().default([]),
});

const columnSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1, 'Column title is required').max(80),
  iconType: z.enum(['lucide', 'svg', 'image', 'none']).default('none'),
  iconName: z.string().trim().max(60).default('LayoutGrid'),
  iconSvg: z.string().max(9000).optional().default(''),
  iconImageUrl: safeOptionalUrl,
  iconColor: z.string().trim().max(24).optional().default('#4ADE80'),
  description: z.string().trim().max(240).optional().default(''),
  isVisible: z.boolean().default(true),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100).default(0),
  width: z.enum(['auto', '1fr', '1.25fr', '1.5fr', '2fr', 'custom']).default('1fr'),
  customWidthPx: z.number().int().min(140).max(520).default(220),
  alignment: z.enum(['left', 'center', 'right']).default('left'),
  customStyleCss: z.string().max(1500).optional().default(''),
  items: z.array(menuItemSchema).max(20).optional(),
});

const socialLinkSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  platform: z.enum(FOOTER_SOCIAL_PLATFORMS).default('custom'),
  label: z.string().trim().min(1, 'Platform label is required').max(60),
  url: safeRequiredUrl,
  iconType: z.enum(['brand', 'lucide', 'svg', 'image']).default('brand'),
  iconName: z.string().trim().max(60).default('Globe'),
  iconSvg: z.string().max(9000).optional().default(''),
  iconImageUrl: safeOptionalUrl,
  iconImagePublicId: z.string().trim().max(200).optional().default(''),
  openInNewTab: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

const fullDraftUpdateSchema = z.object({
  general: z
    .object({
      enabled: z.boolean().optional(),
      layoutPreset: z.enum(FOOTER_LAYOUT_PRESETS).optional(),
      backgroundColor: z.string().trim().max(24).optional(),
      backgroundGradientEnabled: z.boolean().optional(),
      backgroundGradientStart: z.string().trim().max(24).optional(),
      backgroundGradientEnd: z.string().trim().max(24).optional(),
      backgroundGradientDirection: z.string().trim().max(40).optional(),
      textColor: z.string().trim().max(24).optional(),
      headingColor: z.string().trim().max(24).optional(),
      linkColor: z.string().trim().max(24).optional(),
      linkHoverColor: z.string().trim().max(24).optional(),
      accentColor: z.string().trim().max(24).optional(),
      borderColor: z.string().trim().max(24).optional(),
      paddingTopPx: z.number().int().min(12).max(120).optional(),
      paddingBottomPx: z.number().int().min(12).max(120).optional(),
      paddingXPx: z.number().int().min(8).max(64).optional(),
      maxWidth: z.enum(['container', 'full', '1280px', '1440px', 'custom']).optional(),
      customMaxWidthPx: z.number().int().min(960).max(1920).optional(),
      borderTopWidthPx: z.number().int().min(0).max(8).optional(),
      borderRadiusPx: z.number().int().min(0).max(48).optional(),
      shadow: z.enum(['none', 'sm', 'md', 'lg']).optional(),
      fontFamily: z.enum(['Plus Jakarta Sans', 'Manrope', 'Poppins', 'Outfit', 'Inter']).optional(),
      headingFontWeight: z.enum(['500', '600', '700', '800']).optional(),
      headingSizePx: z.number().int().min(12).max(24).optional(),
      bodySizePx: z.number().int().min(11).max(18).optional(),
      columnGapPx: z.number().int().min(12).max(64).optional(),
      sectionGapPx: z.number().int().min(12).max(64).optional(),
      desktopColumns: z.number().int().min(1).max(6).optional(),
      tabletColumns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      mobileColumns: z.union([z.literal(1), z.literal(2)]).optional(),
      mobileLayoutMode: z.enum(['accordion', 'stacked']).optional(),
      desktopEnabled: z.boolean().optional(),
      tabletEnabled: z.boolean().optional(),
      mobileEnabled: z.boolean().optional(),
    })
    .optional(),
  brand: z
    .object({
      enabled: z.boolean().optional(),
      showLogo: z.boolean().optional(),
      logoUrl: safeOptionalUrl,
      logoPublicId: z.string().trim().max(200).optional(),
      altLogoUrl: safeOptionalUrl,
      altLogoPublicId: z.string().trim().max(200).optional(),
      logoHeightPx: z.number().int().min(20).max(96).optional(),
      storeName: z.string().trim().max(100).optional(),
      tagline: z.string().trim().max(140).optional(),
      showTagline: z.boolean().optional(),
      description: z.string().trim().max(500).optional(),
      showDescription: z.boolean().optional(),
      showContactInfo: z.boolean().optional(),
      contactEmail: z.string().trim().max(140).optional(),
      contactPhone: z.string().trim().max(40).optional(),
      businessAddress: z.string().trim().max(240).optional(),
      businessHours: z.string().trim().max(120).optional(),
      registrationInfo: z.string().trim().max(160).optional(),
    })
    .optional(),
  columns: z.array(columnSchema).max(8).optional(),
  social: z
    .object({
      enabled: z.boolean().optional(),
      title: z.string().trim().max(80).optional(),
      iconSizePx: z.number().int().min(12).max(32).optional(),
      iconColor: z.string().trim().max(24).optional(),
      hoverColor: z.string().trim().max(24).optional(),
      backgroundColor: z.string().trim().max(24).optional(),
      buttonStyle: z.enum(['rounded', 'circle', 'square', 'ghost']).optional(),
      borderRadiusPx: z.number().int().min(0).max(99).optional(),
      showLabels: z.boolean().optional(),
      links: z.array(socialLinkSchema).max(20).optional(),
    })
    .optional(),
  newsletter: z
    .object({
      enabled: z.boolean().optional(),
      placement: z.enum(['top_banner', 'column', 'above_bottom_bar']).optional(),
      heading: z.string().trim().max(120).optional(),
      description: z.string().trim().max(280).optional(),
      inputPlaceholder: z.string().trim().max(80).optional(),
      buttonLabel: z.string().trim().max(40).optional(),
      consentLabel: z.string().trim().max(220).optional(),
      requireConsent: z.boolean().optional(),
      successMessage: z.string().trim().max(200).optional(),
      errorMessage: z.string().trim().max(200).optional(),
      duplicateMessage: z.string().trim().max(200).optional(),
      backgroundColor: z.string().trim().max(24).optional(),
      textColor: z.string().trim().max(24).optional(),
      buttonBgColor: z.string().trim().max(24).optional(),
      buttonTextColor: z.string().trim().max(24).optional(),
    })
    .optional(),
  payments: z
    .object({
      enabled: z.boolean().optional(),
      title: z.string().trim().max(60).optional(),
      badges: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(80),
            key: z.enum(FOOTER_PAYMENT_KEYS),
            storeChannelKey: z.enum(['cod', 'bkash', 'nagad', 'card', 'sslcommerz', 'always']),
            label: z.string().trim().min(1).max(40),
            isActive: z.boolean(),
            displayOrder: z.number().int().min(0).max(100),
            iconImageUrl: safeOptionalUrl,
            iconImagePublicId: z.string().trim().max(200).optional(),
            bgColor: z.string().trim().max(24).optional(),
            textColor: z.string().trim().max(24).optional(),
          })
        )
        .max(16)
        .optional(),
    })
    .optional(),
  trustBadges: z
    .object({
      enabled: z.boolean().optional(),
      items: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(80),
            title: z.string().trim().min(1).max(60),
            subtitle: z.string().trim().max(120).optional().default(''),
            iconName: z.string().trim().max(60).default('ShieldCheck'),
            isActive: z.boolean(),
            displayOrder: z.number().int().min(0).max(50),
          })
        )
        .max(8)
        .optional(),
    })
    .optional(),
  bottomBar: z
    .object({
      enabled: z.boolean().optional(),
      backgroundColor: z.string().trim().max(24).optional(),
      textColor: z.string().trim().max(24).optional(),
      borderColor: z.string().trim().max(24).optional(),
      copyrightTemplate: z.string().trim().max(180).optional(),
      copyrightYear: z.string().trim().max(24).optional(),
      companyName: z.string().trim().max(100).optional(),
      developerCreditText: z.string().trim().max(100).optional(),
      developerCreditUrl: safeOptionalUrl,
      showAdminAccess: z.boolean().optional(),
      links: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(80),
            label: z.string().trim().min(1).max(60),
            url: safeRequiredUrl,
            openInNewTab: z.boolean(),
            isActive: z.boolean(),
            displayOrder: z.number().int().min(0).max(50),
          })
        )
        .max(12)
        .optional(),
    })
    .optional(),
  advanced: z
    .object({
      customCss: z.string().max(1500).optional(),
      showDividerAboveBottomBar: z.boolean().optional(),
      enableHoverAnimations: z.boolean().optional(),
      backToTopEnabled: z.boolean().optional(),
      notes: z.string().trim().max(600).optional(),
    })
    .optional(),
});

// Public: Resolved Published Footer
router.get(
  '/public',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const resolved = await resolvePublicFooter({
      isAuthenticated: Boolean(req.user),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(resolved);
  })
);

// Admin: Load Draft & Published Footer Config + Link Picker Resources + Store Payment Gateways
router.get(
  '/admin',
  requireAuth,
  requirePermission('cms:write'),
  asyncHandler(async (_req, res) => {
    const [doc, storeSettings, pages, categories, blogs] = await Promise.all([
      ensureDefaultFooterConfig(),
      StoreSettingsModel.findOne({ key: 'primary' }).select('paymentMethods storeName').lean(),
      StaticPageModel.find({ isPublished: true }).select('title slug pageType').sort({ title: 1 }).lean(),
      CategoryModel.find({ isActive: true }).select('name slug').sort({ displayOrder: 1 }).lean(),
      BlogPostModel.find({ status: 'published' }).select('title slug').sort({ publishedAt: -1 }).limit(30).lean(),
    ]);

    res.json({
      draft: normalizeFooterConfig(doc.draft),
      published: doc.published ? normalizeFooterConfig(doc.published) : null,
      status: doc.status,
      version: doc.version,
      publishedAt: doc.publishedAt || null,
      updatedAt: doc.updatedAt,
      updatedByName: doc.updatedByName || 'System',
      storePaymentMethods: storeSettings?.paymentMethods || [],
      resources: {
        pages,
        categories,
        blogs,
      },
    });
  })
);

// Admin: Save Draft (Does NOT update live storefront until published)
router.put(
  '/admin/draft',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = fullDraftUpdateSchema.parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const prevDraft = normalizeFooterConfig(doc.draft);

    const oldPublicIds = [
      prevDraft.brand.logoPublicId,
      prevDraft.brand.altLogoPublicId,
      ...(prevDraft.social.links || []).map((l) => l.iconImagePublicId || ''),
      ...(prevDraft.payments.badges || []).map((b) => b.iconImagePublicId || ''),
    ].filter(Boolean);

    const merged = normalizeFooterConfig({
      ...prevDraft,
      ...parsed,
      general: { ...prevDraft.general, ...(parsed.general || {}) },
      brand: { ...prevDraft.brand, ...(parsed.brand || {}) },
      columns: parsed.columns
        ? (parsed.columns as FooterColumnConfig[]).map((col, cIdx) => ({
            ...col,
            id: col.id || genId('col'),
            displayOrder: col.displayOrder ?? cIdx,
            iconSvg: sanitizeSvgMarkup(col.iconSvg),
            customStyleCss: sanitizeMenuCustomCss(col.customStyleCss),
            items: (col.items || []).map((item, iIdx) => ({
              ...item,
              id: item.id || genId('item'),
              displayOrder: item.displayOrder ?? iIdx,
              iconSvg: sanitizeSvgMarkup(item.iconSvg),
              children: (item.children || []).map((sub, sIdx) => ({
                ...sub,
                id: sub.id || genId('sub'),
                displayOrder: sub.displayOrder ?? sIdx,
              })),
            })),
          }))
        : prevDraft.columns,
      social: {
        ...prevDraft.social,
        ...(parsed.social || {}),
        links: parsed.social?.links
          ? (parsed.social.links as FooterSocialLinkConfig[]).map((l, idx) => ({
              ...l,
              id: l.id || genId('soc'),
              displayOrder: l.displayOrder ?? idx,
              iconSvg: sanitizeSvgMarkup(l.iconSvg),
            }))
          : prevDraft.social.links,
      },
      newsletter: { ...prevDraft.newsletter, ...(parsed.newsletter || {}) },
      payments: {
        ...prevDraft.payments,
        ...(parsed.payments || {}),
        badges: parsed.payments?.badges
          ? (parsed.payments.badges as FooterConfigPayload['payments']['badges'])
          : prevDraft.payments.badges,
      },
      trustBadges: {
        ...prevDraft.trustBadges,
        ...(parsed.trustBadges || {}),
        items: parsed.trustBadges?.items ?? prevDraft.trustBadges.items,
      },
      bottomBar: {
        ...prevDraft.bottomBar,
        ...(parsed.bottomBar || {}),
        links: parsed.bottomBar?.links ?? prevDraft.bottomBar.links,
      },
      advanced: { ...prevDraft.advanced, ...(parsed.advanced || {}) },
    });

    doc.draft = merged;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    const nextPublicIds = new Set(
      [
        merged.brand.logoPublicId,
        merged.brand.altLogoPublicId,
        ...(merged.social.links || []).map((l) => l.iconImagePublicId || ''),
        ...(merged.payments.badges || []).map((b) => b.iconImagePublicId || ''),
      ].filter(Boolean)
    );

    for (const oldId of oldPublicIds) {
      if (!nextPublicIds.has(oldId)) {
        await destroyCloudinaryAssetIfUnused(oldId);
      }
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'SAVE_FOOTER_DRAFT',
      resourceType: 'FooterConfig',
      resourceId: String(doc._id),
      details: { columnCount: merged.columns.length, layout: merged.general.layoutPreset },
      ipAddress: req.ip,
    });

    res.json({
      draft: merged,
      published: doc.published ? normalizeFooterConfig(doc.published) : null,
      status: doc.status,
      version: doc.version,
      publishedAt: doc.publishedAt || null,
      updatedAt: doc.updatedAt,
      updatedByName: doc.updatedByName,
    });
  })
);

// Admin: Publish Draft to Live Storefront
router.post(
  '/admin/publish',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const doc = await ensureDefaultFooterConfig();
    const candidate = req.body && Object.keys(req.body).length > 0
      ? normalizeFooterConfig(fullDraftUpdateSchema.parse(req.body) as Partial<typeof DEFAULT_FOOTER_CONFIG>)
      : normalizeFooterConfig(doc.draft);

    doc.draft = cloneFooterConfig(candidate);
    doc.published = cloneFooterConfig(candidate);
    doc.status = 'published';
    doc.version = (doc.version || 0) + 1;
    doc.publishedAt = new Date();
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    doc.markModified('published');
    await doc.save();

    await syncPublishedFooterToStoreSettings(candidate);
    invalidateFooterCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'PUBLISH_FOOTER_CONFIG',
      resourceType: 'FooterConfig',
      resourceId: String(doc._id),
      details: { version: doc.version, enabled: candidate.general.enabled },
      ipAddress: req.ip,
    });

    res.json({
      ok: true,
      draft: candidate,
      published: candidate,
      status: doc.status,
      version: doc.version,
      publishedAt: doc.publishedAt,
      updatedAt: doc.updatedAt,
    });
  })
);

// Admin: Reset Footer to Defaults (Draft, optionally Publish immediately)
router.post(
  '/admin/reset',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const publishImmediately = Boolean(req.body?.publish);
    const doc = await ensureDefaultFooterConfig();
    const defaults = cloneFooterConfig(DEFAULT_FOOTER_CONFIG);

    doc.draft = defaults;
    doc.markModified('draft');
    if (publishImmediately) {
      doc.published = cloneFooterConfig(defaults);
      doc.status = 'published';
      doc.version = (doc.version || 0) + 1;
      doc.publishedAt = new Date();
      doc.markModified('published');
      await syncPublishedFooterToStoreSettings(defaults);
      invalidateFooterCache();
    }
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    await doc.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'RESET_FOOTER_CONFIG',
      resourceType: 'FooterConfig',
      resourceId: String(doc._id),
      details: { publishImmediately },
      ipAddress: req.ip,
    });

    res.json({
      draft: defaults,
      published: doc.published ? normalizeFooterConfig(doc.published) : null,
      status: doc.status,
      version: doc.version,
      publishedAt: doc.publishedAt || null,
    });
  })
);

// Admin Columns CRUD + Duplicate + Reorder
router.post(
  '/admin/columns',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = columnSchema.parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);

    if (draft.columns.length >= 8) {
      res.status(400).json({ error: 'Maximum of 8 footer columns reached.' });
      return;
    }

    const newCol: FooterColumnConfig = {
      id: genId('col'),
      title: parsed.title,
      iconType: parsed.iconType,
      iconName: parsed.iconName,
      iconSvg: sanitizeSvgMarkup(parsed.iconSvg),
      iconImageUrl: parsed.iconImageUrl,
      iconColor: parsed.iconColor,
      description: parsed.description,
      isVisible: parsed.isVisible,
      isActive: parsed.isActive,
      displayOrder: draft.columns.length,
      width: parsed.width,
      customWidthPx: parsed.customWidthPx,
      alignment: parsed.alignment,
      customStyleCss: sanitizeMenuCustomCss(parsed.customStyleCss),
      items: (parsed.items || []).map((it, idx) => ({
        ...it,
        id: it.id || genId('item'),
        displayOrder: idx,
        iconSvg: sanitizeSvgMarkup(it.iconSvg),
        children: (it.children || []).map((sub, sIdx) => ({
          ...sub,
          id: sub.id || genId('sub'),
          displayOrder: sIdx,
        })),
      })),
    };

    draft.columns.push(newCol);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.status(201).json({ column: newCol, draft });
  })
);

router.patch(
  '/admin/columns/:columnId',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = toPatchSchema(columnSchema).parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);

    const idx = draft.columns.findIndex((c) => c.id === req.params.columnId);
    if (idx === -1) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }

    const existing = draft.columns[idx];
    const updated: FooterColumnConfig = {
      ...existing,
      ...parsed,
      iconSvg: parsed.iconSvg !== undefined ? sanitizeSvgMarkup(parsed.iconSvg) : existing.iconSvg,
      customStyleCss:
        parsed.customStyleCss !== undefined
          ? sanitizeMenuCustomCss(parsed.customStyleCss)
          : existing.customStyleCss,
      items: parsed.items ? (parsed.items as FooterMenuItemConfig[]) : existing.items,
    };

    draft.columns[idx] = updated;
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ column: updated, draft });
  })
);

router.delete(
  '/admin/columns/:columnId',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const nextCols = draft.columns.filter((c) => c.id !== req.params.columnId);
    if (nextCols.length === draft.columns.length) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }

    draft.columns = nextCols.map((c, idx) => ({ ...c, displayOrder: idx }));
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ draft });
  })
);

router.post(
  '/admin/columns/:columnId/duplicate',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    if (draft.columns.length >= 8) {
      res.status(400).json({ error: 'Maximum of 8 footer columns reached.' });
      return;
    }
    const source = draft.columns.find((c) => c.id === req.params.columnId);
    if (!source) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }

    const duplicated = duplicateFooterColumn(source, genId('col'), () => genId('item'));
    duplicated.displayOrder = draft.columns.length;
    draft.columns.push(duplicated);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.status(201).json({ column: duplicated, draft });
  })
);

router.put(
  '/admin/columns/reorder',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    draft.columns = reorderListByIds(draft.columns, orderedIds);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ draft });
  })
);

// Admin Menu Items inside Column CRUD + Reorder
router.post(
  '/admin/columns/:columnId/items',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = menuItemSchema.parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const col = draft.columns.find((c) => c.id === req.params.columnId);
    if (!col) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }
    if (col.items.length >= 20) {
      res.status(400).json({ error: 'Maximum 20 items per column.' });
      return;
    }

    const newItem: FooterMenuItemConfig = {
      id: genId('item'),
      label: parsed.label,
      iconType: parsed.iconType,
      iconName: parsed.iconName,
      iconSvg: sanitizeSvgMarkup(parsed.iconSvg),
      iconImageUrl: parsed.iconImageUrl,
      linkType: parsed.linkType,
      targetSlug: parsed.targetSlug,
      url: parsed.url,
      target: parsed.openInNewTab || parsed.target === '_blank' ? '_blank' : '_self',
      openInNewTab: Boolean(parsed.openInNewTab || parsed.target === '_blank'),
      displayOrder: col.items.length,
      isActive: parsed.isActive,
      visibility: parsed.visibility,
      description: parsed.description,
      badgeText: parsed.badgeText,
      children: (parsed.children || []).map((sub, idx) => ({
        ...sub,
        id: sub.id || genId('sub'),
        displayOrder: idx,
      })),
    };

    col.items.push(newItem);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.status(201).json({ item: newItem, draft });
  })
);

router.patch(
  '/admin/columns/:columnId/items/:itemId',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = toPatchSchema(menuItemSchema).parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const col = draft.columns.find((c) => c.id === req.params.columnId);
    if (!col) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }
    const idx = col.items.findIndex((it) => it.id === req.params.itemId);
    if (idx === -1) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }

    const existing = col.items[idx];
    const openBlank =
      parsed.openInNewTab !== undefined
        ? parsed.openInNewTab
        : parsed.target !== undefined
        ? parsed.target === '_blank'
        : existing.openInNewTab;

    const updated: FooterMenuItemConfig = {
      ...existing,
      ...parsed,
      openInNewTab: openBlank,
      target: openBlank ? '_blank' : '_self',
      iconSvg: parsed.iconSvg !== undefined ? sanitizeSvgMarkup(parsed.iconSvg) : existing.iconSvg,
      children: parsed.children
        ? parsed.children.map((sub, sIdx) => ({
            ...sub,
            id: sub.id || genId('sub'),
            displayOrder: sIdx,
          }))
        : existing.children,
    };

    col.items[idx] = updated;
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ item: updated, draft });
  })
);

router.delete(
  '/admin/columns/:columnId/items/:itemId',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const col = draft.columns.find((c) => c.id === req.params.columnId);
    if (!col) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }

    const nextItems = col.items.filter((it) => it.id !== req.params.itemId);
    if (nextItems.length === col.items.length) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }

    col.items = nextItems.map((it, idx) => ({ ...it, displayOrder: idx }));
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ draft });
  })
);

router.put(
  '/admin/columns/:columnId/items/reorder',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const col = draft.columns.find((c) => c.id === req.params.columnId);
    if (!col) {
      res.status(404).json({ error: 'Footer column not found.' });
      return;
    }

    col.items = reorderListByIds(col.items, orderedIds);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ draft });
  })
);

// Admin Social Media Links CRUD + Reorder
router.post(
  '/admin/social-links',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = socialLinkSchema.parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);

    const newLink: FooterSocialLinkConfig = {
      ...parsed,
      id: genId('soc'),
      iconSvg: sanitizeSvgMarkup(parsed.iconSvg),
      displayOrder: draft.social.links.length,
    };

    draft.social.links.push(newLink);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.status(201).json({ link: newLink, draft });
  })
);

router.patch(
  '/admin/social-links/:id',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = toPatchSchema(socialLinkSchema).parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const idx = draft.social.links.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Social link not found.' });
      return;
    }

    const prev = draft.social.links[idx];
    const updated: FooterSocialLinkConfig = {
      ...prev,
      ...parsed,
      iconSvg: parsed.iconSvg !== undefined ? sanitizeSvgMarkup(parsed.iconSvg) : prev.iconSvg,
    };

    draft.social.links[idx] = updated;
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    if (prev.iconImagePublicId && prev.iconImagePublicId !== updated.iconImagePublicId) {
      await destroyCloudinaryAssetIfUnused(prev.iconImagePublicId);
    }

    res.json({ link: updated, draft });
  })
);

router.delete(
  '/admin/social-links/:id',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    const target = draft.social.links.find((l) => l.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Social link not found.' });
      return;
    }

    draft.social.links = draft.social.links
      .filter((l) => l.id !== req.params.id)
      .map((l, idx) => ({ ...l, displayOrder: idx }));
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    if (target.iconImagePublicId) {
      await destroyCloudinaryAssetIfUnused(target.iconImagePublicId);
    }

    res.json({ draft });
  })
);

router.put(
  '/admin/social-links/reorder',
  requireAuth,
  requirePermission('cms:write'),
  adminWriteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const doc = await ensureDefaultFooterConfig();
    const draft = normalizeFooterConfig(doc.draft);
    draft.social.links = reorderListByIds(draft.social.links, orderedIds);
    doc.draft = draft;
    doc.updatedBy = req.user!._id;
    doc.updatedByName = req.user!.name;
    doc.markModified('draft');
    await doc.save();

    res.json({ draft });
  })
);

export default router;
