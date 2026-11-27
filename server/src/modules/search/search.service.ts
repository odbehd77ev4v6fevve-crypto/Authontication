import mongoose from 'mongoose';
import { resolveEffectiveUnitPrice } from '../../../../shared/pricing.ts';
import {
  buildExpandedQuery,
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SEED_PLACEHOLDERS,
  DEFAULT_SEED_SYNONYMS,
  DEFAULT_SUGGESTIONS_UI_CONFIG,
  normalizeSearchText,
  sanitizeEngineConfig,
  sanitizePlaceholderAnimationConfig,
  scoreProductMatch,
  type PublicSearchConfig,
  type SearchEngineConfig,
  type SearchPlaceholderMessageItem,
  type SearchSynonymEntry,
  type SearchableProductInput,
} from '../../../../shared/searchHelpers.ts';
import { escapeRegex } from '../../../../shared/security.ts';
import { calculateAvailableProductStock } from '../../../../shared/wishlistHelpers.ts';
import {
  BrandModel,
  CategoryModel,
  ProductModel,
  SearchAnalyticsModel,
} from '../catalog/catalog.model.ts';
import {
  getCachedSearch,
  getSearchCacheKey,
  getSuggestionsTtlMs,
  invalidateSearchCache,
  setCachedSearch,
} from './search.cache.ts';
import {
  SearchConfigModel,
  SearchPlaceholderModel,
  SearchSynonymModel,
} from './search.model.ts';

export function formatSearchProductForStorefront(
  product: Record<string, unknown>
): Record<string, unknown> {
  const now = new Date();
  const basePrice = Number(product.basePrice || 0);
  const pricing = resolveEffectiveUnitPrice(
    {
      basePrice,
      salePrice: product.salePrice as number | null | undefined,
      flashSalePrice: product.flashSalePrice as number | null | undefined,
      flashSaleStart: product.flashSaleStart as Date | null | undefined,
      flashSaleEnd: product.flashSaleEnd as Date | null | undefined,
    },
    now
  );

  const variants = Array.isArray(product.variants)
    ? (product.variants as Array<{ isActive?: boolean; stockOnHand?: number; reservedStock?: number }>)
    : [];
  const totalAvailable = calculateAvailableProductStock({
    stockOnHand: Number(product.stockOnHand || 0),
    reservedStock: Number(product.reservedStock || 0),
    variants,
  });

  return {
    ...product,
    effectivePrice: pricing.unitPrice,
    originalPrice: pricing.originalPrice,
    discountPercent: pricing.discountPercent,
    isFlashSaleActive: pricing.isFlashSaleActive,
    availableStock: totalAvailable,
  };
}

export async function ensureDefaultSearchDocuments(): Promise<void> {
  const existingConfig = await SearchConfigModel.findOne({ key: 'primary' }).lean();
  if (!existingConfig) {
    await SearchConfigModel.create({
      key: 'primary',
      engine: DEFAULT_SEARCH_ENGINE_CONFIG,
      placeholderAnimation: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
      suggestionsUi: DEFAULT_SUGGESTIONS_UI_CONFIG,
      updatedByName: 'System Seed',
    });
  }

  const placeholderCount = await SearchPlaceholderModel.countDocuments();
  if (placeholderCount === 0) {
    await SearchPlaceholderModel.insertMany(
      DEFAULT_SEED_PLACEHOLDERS.map((item, idx) => ({
        text: item.text,
        language: item.language,
        isEnabled: item.isEnabled,
        displayOrder: item.displayOrder ?? idx,
        deviceScope: item.deviceScope,
        notes: item.notes || '',
      }))
    );
  }

  const synonymCount = await SearchSynonymModel.countDocuments();
  if (synonymCount === 0) {
    await SearchSynonymModel.insertMany(
      DEFAULT_SEED_SYNONYMS.map((item) => ({
        primaryTerm: item.primaryTerm,
        normalizedPrimary: normalizeSearchText(item.primaryTerm),
        aliases: item.aliases,
        languagePair: item.languagePair || 'bn-en',
        categoryHint: item.categoryHint || '',
        isActive: item.isActive,
        priority: item.priority ?? 80,
      }))
    );
  }
}

