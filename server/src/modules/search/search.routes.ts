import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_RELEVANCE_WEIGHTS,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SUGGESTIONS_UI_CONFIG,
  normalizeSearchText,
  sanitizeEngineConfig,
  sanitizePlaceholderAnimationConfig,
} from '../../../../shared/searchHelpers.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  optionalAuth,
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { userHasEffectivePermission } from '../../services/rbac.service.ts';
import { toPatchSchema } from '../../utils/zodPartial.ts';
import { SearchAnalyticsModel } from '../catalog/catalog.model.ts';
import { invalidateSearchCache } from './search.cache.ts';
import {
  SearchConfigModel,
  SearchPlaceholderModel,
  SearchSynonymModel,
} from './search.model.ts';
import {
  ensureDefaultSearchDocuments,
  executeSmartSearch,
  getPublicSearchConfig,
} from './search.service.ts';

const router = Router();
router.use(requireDatabase);

const publicSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests. Please wait a moment and try again.' },
});

const engineConfigSchema = z.object({
  smartSearchEnabled: z.boolean().default(DEFAULT_SEARCH_ENGINE_CONFIG.smartSearchEnabled),
  crossLanguageEnabled: z.boolean().default(DEFAULT_SEARCH_ENGINE_CONFIG.crossLanguageEnabled),
  synonymMatchingEnabled: z.boolean().default(DEFAULT_SEARCH_ENGINE_CONFIG.synonymMatchingEnabled),
  transliterationEnabled: z.boolean().default(DEFAULT_SEARCH_ENGINE_CONFIG.transliterationEnabled),
  minQueryLength: z.number().int().min(1).max(5).default(DEFAULT_SEARCH_ENGINE_CONFIG.minQueryLength),
  debounceMs: z.number().int().min(80).max(1000).default(DEFAULT_SEARCH_ENGINE_CONFIG.debounceMs),
  maxSuggestions: z.number().int().min(1).max(15).default(DEFAULT_SEARCH_ENGINE_CONFIG.maxSuggestions),
  dropdownMaxHeightPx: z.number().int().min(200).max(720).default(DEFAULT_SEARCH_ENGINE_CONFIG.dropdownMaxHeightPx),
  outOfStockBehavior: z.enum(['show', 'demote', 'hide']).default(DEFAULT_SEARCH_ENGINE_CONFIG.outOfStockBehavior),
  relevanceWeights: z
    .object({
      exactTitle: z.number().int().min(100).max(3000).default(DEFAULT_RELEVANCE_WEIGHTS.exactTitle),
      exactSku: z.number().int().min(100).max(3000).default(DEFAULT_RELEVANCE_WEIGHTS.exactSku),
      titleKeyword: z.number().int().min(50).max(2000).default(DEFAULT_RELEVANCE_WEIGHTS.titleKeyword),
      brand: z.number().int().min(50).max(1500).default(DEFAULT_RELEVANCE_WEIGHTS.brand),
      category: z.number().int().min(50).max(1500).default(DEFAULT_RELEVANCE_WEIGHTS.category),
      tags: z.number().int().min(20).max(1200).default(DEFAULT_RELEVANCE_WEIGHTS.tags),
      attribute: z.number().int().min(20).max(1000).default(DEFAULT_RELEVANCE_WEIGHTS.attribute),
      description: z.number().int().min(10).max(800).default(DEFAULT_RELEVANCE_WEIGHTS.description),
      synonymTranslit: z.number().int().min(20).max(1000).default(DEFAULT_RELEVANCE_WEIGHTS.synonymTranslit),
    })
    .default(DEFAULT_RELEVANCE_WEIGHTS),
});