export async function getPublicSearchConfig(): Promise<PublicSearchConfig> {
  const cacheKey = getSearchCacheKey('public_config');
  const cached = getCachedSearch<PublicSearchConfig>(cacheKey);
  if (cached) return cached;

  const [configDoc, placeholderDocs] = await Promise.all([
    SearchConfigModel.findOne({ key: 'primary' }).lean(),
    SearchPlaceholderModel.find({ isEnabled: true }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
  ]);

  const payload: PublicSearchConfig = {
    engine: sanitizeEngineConfig(configDoc?.engine as Partial<SearchEngineConfig> | undefined),
    placeholderAnimation: sanitizePlaceholderAnimationConfig(
      configDoc?.placeholderAnimation as Partial<PublicSearchConfig['placeholderAnimation']> | undefined
    ),
    suggestionsUi: {
      ...DEFAULT_SUGGESTIONS_UI_CONFIG,
      ...((configDoc?.suggestionsUi as Record<string, boolean> | undefined) || {}),
    },
    placeholders: (placeholderDocs || []).map((p) => ({
      _id: String(p._id),
      text: p.text,
      language: p.language,
      isEnabled: p.isEnabled,
      displayOrder: p.displayOrder,
      deviceScope: p.deviceScope,
      notes: p.notes || '',
    })) as SearchPlaceholderMessageItem[],
  };

  setCachedSearch(cacheKey, payload);
  return payload;
}

export async function getActiveSynonyms(): Promise<SearchSynonymEntry[]> {
  const cacheKey = getSearchCacheKey('active_synonyms');
  const cached = getCachedSearch<SearchSynonymEntry[]>(cacheKey);
  if (cached) return cached;

  const docs = await SearchSynonymModel.find({ isActive: true })
    .sort({ priority: -1, primaryTerm: 1 })
    .lean();

  const list: SearchSynonymEntry[] =
    docs.length > 0
      ? docs.map((d) => ({
          _id: String(d._id),
          primaryTerm: d.primaryTerm,
          aliases: d.aliases || [],
          languagePair: d.languagePair,
          categoryHint: d.categoryHint,
          isActive: d.isActive,
          priority: d.priority,
        }))
      : DEFAULT_SEED_SYNONYMS;

  setCachedSearch(cacheKey, list);
  return list;
}

export interface SmartSearchParams {
  q: string;
  mode: 'suggestions' | 'products';
  page?: number;
  limit?: number;
  categorySlug?: string;
  brandSlug?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  featuredOnly?: boolean;
  topRatedOnly?: boolean;
  sort?: string;
  includeAllStatus?: boolean;
  logAnalytics?: boolean;
}

export interface SearchSuggestionPayloadItem {
  id: string;
  name: string;
  nameBn?: string;
  slug: string;
  sku: string;
  imageUrl: string;
  brandName?: string;
  categoryName?: string;
  effectivePrice: number;
  originalPrice: number | null;
  discountPercent: number;
  availableStock: number;
  inStock: boolean;
  allowBackorders: boolean;
  matchedField: string;
  matchedText: string;
  matchedVia: string;
  relevanceScore: number;
}

export interface SmartSearchResult {
  products: Array<Record<string, unknown>>;
  suggestions: SearchSuggestionPayloadItem[];
  popularSearches: string[];
  total: number;
  page: number;
  totalPages: number;
  queryMeta: {
    raw: string;
    normalized: string;
    language: 'bn' | 'en' | 'mixed';
    expandedTerms: string[];
    crossLanguageApplied: boolean;
  };
}

export async function getPopularSearches(limit = 6): Promise<string[]> {
  const cacheKey = getSearchCacheKey('popular', String(limit));
  const cached = getCachedSearch<string[]>(cacheKey);
  if (cached) return cached;

  const popular = await SearchAnalyticsModel.find({ resultCount: { $gt: 0 } })
    .sort({ searchCount: -1 })
    .limit(limit)
    .select('query')
    .lean();

  const terms = popular.map((p) => p.query).filter(Boolean);
  setCachedSearch(cacheKey, terms, getSuggestionsTtlMs());
  return terms;
}

export async function recordSearchAnalytics(
  rawQuery: string,
  language: 'bn' | 'en' | 'mixed',
  resultCount: number
): Promise<void> {
  const trimmed = rawQuery.trim().slice(0, 120);
  const normalizedQuery = normalizeSearchText(trimmed).slice(0, 120);
  if (!normalizedQuery) return;

  await SearchAnalyticsModel.findOneAndUpdate(
    { normalizedQuery },
    {
      $set: {
        query: trimmed,
        language,
        resultCount,
        lastSearchedAt: new Date(),
      },
      $inc: {
        searchCount: 1,
        ...(resultCount === 0 ? { zeroResultCount: 1 } : {}),
      },
    },
    { upsert: true }
  ).catch(() => {});
}

export async function executeSmartSearch(params: SmartSearchParams): Promise<SmartSearchResult> {
  const q = (params.q || '').trim();
  const mode = params.mode;
  const page = Math.max(1, params.page || 1);

  const [publicConfig, synonyms] = await Promise.all([
    getPublicSearchConfig(),
    getActiveSynonyms(),
  ]);

  const engine = publicConfig.engine;
  const effectiveLimit =
    mode === 'suggestions'
      ? Math.min(15, Math.max(1, params.limit || engine.maxSuggestions || 8))
      : Math.min(48, Math.max(1, params.limit || 20));

  if (!q || q.length < (mode === 'suggestions' ? engine.minQueryLength : 1)) {
    const popularSearches =
      mode === 'suggestions' ? await getPopularSearches(6) : [];
    return {
      products: [],
      suggestions: [],
      popularSearches,
      total: 0,
      page,
      totalPages: 0,
      queryMeta: {
        raw: q,
        normalized: normalizeSearchText(q),
        language: 'en',
        expandedTerms: [],
        crossLanguageApplied: false,
      },
    };
  }

  // Check suggestion cache when mode === 'suggestions' and no category/brand overrides
  const suggestionCacheKey =
    mode === 'suggestions' && !params.categorySlug && !params.brandSlug && !params.includeAllStatus
      ? getSearchCacheKey('suggestions', `${normalizeSearchText(q)}:${effectiveLimit}`)
      : '';
  if (suggestionCacheKey) {
    const cached = getCachedSearch<SmartSearchResult>(suggestionCacheKey);
    if (cached) return cached;
  }

  const expanded = engine.smartSearchEnabled
    ? buildExpandedQuery(q, synonyms, {
        crossLanguageEnabled: engine.crossLanguageEnabled,
        synonymMatchingEnabled: engine.synonymMatchingEnabled,
        transliterationEnabled: engine.transliterationEnabled,
      })
    : buildExpandedQuery(q, [], {
        crossLanguageEnabled: false,
        synonymMatchingEnabled: false,
        transliterationEnabled: false,
      });

  const candidateTerms = expanded.allCandidateTerms.filter(Boolean);
  const candidateRegexes = candidateTerms
    .filter((t) => t.length >= 2 || expanded.normalized.length === 1)
    .slice(0, 28)
    .map((t) => new RegExp(escapeRegex(t), 'i'));

  // Resolve Category & Brand filters (route/query filters) + candidate semantic Category/Brand matches
  const [explicitCategory, explicitBrand, matchedCategories, matchedBrands] = await Promise.all([
    params.categorySlug
      ? CategoryModel.findOne({ slug: params.categorySlug }).lean()
      : Promise.resolve(null),
    params.brandSlug
      ? BrandModel.findOne({ slug: params.brandSlug }).lean()
      : Promise.resolve(null),
    candidateRegexes.length > 0
      ? CategoryModel.find({
          isActive: true,
          $or: candidateRegexes.flatMap((regex) => [{ name: regex }, { nameBn: regex }]),
        })
          .select('_id')
          .lean()
      : Promise.resolve([]),
    candidateRegexes.length > 0
      ? BrandModel.find({
          isActive: true,
          $or: candidateRegexes.map((regex) => ({ name: regex })),
        })
          .select('_id')
          .lean()
      : Promise.resolve([]),
  ]);

  if (params.categorySlug && !explicitCategory) {
    return {
      products: [],
      suggestions: [],
      popularSearches: [],
      total: 0,
      page,
      totalPages: 0,
      queryMeta: {
        raw: q,
        normalized: expanded.normalized,
        language: expanded.language,
        expandedTerms: expanded.synonymTerms.slice(0, 12),
        crossLanguageApplied: expanded.synonymTerms.length > 0 || expanded.transliteratedTerms.length > 0,
      },
    };
  }

  if (params.brandSlug && !explicitBrand) {
    return {
      products: [],
      suggestions: [],
      popularSearches: [],
      total: 0,
      page,
      totalPages: 0,
      queryMeta: {
        raw: q,
        normalized: expanded.normalized,
        language: expanded.language,
        expandedTerms: expanded.synonymTerms.slice(0, 12),
        crossLanguageApplied: expanded.synonymTerms.length > 0 || expanded.transliteratedTerms.length > 0,
      },
    };
  }

  const baseFilter: Record<string, unknown> = params.includeAllStatus
    ? {}
    : { status: 'published' };
  const andClauses: Record<string, unknown>[] = [];

  if (explicitCategory) {
    const subCats = await CategoryModel.find({ parentId: explicitCategory._id })
      .select('_id')
      .lean();
    const catIds = [explicitCategory._id, ...subCats.map((c) => c._id)];
    andClauses.push({
      $or: [{ categoryId: { $in: catIds } }, { subcategoryId: { $in: catIds } }],
    });
  }

  if (explicitBrand) {
    baseFilter.brandId = explicitBrand._id;
  }

  if (params.minRating !== null && params.minRating !== undefined && Number.isFinite(params.minRating)) {
    baseFilter.ratingAverage = { $gte: params.minRating };
  }
  if (params.featuredOnly) baseFilter.isFeatured = true;
  if (params.topRatedOnly) baseFilter.ratingCount = { $gt: 0 };

  const semanticOrClauses: Record<string, unknown>[] = [];
  for (const regex of candidateRegexes) {
    semanticOrClauses.push(
      { name: regex },
      { nameBn: regex },
      { sku: regex },
      { barcode: regex },
      { shortDescription: regex },
      { description: regex },
      { features: regex },
      { bilingualKeywords: regex },
      { metaKeywords: regex },
      { 'variants.sku': regex },
      { 'variants.title': regex },
      { 'specificationGroups.items.value': regex },
      { 'specificationGroups.items.label': regex }
    );
  }
  if (matchedCategories.length > 0) {
    const catIds = matchedCategories.map((c) => c._id);
    semanticOrClauses.push(
      { categoryId: { $in: catIds } },
      { subcategoryId: { $in: catIds } }
    );
  }
  if (matchedBrands.length > 0) {
    semanticOrClauses.push({ brandId: { $in: matchedBrands.map((b) => b._id) } });
  }

  if (semanticOrClauses.length > 0) {
    andClauses.push({ $or: semanticOrClauses });
  }

  if (andClauses.length > 0) {
    baseFilter.$and = andClauses;
  }

  // Bounded candidate fetch with populated brand & category for accurate multi-field relevance scoring
  const candidateDocs = await ProductModel.find(baseFilter)
    .populate('brandId', 'name slug')
    .populate('categoryId', 'name slug nameBn')
    .populate('subcategoryId', 'name slug nameBn')
    .limit(250)
    .lean();

  const scoredItems: Array<{
    formatted: Record<string, unknown>;
    score: number;
    matchedField: string;
    matchedText: string;
    matchedVia: string;
    inStock: boolean;
  }> = [];

  for (const rawDoc of candidateDocs) {
    const formatted = formatSearchProductForStorefront(
      rawDoc as unknown as Record<string, unknown>
    );
    const availableStock = Number(formatted.availableStock || 0);
    const allowBackorders = Boolean(formatted.allowBackorders);
    const inStock = availableStock > 0 || allowBackorders;

    // Out-of-stock policy enforcement
    if (engine.outOfStockBehavior === 'hide' && !inStock) {
      continue;
    }

    // Catalog filters
    const effPrice = Number(formatted.effectivePrice || 0);
    if (
      params.minPrice !== null &&
      params.minPrice !== undefined &&
      Number.isFinite(params.minPrice) &&
      effPrice < params.minPrice
    ) {
      continue;
    }
    if (
      params.maxPrice !== null &&
      params.maxPrice !== undefined &&
      Number.isFinite(params.maxPrice) &&
      effPrice > params.maxPrice
    ) {
      continue;
    }
    if (params.inStockOnly && availableStock <= 0) {
      continue;
    }
    if (params.onSaleOnly && Number(formatted.discountPercent || 0) <= 0) {
      continue;
    }

    const evalResult = scoreProductMatch(
      formatted as unknown as SearchableProductInput,
      expanded,
      engine
    );

    if (evalResult.score <= 0) continue;

    scoredItems.push({
      formatted: {
        ...formatted,
        searchMeta: {
          score: evalResult.score,
          matchedField: evalResult.matchedField,
          matchedText: evalResult.matchedText,
          matchedVia: evalResult.matchedVia,
        },
      },
      score: evalResult.score,
      matchedField: evalResult.matchedField,
      matchedText: evalResult.matchedText,
      matchedVia: evalResult.matchedVia,
      inStock,
    });
  }

  const sortMode = params.sort || 'relevance';

  scoredItems.sort((a, b) => {
    if (sortMode === 'price_asc') {
      return Number(a.formatted.effectivePrice || 0) - Number(b.formatted.effectivePrice || 0);
    }
    if (sortMode === 'price_desc') {
      return Number(b.formatted.effectivePrice || 0) - Number(a.formatted.effectivePrice || 0);
    }
    if (sortMode === 'top_rated') {
      return Number(b.formatted.ratingAverage || 0) - Number(a.formatted.ratingAverage || 0);
    }
    if (sortMode === 'best_selling') {
      return Number(b.formatted.salesCount || 0) - Number(a.formatted.salesCount || 0);
    }
    if (sortMode === 'newest') {
      const ta = new Date((a.formatted.createdAt as string) || 0).getTime();
      const tb = new Date((b.formatted.createdAt as string) || 0).getTime();
      return tb - ta;
    }

    // Default: Relevance (respecting outOfStockBehavior === 'demote')
    if (engine.outOfStockBehavior === 'demote' && a.inStock !== b.inStock) {
      return a.inStock ? -1 : 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    return Number(b.formatted.salesCount || 0) - Number(a.formatted.salesCount || 0);
  });

  const total = scoredItems.length;
  const totalPages = Math.ceil(total / effectiveLimit);
  const pagedItems = scoredItems.slice((page - 1) * effectiveLimit, page * effectiveLimit);

  const suggestions: SearchSuggestionPayloadItem[] = pagedItems.map(({ formatted, score, matchedField, matchedText, matchedVia, inStock }) => {
    const brandObj = formatted.brandId as { name?: string } | null | undefined;
    const catObj = formatted.categoryId as { name?: string } | null | undefined;
    const images = (formatted.images as Array<{ url?: string }> | undefined) || [];
    return {
      id: String(formatted._id),
      name: String(formatted.name || ''),
      nameBn: formatted.nameBn ? String(formatted.nameBn) : undefined,
      slug: String(formatted.slug || ''),
      sku: String(formatted.sku || ''),
      imageUrl: images[0]?.url || '',
      brandName: brandObj?.name || undefined,
      categoryName: catObj?.name || undefined,
      effectivePrice: Number(formatted.effectivePrice || 0),
      originalPrice:
        formatted.originalPrice !== null && formatted.originalPrice !== undefined
          ? Number(formatted.originalPrice)
          : null,
      discountPercent: Number(formatted.discountPercent || 0),
      availableStock: Number(formatted.availableStock || 0),
      inStock,
      allowBackorders: Boolean(formatted.allowBackorders),
      matchedField,
      matchedText,
      matchedVia,
      relevanceScore: score,
    };
  });

  const result: SmartSearchResult = {
    products: pagedItems.map((i) => i.formatted),
    suggestions,
    popularSearches: [],
    total,
    page,
    totalPages,
    queryMeta: {
      raw: q,
      normalized: expanded.normalized,
      language: expanded.language,
      expandedTerms: Array.from(
        new Set([...expanded.synonymTerms, ...expanded.transliteratedTerms])
      ).slice(0, 12),
      crossLanguageApplied:
        expanded.synonymTerms.length > 0 || expanded.transliteratedTerms.length > 0,
    },
  };

  if (suggestionCacheKey) {
    setCachedSearch(suggestionCacheKey, result, getSuggestionsTtlMs());
  }

  if (params.logAnalytics) {
    void recordSearchAnalytics(q, expanded.language, total);
  }

  return result;
}

export function clearAllSearchCaches() {
  invalidateSearchCache();
}