const placeholderAnimationSchema = z.object({
  enabled: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.enabled),
  typingSpeedMs: z.number().int().min(15).max(300).default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.typingSpeedMs),
  erasingSpeedMs: z.number().int().min(10).max(250).default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.erasingSpeedMs),
  pauseAfterCompleteMs: z
    .number()
    .int()
    .min(300)
    .max(8000)
    .default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.pauseAfterCompleteMs),
  delayBeforeNextMs: z
    .number()
    .int()
    .min(100)
    .max(4000)
    .default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.delayBeforeNextMs),
  startDelayMs: z.number().int().min(0).max(3000).default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.startDelayMs),
  loop: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.loop),
  showCursor: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.showCursor),
  cursorChar: z.string().trim().min(1).max(2).default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.cursorChar),
  cursorBlinkSpeedMs: z
    .number()
    .int()
    .min(200)
    .max(1500)
    .default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.cursorBlinkSpeedMs),
  transitionBehavior: z
    .enum(['type_and_erase', 'fade_cycle', 'instant_cycle'])
    .default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.transitionBehavior),
  pauseOnFocus: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.pauseOnFocus),
  resumeOnBlur: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.resumeOnBlur),
  desktopEnabled: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.desktopEnabled),
  mobileEnabled: z.boolean().default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.mobileEnabled),
  fallbackStaticText: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .default(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.fallbackStaticText),
});

const suggestionsUiSchema = z.object({
  showThumbnails: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showThumbnails),
  showBrand: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showBrand),
  showCategory: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showCategory),
  showPrice: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showPrice),
  showStockStatus: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showStockStatus),
  showPopularWhenEmpty: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showPopularWhenEmpty),
  highlightMatches: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.highlightMatches),
  showMatchedFieldHint: z.boolean().default(DEFAULT_SUGGESTIONS_UI_CONFIG.showMatchedFieldHint),
});

const placeholderItemSchema = z.object({
  text: z.string().trim().min(2).max(140),
  language: z.enum(['bn', 'en', 'mixed']).default('mixed'),
  isEnabled: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(500).optional(),
  deviceScope: z.enum(['all', 'desktop', 'mobile']).default('all'),
  notes: z.string().trim().max(200).optional().default(''),
});

const synonymItemSchema = z.object({
  primaryTerm: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
  languagePair: z.string().trim().max(20).optional().default('bn-en'),
  categoryHint: z.string().trim().max(80).optional().default(''),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(80),
});

// Public: Dynamic Search & Animated Placeholder Configuration
router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const config = await getPublicSearchConfig();
    res.json(config);
  })
);

// Public: Smart Cross-Language Live Autocomplete Suggestions
router.get(
  '/suggestions',
  publicSearchLimiter,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
    const requestedLimit = Number(req.query.limit || 0);
    const config = await getPublicSearchConfig();

    const result = await executeSmartSearch({
      q,
      mode: 'suggestions',
      limit: requestedLimit > 0 ? requestedLimit : config.engine.maxSuggestions,
      logAnalytics: false,
    });

    res.json({
      suggestions: result.suggestions,
      popularSearches: result.popularSearches,
      total: result.total,
      queryMeta: result.queryMeta,
      ui: {
        dropdownMaxHeightPx: config.engine.dropdownMaxHeightPx,
        suggestionsUi: config.suggestionsUi,
      },
    });
  })
);

// Public: Full Cross-Language Product Search Results
router.get(
  '/products',
  publicSearchLimiter,
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(48, Math.max(1, Number(req.query.limit || 20)));
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
    const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const brandSlug = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const minPrice =
      req.query.minPrice !== undefined && req.query.minPrice !== '' ? Number(req.query.minPrice) : null;
    const maxPrice =
      req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : null;
    const minRating =
      req.query.minRating !== undefined && req.query.minRating !== '' ? Number(req.query.minRating) : null;
    const inStockOnly = req.query.inStock === 'true';
    const onSaleOnly = req.query.onSale === 'true';
    const featuredOnly = req.query.featured === 'true';
    const topRatedOnly = req.query.topRated === 'true';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'relevance';
    const includeAllStatus =
      req.query.includeAll === 'true' &&
      (await userHasEffectivePermission(req.user, 'catalog:read'));

    const result = await executeSmartSearch({
      q,
      mode: 'products',
      page,
      limit,
      categorySlug,
      brandSlug,
      minPrice,
      maxPrice,
      minRating,
      inStockOnly,
      onSaleOnly,
      featuredOnly,
      topRatedOnly,
      sort,
      includeAllStatus,
      logAnalytics: true,
    });

    res.json({
      products: result.products,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      queryMeta: result.queryMeta,
    });
  })
);

// Public: Lightweight search-click and conversion analytics telemetry
router.post(
  '/track-click',
  publicSearchLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      query: z.string().trim().min(1).max(120),
      productId: z
        .string()
        .trim()
        .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid productId')
        .optional(),
    });
    const parsed = schema.parse(req.body);
    const normalizedQuery = normalizeSearchText(parsed.query).slice(0, 120);
    if (!normalizedQuery) {
      res.json({ ok: true });
      return;
    }

    await SearchAnalyticsModel.findOneAndUpdate(
      { normalizedQuery },
      {
        $setOnInsert: { query: parsed.query, resultCount: 1 },
        $set: {
          lastSearchedAt: new Date(),
          ...(parsed.productId ? { lastClickedProductId: new mongoose.Types.ObjectId(parsed.productId) } : {}),
        },
        $inc: { clickCount: 1 },
      },
      { upsert: true }
    ).catch(() => {});

    res.json({ ok: true });
  })
);

router.post(
  '/track-conversion',
  publicSearchLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      query: z.string().trim().min(1).max(120),
    });
    const parsed = schema.parse(req.body);
    const normalizedQuery = normalizeSearchText(parsed.query).slice(0, 120);
    if (!normalizedQuery) {
      res.json({ ok: true });
      return;
    }

    await SearchAnalyticsModel.findOneAndUpdate(
      { normalizedQuery },
      {
        $inc: { conversionCount: 1 },
      }
    ).catch(() => {});

    res.json({ ok: true });
  })
);

// ==========================================
// ADMIN ROUTES: Search Settings, Placeholders, Synonyms & Analytics
// ==========================================

router.get(
  '/admin/settings',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (_req, res) => {
    await ensureDefaultSearchDocuments();
    const config = await SearchConfigModel.findOne({ key: 'primary' }).lean();
    res.json({
      settings: {
        engine: sanitizeEngineConfig(config?.engine as Partial<typeof DEFAULT_SEARCH_ENGINE_CONFIG>),
        placeholderAnimation: sanitizePlaceholderAnimationConfig(
          config?.placeholderAnimation as Partial<typeof DEFAULT_PLACEHOLDER_ANIMATION_CONFIG>
        ),
        suggestionsUi: {
          ...DEFAULT_SUGGESTIONS_UI_CONFIG,
          ...((config?.suggestionsUi as Record<string, boolean>) || {}),
        },
        updatedByName: config?.updatedByName || '',
        updatedAt: config?.updatedAt || null,
      },
    });
  })
);

router.put(
  '/admin/settings',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await ensureDefaultSearchDocuments();
    const payloadSchema = z.object({
      engine: engineConfigSchema.optional(),
      placeholderAnimation: placeholderAnimationSchema.optional(),
      suggestionsUi: suggestionsUiSchema.optional(),
    });
    const parsed = payloadSchema.parse(req.body);

    const doc = await SearchConfigModel.findOne({ key: 'primary' });
    if (!doc) {
      res.status(404).json({ error: 'Search configuration not initialized.' });
      return;
    }

    if (parsed.engine) doc.engine = parsed.engine;
    if (parsed.placeholderAnimation) doc.placeholderAnimation = parsed.placeholderAnimation;
    if (parsed.suggestionsUi) doc.suggestionsUi = parsed.suggestionsUi;
    doc.updatedByName = req.user!.name;
    await doc.save();

    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_SEARCH_SETTINGS',
      resourceType: 'SearchConfig',
      resourceId: String(doc._id),
      details: {
        smartSearchEnabled: doc.engine.smartSearchEnabled,
        animationEnabled: doc.placeholderAnimation.enabled,
      },
      ipAddress: req.ip,
    });

    res.json({
      settings: {
        engine: doc.engine,
        placeholderAnimation: doc.placeholderAnimation,
        suggestionsUi: doc.suggestionsUi,
        updatedByName: doc.updatedByName,
        updatedAt: doc.updatedAt,
      },
    });
  })
);

// Placeholders CRUD + Reordering
router.get(
  '/admin/placeholders',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (_req, res) => {
    await ensureDefaultSearchDocuments();
    const placeholders = await SearchPlaceholderModel.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ placeholders });
  })
);

router.post(
  '/admin/placeholders',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = placeholderItemSchema.parse(req.body);
    const total = await SearchPlaceholderModel.countDocuments();
    const created = await SearchPlaceholderModel.create({
      ...parsed,
      displayOrder: parsed.displayOrder ?? total,
    });
    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_SEARCH_PLACEHOLDER',
      resourceType: 'SearchPlaceholder',
      resourceId: String(created._id),
      details: { text: created.text, language: created.language, deviceScope: created.deviceScope },
      ipAddress: req.ip,
    });

    res.status(201).json({ placeholder: created });
  })
);

router.put(
  '/admin/placeholders/reorder',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      orderedIds: z
        .array(z.string().trim().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid ID'))
        .min(1)
        .max(200),
    });
    const parsed = schema.parse(req.body);

    await Promise.all(
      parsed.orderedIds.map((id, idx) =>
        SearchPlaceholderModel.updateOne({ _id: id }, { $set: { displayOrder: idx } })
      )
    );
    invalidateSearchCache();

    const placeholders = await SearchPlaceholderModel.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'REORDER_SEARCH_PLACEHOLDERS',
      resourceType: 'SearchPlaceholder',
      details: { count: parsed.orderedIds.length },
      ipAddress: req.ip,
    });

    res.json({ placeholders });
  })
);

router.patch(
  '/admin/placeholders/:id',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid placeholder ID.' });
      return;
    }
    const parsed = toPatchSchema(placeholderItemSchema).parse(req.body);
    const updated = await SearchPlaceholderModel.findByIdAndUpdate(
      req.params.id,
      { $set: parsed },
      { new: true, runValidators: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Placeholder not found.' });
      return;
    }

    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_SEARCH_PLACEHOLDER',
      resourceType: 'SearchPlaceholder',
      resourceId: String(updated._id),
      details: { text: updated.text, isEnabled: updated.isEnabled },
      ipAddress: req.ip,
    });

    res.json({ placeholder: updated });
  })
);

router.delete(
  '/admin/placeholders/:id',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid placeholder ID.' });
      return;
    }
    const deleted = await SearchPlaceholderModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Placeholder not found.' });
      return;
    }
    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_SEARCH_PLACEHOLDER',
      resourceType: 'SearchPlaceholder',
      resourceId: req.params.id,
      details: { text: deleted.text },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// Synonyms CRUD
router.get(
  '/admin/synonyms',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (_req, res) => {
    await ensureDefaultSearchDocuments();
    const synonyms = await SearchSynonymModel.find()
      .sort({ priority: -1, primaryTerm: 1 })
      .lean();
    res.json({ synonyms });
  })
);

router.post(
  '/admin/synonyms',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = synonymItemSchema.parse(req.body);
    const normalizedPrimary = normalizeSearchText(parsed.primaryTerm);
    if (!normalizedPrimary) {
      res.status(400).json({ error: 'Primary term cannot be empty.' });
      return;
    }
    const duplicate = await SearchSynonymModel.exists({ normalizedPrimary });
    if (duplicate) {
      res.status(409).json({ error: `Synonym group for "${parsed.primaryTerm}" already exists.` });
      return;
    }

    const cleanAliases = Array.from(
      new Set(parsed.aliases.map((a) => a.trim()).filter(Boolean))
    );

    const created = await SearchSynonymModel.create({
      primaryTerm: parsed.primaryTerm,
      normalizedPrimary,
      aliases: cleanAliases,
      languagePair: parsed.languagePair,
      categoryHint: parsed.categoryHint,
      isActive: parsed.isActive,
      priority: parsed.priority,
    });
    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_SEARCH_SYNONYM',
      resourceType: 'SearchSynonym',
      resourceId: String(created._id),
      details: { primaryTerm: created.primaryTerm, aliasesCount: created.aliases.length },
      ipAddress: req.ip,
    });

    res.status(201).json({ synonym: created });
  })
);

router.patch(
  '/admin/synonyms/:id',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid synonym ID.' });
      return;
    }
    const parsed = toPatchSchema(synonymItemSchema).parse(req.body);
    const updates: Record<string, unknown> = { ...parsed };
    if (parsed.primaryTerm) {
      const normalizedPrimary = normalizeSearchText(parsed.primaryTerm);
      if (!normalizedPrimary) {
        res.status(400).json({ error: 'Primary term cannot be empty.' });
        return;
      }
      const conflict = await SearchSynonymModel.exists({
        normalizedPrimary,
        _id: { $ne: req.params.id },
      });
      if (conflict) {
        res.status(409).json({ error: `Synonym group for "${parsed.primaryTerm}" already exists.` });
        return;
      }
      updates.normalizedPrimary = normalizedPrimary;
    }
    if (parsed.aliases) {
      updates.aliases = Array.from(
        new Set(parsed.aliases.map((a) => a.trim()).filter(Boolean))
      );
    }

    const updated = await SearchSynonymModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Synonym group not found.' });
      return;
    }

    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_SEARCH_SYNONYM',
      resourceType: 'SearchSynonym',
      resourceId: String(updated._id),
      details: { primaryTerm: updated.primaryTerm, isActive: updated.isActive },
      ipAddress: req.ip,
    });

    res.json({ synonym: updated });
  })
);

router.delete(
  '/admin/synonyms/:id',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid synonym ID.' });
      return;
    }
    const deleted = await SearchSynonymModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Synonym group not found.' });
      return;
    }
    invalidateSearchCache();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_SEARCH_SYNONYM',
      resourceType: 'SearchSynonym',
      resourceId: req.params.id,
      details: { primaryTerm: deleted.primaryTerm },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// Search Analytics Reporting
router.get(
  '/admin/analytics',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (_req, res) => {
    const [topQueries, zeroResultQueries, totalsAgg, langAgg] = await Promise.all([
      SearchAnalyticsModel.find()
        .sort({ searchCount: -1, lastSearchedAt: -1 })
        .limit(20)
        .lean(),
      SearchAnalyticsModel.find({
        $or: [{ resultCount: 0 }, { zeroResultCount: { $gt: 0 } }],
      })
        .sort({ zeroResultCount: -1, searchCount: -1 })
        .limit(20)
        .lean(),
      SearchAnalyticsModel.aggregate<{
        _id: null;
        totalSearches: number;
        totalClicks: number;
        totalConversions: number;
        totalZeroResults: number;
        uniqueQueries: number;
      }>([
        {
          $group: {
            _id: null,
            totalSearches: { $sum: '$searchCount' },
            totalClicks: { $sum: { $ifNull: ['$clickCount', 0] } },
            totalConversions: { $sum: { $ifNull: ['$conversionCount', 0] } },
            totalZeroResults: { $sum: { $ifNull: ['$zeroResultCount', 0] } },
            uniqueQueries: { $sum: 1 },
          },
        },
      ]),
      SearchAnalyticsModel.aggregate<{
        _id: 'bn' | 'en' | 'mixed';
        count: number;
      }>([
        {
          $group: {
            _id: { $ifNull: ['$language', 'en'] },
            count: { $sum: '$searchCount' },
          },
        },
      ]),
    ]);

    const totals = totalsAgg[0] || {
      totalSearches: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalZeroResults: 0,
      uniqueQueries: 0,
    };

    const languageBreakdown: Record<'bn' | 'en' | 'mixed', number> = {
      bn: 0,
      en: 0,
      mixed: 0,
    };
    for (const row of langAgg) {
      if (row._id === 'bn' || row._id === 'en' || row._id === 'mixed') {
        languageBreakdown[row._id] = row.count;
      }
    }

    res.json({
      summary: {
        ...totals,
        ctrPercent:
          totals.totalSearches > 0
            ? Number(((totals.totalClicks / totals.totalSearches) * 100).toFixed(1))
            : 0,
        conversionPercent:
          totals.totalClicks > 0
            ? Number(((totals.totalConversions / totals.totalClicks) * 100).toFixed(1))
            : 0,
      },
      languageBreakdown,
      topQueries,
      zeroResultQueries,
    });
  })
);

export default router;
