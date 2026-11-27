import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { resolveEffectiveUnitPrice } from '../../../../shared/pricing.ts';
import { parseSafeProductVideoUrl } from '../../../../shared/productDetailHelpers.ts';
import { userHasEffectivePermission } from '../../services/rbac.service.ts';
import {
  escapeRegex,
  isSafeDestinationUrl,
  parseCsvLine,
  sanitizeCsvCell,
} from '../../../../shared/security.ts';
import { calculateAvailableProductStock } from '../../../../shared/wishlistHelpers.ts';
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
import {
  AttributeGroupModel,
  BrandModel,
  CategoryModel,
  CollectionModel,
  ProductModel,
} from './catalog.model.ts';
import { InventoryMovementModel } from '../inventory/inventory.model.ts';
import { OrderModel } from '../orders/order.model.ts';
import { ProductQuestionModel } from '../reviews/qa.model.ts';
import { invalidateNavigationCache } from '../navigation/navigation.cache.ts';
import { clearAllSearchCaches, executeSmartSearch } from '../search/search.service.ts';
import { toPatchSchema } from '../../utils/zodPartial.ts';

const router = Router();
router.use(requireDatabase);
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.path.startsWith('/admin')) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        invalidateNavigationCache();
        clearAllSearchCaches();
      }
    });
  }
  next();
});

const assetSchema = z.object({
  publicId: z.string().min(1),
  url: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid media asset URL'),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  alt: z.string().optional(),
});

const specificationGroupSchema = z.object({
  groupTitle: z.string().trim().min(1).max(80),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(300),
      })
    )
    .default([]),
});

const variantInputSchema = z.object({
  _id: z.string().optional(),
  sku: z.string().trim().min(2).max(60),
  title: z.string().trim().min(1).max(100),
  options: z.record(z.string(), z.string()).default({}),
  price: z.number().min(0).nullable().optional(),
  stockOnHand: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  image: assetSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  nameBn: z.string().trim().max(160).optional(),
  slug: z.string().trim().min(2).max(180).toLowerCase(),
  sku: z.string().trim().min(2).max(60).toUpperCase(),
  barcode: z.string().trim().max(60).optional(),
  brandId: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  subcategoryId: z.string().nullable().optional(),
  categoryDomain: z
    .enum(['electronics', 'beauty', 'books', 'home_lifestyle', 'fashion', 'general'])
    .default('general'),
  shortDescription: z.string().trim().max(320).optional(),
  description: z.string().trim().min(10).max(8000),
  features: z.array(z.string().trim()).default([]),
  attributes: z.record(z.string(), z.string()).default({}),
  specificationGroups: z.array(specificationGroupSchema).default([]),
  bilingualKeywords: z.array(z.string().trim()).default([]),
  basePrice: z.number().min(0),
  purchasePrice: z.number().min(0).nullable().optional(),
  costPrice: z.number().min(0).nullable().optional(),
  salePrice: z.number().min(0).nullable().optional(),
  flashSalePrice: z.number().min(0).nullable().optional(),
  flashSaleStart: z.string().datetime().nullable().optional(),
  flashSaleEnd: z.string().datetime().nullable().optional(),
  stockOnHand: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  allowBackorders: z.boolean().default(false),
  maxOrderQuantity: z.number().int().min(1).max(50).default(10),
  variants: z.array(variantInputSchema).default([]),
  images: z.array(assetSchema).default([]),
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (val) => !val || parseSafeProductVideoUrl(val).valid,
      'Video URL must be a valid YouTube, Vimeo, or direct .mp4/.webm/.ogg video link.'
    )
    .optional(),
  videoThumbnail: assetSchema.nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  warrantyInfo: z.string().trim().max(500).optional(),
  returnPolicyInfo: z.string().trim().max(500).optional(),
  shippingInfo: z.string().trim().max(1000).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  codEligible: z.boolean().default(true),
  relatedProductIds: z
    .array(z.string().trim().refine((id) => mongoose.Types.ObjectId.isValid(id), 'Invalid related product ID'))
    .max(12)
    .default([]),
  seoTitle: z.string().trim().max(140).optional(),
  seoDescription: z.string().trim().max(260).optional(),
  metaKeywords: z.array(z.string().trim()).default([]),
  canonicalUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (val) => !val || isSafeDestinationUrl(val, { allowRelative: true, allowEmpty: true }),
      'Canonical URL must be a valid path or http(s) URL.'
    )
    .optional(),
  ogImage: assetSchema.nullable().optional(),
});

export function formatProductForStorefront(product: Record<string, unknown>) {
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

// Public: Categories & Brands & Collections
router.get(
  '/categories',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const canViewAll =
      req.query.all === 'true' && (await userHasEffectivePermission(req.user, 'catalog:read'));
    const filter = canViewAll ? {} : { isActive: true };
    const categories = await CategoryModel.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
    res.json({ categories });
  })
);

router.get(
  '/brands',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const canViewAll =
      req.query.all === 'true' && (await userHasEffectivePermission(req.user, 'catalog:read'));
    const filter = canViewAll ? {} : { isActive: true };
    const brands = await BrandModel.find(filter).sort({ name: 1 }).lean();
    res.json({ brands });
  })
);

router.get(
  '/collections',
  asyncHandler(async (_req, res) => {
    const collections = await CollectionModel.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .populate({ path: 'productIds', match: { status: 'published' } })
      .lean();
    res.json({ collections });
  })
);

// Public: Bounded Cross-Lingual Autocomplete Suggestions
router.get(
  '/search/suggestions',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const requestedLimit = Number(req.query.limit || 0);
    const result = await executeSmartSearch({
      q,
      mode: 'suggestions',
      limit: requestedLimit > 0 ? requestedLimit : undefined,
      logAnalytics: false,
    });

    res.json({
      suggestions: result.suggestions,
      popularSearches: result.popularSearches,
      total: result.total,
      queryMeta: result.queryMeta,
    });
  })
);

// Public: Product Listing, Category, Brand & Search Results with Pagination & Filtering
router.get(
  '/products',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(48, Math.max(1, Number(req.query.limit || 20)));
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const brandSlug = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'all';
    const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== '' ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : null;
    const minRating = req.query.minRating !== undefined && req.query.minRating !== '' ? Number(req.query.minRating) : null;
    const inStockOnly = req.query.inStock === 'true';
    const onSaleOnly = req.query.onSale === 'true' || tab === 'on_sale';
    const featuredOnly = req.query.featured === 'true';
    const topRatedOnly = req.query.topRated === 'true' || tab === 'top_rated';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : (q ? 'relevance' : 'featured');
    const includeAllStatus =
      req.query.includeAll === 'true' &&
      (await userHasEffectivePermission(req.user, 'catalog:read'));

    if (q) {
      const smartResult = await executeSmartSearch({
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
        products: smartResult.products,
        total: smartResult.total,
        page: smartResult.page,
        totalPages: smartResult.totalPages,
        queryMeta: smartResult.queryMeta,
      });
      return;
    }

    const now = new Date();
    const filter: Record<string, unknown> = includeAllStatus ? {} : { status: 'published' };
    const andClauses: Record<string, unknown>[] = [];

    if (categorySlug) {
      const category = await CategoryModel.findOne({ slug: categorySlug }).lean();
      if (category) {
        const subCategories = await CategoryModel.find({ parentId: category._id }).select('_id').lean();
        const catIds = [category._id, ...subCategories.map((c) => c._id)];
        andClauses.push({ $or: [{ categoryId: { $in: catIds } }, { subcategoryId: { $in: catIds } }] });
      } else {
        res.json({ products: [], total: 0, page, totalPages: 0 });
        return;
      }
    }

    if (brandSlug) {
      const brand = await BrandModel.findOne({ slug: brandSlug }).lean();
      if (brand) {
        filter.brandId = brand._id;
      } else {
        res.json({ products: [], total: 0, page, totalPages: 0 });
        return;
      }
    }

    const effectivePriceExpr = {
      $let: {
        vars: {
          flashActive: {
            $and: [
              { $ne: ['$flashSalePrice', null] },
              { $gt: ['$flashSalePrice', 0] },
              { $lt: ['$flashSalePrice', '$basePrice'] },
              { $or: [{ $eq: ['$flashSaleStart', null] }, { $lte: ['$flashSaleStart', now] }] },
              { $or: [{ $eq: ['$flashSaleEnd', null] }, { $gte: ['$flashSaleEnd', now] }] },
            ],
          },
          saleActive: {
            $and: [
              { $ne: ['$salePrice', null] },
              { $gt: ['$salePrice', 0] },
              { $lt: ['$salePrice', '$basePrice'] },
            ],
          },
        },
        in: {
          $cond: [
            '$$flashActive',
            '$flashSalePrice',
            { $cond: ['$$saleActive', '$salePrice', '$basePrice'] },
          ],
        },
      },
    };

    if (minPrice !== null && Number.isFinite(minPrice)) {
      andClauses.push({ $expr: { $gte: [effectivePriceExpr, minPrice] } });
    }
    if (maxPrice !== null && Number.isFinite(maxPrice)) {
      andClauses.push({ $expr: { $lte: [effectivePriceExpr, maxPrice] } });
    }
    if (minRating !== null && Number.isFinite(minRating)) {
      filter.ratingAverage = { $gte: minRating };
    }
    if (featuredOnly) {
      filter.isFeatured = true;
    }
    if (topRatedOnly) {
      filter.ratingCount = { $gt: 0 };
    }
    if (onSaleOnly) {
      andClauses.push({
        $or: [
          {
            $expr: {
              $and: [
                { $ne: ['$salePrice', null] },
                { $gt: ['$salePrice', 0] },
                { $lt: ['$salePrice', '$basePrice'] },
              ],
            },
          },
          {
            flashSalePrice: { $ne: null, $gt: 0 },
            $and: [
              { $expr: { $lt: ['$flashSalePrice', '$basePrice'] } },
              { $or: [{ flashSaleStart: null }, { flashSaleStart: { $lte: now } }] },
              { $or: [{ flashSaleEnd: null }, { flashSaleEnd: { $gte: now } }] },
            ],
          },
        ],
      });
    }
    if (inStockOnly) {
      andClauses.push({
        $expr: {
          $let: {
            vars: {
              activeVariants: {
                $filter: {
                  input: { $ifNull: ['$variants', []] },
                  as: 'v',
                  cond: { $ne: ['$$v.isActive', false] },
                },
              },
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$activeVariants' }, 0] },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: '$$activeVariants',
                          as: 'av',
                          cond: {
                            $gt: [
                              {
                                $subtract: [
                                  { $ifNull: ['$$av.stockOnHand', 0] },
                                  { $ifNull: ['$$av.reservedStock', 0] },
                                ],
                              },
                              0,
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
                {
                  $gt: [
                    {
                      $subtract: [
                        { $ifNull: ['$stockOnHand', 0] },
                        { $ifNull: ['$reservedStock', 0] },
                      ],
                    },
                    0,
                  ],
                },
              ],
            },
          },
        },
      });
    }

    const isBestSellerQuery = tab === 'best_seller' || sort === 'best_selling';
    let orderSalesByProductId = new Map<string, number>();

    if (isBestSellerQuery) {
      const aggregatedSales = await OrderModel.aggregate<{
        _id: mongoose.Types.ObjectId;
        totalUnits: number;
      }>([
        {
          $match: {
            orderStatus: { $in: ['confirmed', 'processing', 'packed', 'shipped', 'delivered'] },
            paymentStatus: { $ne: 'failed' },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            totalUnits: { $sum: '$items.quantity' },
          },
        },
        { $match: { totalUnits: { $gt: 0 } } },
        { $sort: { totalUnits: -1 } },
      ]);

      orderSalesByProductId = new Map(
        aggregatedSales.map((row) => [String(row._id), Number(row.totalUnits || 0)])
      );

      if (tab === 'best_seller') {
        const orderProductIds = aggregatedSales.map((row) => row._id);
        andClauses.push({
          $or: [
            { isBestSeller: true },
            { salesCount: { $gt: 0 } },
            ...(orderProductIds.length > 0 ? [{ _id: { $in: orderProductIds } }] : []),
          ],
        });
      }
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    let sortStage: Record<string, 1 | -1> = { isFeatured: -1, createdAt: -1 };
    if (sort === 'price_asc') sortStage = { basePrice: 1 };
    else if (sort === 'price_desc') sortStage = { basePrice: -1 };
    else if (isBestSellerQuery) sortStage = { isBestSeller: -1, salesCount: -1, createdAt: -1 };
    else if (sort === 'top_rated' || tab === 'top_rated') sortStage = { ratingAverage: -1, ratingCount: -1 };
    else if (sort === 'newest' || tab === 'new_arrivals') sortStage = { isNewArrival: -1, createdAt: -1 };

    let rawProducts: Record<string, unknown>[] = [];
    let total = 0;

    if (isBestSellerQuery && orderSalesByProductId.size > 0) {
      const matched = await ProductModel.find(filter)
        .populate('brandId', 'name slug')
        .populate('categoryId', 'name slug nameBn')
        .populate('subcategoryId', 'name slug')
        .lean();

      const sortedMatched = matched
        .map((p) => {
          const obj = p as unknown as Record<string, unknown>;
          const id = String(obj._id);
          const effectiveUnits = Math.max(
            Number(obj.salesCount || 0),
            orderSalesByProductId.get(id) || 0
          );
          return { obj, effectiveUnits };
        })
        .sort((a, b) => b.effectiveUnits - a.effectiveUnits);

      total = sortedMatched.length;
      rawProducts = sortedMatched
        .slice((page - 1) * limit, page * limit)
        .map(({ obj, effectiveUnits }) => ({ ...obj, salesCount: effectiveUnits }));
    } else {
      const [docs, count] = await Promise.all([
        ProductModel.find(filter)
          .populate('brandId', 'name slug')
          .populate('categoryId', 'name slug nameBn')
          .populate('subcategoryId', 'name slug')
          .sort(sortStage)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ProductModel.countDocuments(filter),
      ]);
      rawProducts = docs as unknown as Record<string, unknown>[];
      total = count;
    }

    const products = rawProducts.map((p) => formatProductForStorefront(p));

    res.json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// Public: Batch fetch published products by IDs (used to hydrate guest wishlist)
router.post(
  '/products/by-ids',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      ids: z.array(z.string().trim().min(1)).max(100),
    });
    const parsed = schema.parse(req.body);
    const validIds = Array.from(
      new Set(parsed.ids.filter((id) => mongoose.Types.ObjectId.isValid(id)))
    );
    if (validIds.length === 0) {
      res.json({ products: [] });
      return;
    }

    const rawProducts = await ProductModel.find({
      _id: { $in: validIds },
      status: 'published',
    })
      .populate('brandId', 'name slug')
      .populate('categoryId', 'name slug nameBn')
      .lean();

    const byId = new Map(
      rawProducts.map((p) => [
        String(p._id),
        formatProductForStorefront(p as unknown as Record<string, unknown>),
      ])
    );

    const ordered = validIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    res.json({ products: ordered });
  })
);

async function resolveRelatedProducts(
  product: {
    _id: mongoose.Types.ObjectId;
    categoryId?: unknown;
    subcategoryId?: unknown;
    brandId?: unknown;
    categoryDomain?: string;
    relatedProductIds?: unknown[];
  },
  limit = 8
) {
  const seenIds = new Set<string>([String(product._id)]);
  const results: Record<string, unknown>[] = [];

  const manualIds = Array.isArray(product.relatedProductIds)
    ? product.relatedProductIds
        .map((id) => String(id))
        .filter((id) => mongoose.Types.ObjectId.isValid(id) && !seenIds.has(id))
    : [];

  if (manualIds.length > 0) {
    const manualDocs = await ProductModel.find({
      _id: { $in: manualIds },
      status: 'published',
    })
      .populate('brandId', 'name slug')
      .populate('categoryId', 'name slug')
      .lean();
    const byId = new Map(manualDocs.map((d) => [String(d._id), d]));
    for (const id of manualIds) {
      const doc = byId.get(id);
      if (doc && !seenIds.has(String(doc._id)) && results.length < limit) {
        seenIds.add(String(doc._id));
        results.push(doc as unknown as Record<string, unknown>);
      }
    }
  }

  const categoryObjId =
    product.categoryId && typeof product.categoryId === 'object' && '_id' in product.categoryId
      ? (product.categoryId as { _id: unknown })._id
      : product.categoryId;
  const subcategoryObjId =
    product.subcategoryId && typeof product.subcategoryId === 'object' && '_id' in product.subcategoryId
      ? (product.subcategoryId as { _id: unknown })._id
      : product.subcategoryId;
  const brandObjId =
    product.brandId && typeof product.brandId === 'object' && '_id' in product.brandId
      ? (product.brandId as { _id: unknown })._id
      : product.brandId;

  const tiers: Record<string, unknown>[] = [];
  if (subcategoryObjId) tiers.push({ subcategoryId: subcategoryObjId });
  if (categoryObjId) tiers.push({ categoryId: categoryObjId });
  if (brandObjId) tiers.push({ brandId: brandObjId });
  if (product.categoryDomain && product.categoryDomain !== 'general') {
    tiers.push({ categoryDomain: product.categoryDomain });
  }
  tiers.push({});

  for (const tierFilter of tiers) {
    if (results.length >= limit) break;
    const candidates = await ProductModel.find({
      _id: { $nin: Array.from(seenIds).map((id) => new mongoose.Types.ObjectId(id)) },
      status: 'published',
      ...tierFilter,
    })
      .populate('brandId', 'name slug')
      .populate('categoryId', 'name slug')
      .sort({ isFeatured: -1, salesCount: -1, ratingAverage: -1 })
      .limit(limit - results.length)
      .lean();

    for (const c of candidates) {
      if (!seenIds.has(String(c._id)) && results.length < limit) {
        seenIds.add(String(c._id));
        results.push(c as unknown as Record<string, unknown>);
      }
    }
  }

  return results.map((r) => formatProductForStorefront(r));
}

// Public: Product Detail by Slug
router.get(
  '/products/:slug',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const product = await ProductModel.findOne({ slug: req.params.slug })
      .populate('brandId', 'name slug logo')
      .populate('categoryId', 'name slug nameBn parentId')
      .populate('subcategoryId', 'name slug')
      .lean();

    const canViewUnpublished = await userHasEffectivePermission(req.user, 'catalog:read');
    if (
      !product ||
      product.status === 'archived' ||
      (product.status !== 'published' && !canViewUnpublished)
    ) {
      res.status(404).json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const [relatedProducts, qaTotal] = await Promise.all([
      resolveRelatedProducts(product, 8),
      ProductQuestionModel.countDocuments({
        productId: product._id,
        status: 'approved',
        isPublished: true,
      }),
    ]);

    res.json({
      product: formatProductForStorefront(product as unknown as Record<string, unknown>),
      relatedProducts,
      qaTotal,
    });
  })
);

// Public: Related Products by Slug
router.get(
  '/products/:slug/related',
  asyncHandler(async (req, res) => {
    const product = await ProductModel.findOne({ slug: req.params.slug, status: 'published' })
      .select('_id categoryId subcategoryId brandId categoryDomain relatedProductIds')
      .lean();
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const limit = Math.min(12, Math.max(1, Number(req.query.limit || 8)));
    const relatedProducts = await resolveRelatedProducts(product, limit);
    res.json({ relatedProducts });
  })
);

// Public: Back-in-stock notification opt-in
router.post(
  '/products/:id/back-in-stock',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }
    const email = z.string().trim().email().parse(req.body?.email || req.user?.email);
    const product = await ProductModel.findById(req.params.id);
    if (!product || product.status !== 'published') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const normalized = email.toLowerCase();
    if (!product.backInStockSubscribers.includes(normalized)) {
      product.backInStockSubscribers.push(normalized);
      await product.save();
    }

    res.json({ ok: true, message: 'You will be notified by email when this product is restocked.' });
  })
);

// ADMIN: Categories CRUD
router.post(
  '/admin/categories',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      nameBn: z.string().trim().max(80).optional(),
      slug: z.string().trim().min(2).max(90).toLowerCase(),
      description: z.string().trim().max(500).optional(),
      parentId: z.string().nullable().optional(),
      image: assetSchema.optional(),
      displayOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
      seoTitle: z.string().max(120).optional(),
      seoDescription: z.string().max(240).optional(),
    });
    const parsed = schema.parse(req.body);
    if (parsed.parentId && !mongoose.Types.ObjectId.isValid(parsed.parentId)) {
      res.status(400).json({ error: 'Invalid parent category ID.' });
      return;
    }
    const category = await CategoryModel.create({
      ...parsed,
      parentId: parsed.parentId || null,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_CATEGORY',
      resourceType: 'Category',
      resourceId: String(category._id),
      details: { name: category.name, slug: category.slug },
      ipAddress: req.ip,
    });

    res.status(201).json({ category });
  })
);

router.patch(
  '/admin/categories/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }
    const schema = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      nameBn: z.string().trim().max(80).optional(),
      slug: z.string().trim().min(2).max(90).toLowerCase().optional(),
      description: z.string().trim().max(500).optional(),
      parentId: z.string().nullable().optional(),
      image: assetSchema.nullable().optional(),
      displayOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
      seoTitle: z.string().max(120).optional(),
      seoDescription: z.string().max(240).optional(),
    });
    const parsed = schema.parse(req.body);
    if (parsed.parentId) {
      if (!mongoose.Types.ObjectId.isValid(parsed.parentId)) {
        res.status(400).json({ error: 'Invalid parent category ID.' });
        return;
      }
      if (parsed.parentId === req.params.id) {
        res.status(400).json({ error: 'A category cannot be its own parent.' });
        return;
      }
      // Guard against circular descendant hierarchy
      const allCats = await CategoryModel.find().select('_id parentId').lean();
      const parentById = new Map(allCats.map((c) => [String(c._id), c.parentId ? String(c.parentId) : null]));
      let cursor: string | null | undefined = parsed.parentId;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === req.params.id) {
          res.status(400).json({ error: 'Circular category hierarchy detected.' });
          return;
        }
        if (visited.has(cursor)) break;
        visited.add(cursor);
        cursor = parentById.get(cursor);
      }
    }
    const existing = await CategoryModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const oldPublicId = existing.image?.publicId;
    Object.assign(existing, {
      ...parsed,
      parentId: parsed.parentId === '' ? null : (parsed.parentId ?? existing.parentId),
    });
    await existing.save();

    if (oldPublicId && parsed.image?.publicId !== oldPublicId) {
      void destroyCloudinaryAssetIfUnused(oldPublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_CATEGORY',
      resourceType: 'Category',
      resourceId: String(existing._id),
      details: { name: existing.name, slug: existing.slug },
      ipAddress: req.ip,
    });

    res.json({ category: existing });
  })
);

router.delete(
  '/admin/categories/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }
    const existing = await CategoryModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const [hasChildren, hasProducts] = await Promise.all([
      CategoryModel.exists({ parentId: existing._id }),
      ProductModel.exists({
        $or: [{ categoryId: existing._id }, { subcategoryId: existing._id }],
      }),
    ]);

    if (hasChildren) {
      res.status(409).json({
        error: 'Cannot delete a category that still has subcategories. Reassign or remove child categories first.',
      });
      return;
    }
    if (hasProducts) {
      res.status(409).json({
        error: 'Cannot delete a category assigned to existing products. Reassign products or deactivate the category instead.',
      });
      return;
    }

    const oldPublicId = existing.image?.publicId;
    await existing.deleteOne();
    if (oldPublicId) {
      void destroyCloudinaryAssetIfUnused(oldPublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_CATEGORY',
      resourceType: 'Category',
      resourceId: req.params.id,
      details: { name: existing.name, slug: existing.slug },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// ADMIN: Brands CRUD
router.post(
  '/admin/brands',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(1).max(80),
      slug: z.string().trim().min(1).max(90).toLowerCase(),
      description: z.string().trim().max(400).optional(),
      logo: assetSchema.optional(),
      isActive: z.boolean().default(true),
    });
    const parsed = schema.parse(req.body);
    const brand = await BrandModel.create(parsed);

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_BRAND',
      resourceType: 'Brand',
      resourceId: String(brand._id),
      details: { name: brand.name },
      ipAddress: req.ip,
    });

    res.status(201).json({ brand });
  })
);

router.patch(
  '/admin/brands/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }
    const schema = z.object({
      name: z.string().trim().min(1).max(80).optional(),
      slug: z.string().trim().min(1).max(90).toLowerCase().optional(),
      description: z.string().trim().max(400).optional(),
      logo: assetSchema.nullable().optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);
    const existing = await BrandModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    const oldPublicId = existing.logo?.publicId;
    Object.assign(existing, parsed);
    await existing.save();

    if (oldPublicId && parsed.logo?.publicId !== oldPublicId) {
      void destroyCloudinaryAssetIfUnused(oldPublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_BRAND',
      resourceType: 'Brand',
      resourceId: String(existing._id),
      details: { name: existing.name },
      ipAddress: req.ip,
    });

    res.json({ brand: existing });
  })
);

router.delete(
  '/admin/brands/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }
    const existing = await BrandModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    const hasProducts = await ProductModel.exists({ brandId: existing._id });
    if (hasProducts) {
      res.status(409).json({
        error: 'Cannot delete a brand linked to existing products. Reassign products or mark the brand hidden instead.',
      });
      return;
    }

    const oldPublicId = existing.logo?.publicId;
    await existing.deleteOne();
    if (oldPublicId) {
      void destroyCloudinaryAssetIfUnused(oldPublicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_BRAND',
      resourceType: 'Brand',
      resourceId: req.params.id,
      details: { name: existing.name, slug: existing.slug },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// ADMIN: Products CRUD
router.get(
  '/admin/products',
  requireAuth,
  requirePermission('catalog:read'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 25)));
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filter: Record<string, unknown> = {};
    if (q) {
      const escapedQ = escapeRegex(q);
      filter.$or = [
        { name: { $regex: escapedQ, $options: 'i' } },
        { sku: { $regex: escapedQ, $options: 'i' } },
      ];
    }

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .populate('brandId', 'name slug')
        .populate('categoryId', 'name slug')
        .populate('subcategoryId', 'name slug')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ProductModel.countDocuments(filter),
    ]);

    res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  })
);

router.get(
  '/admin/products/:id',
  requireAuth,
  requirePermission('catalog:read'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }
    const product = await ProductModel.findById(req.params.id)
      .populate('brandId', 'name slug')
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .lean();
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const recentMovements = await InventoryMovementModel.find({ productId: product._id })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();
    res.json({
      product: formatProductForStorefront(product as unknown as Record<string, unknown>),
      recentMovements,
    });
  })
);

// ADMIN: Attribute Groups CRUD
const attributeGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(90).toLowerCase(),
  description: z.string().trim().max(300).optional().default(''),
  attributes: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(60),
        label: z.string().trim().min(1).max(80),
        type: z.enum(['text', 'number', 'select', 'color']).default('text'),
        options: z.array(z.string().trim()).default([]),
        isFilterable: z.boolean().default(true),
        isRequired: z.boolean().default(false),
      })
    )
    .default([]),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

router.get(
  '/admin/attributes',
  requireAuth,
  requirePermission('catalog:read'),
  asyncHandler(async (_req, res) => {
    const groups = await AttributeGroupModel.find().sort({ displayOrder: 1, name: 1 }).lean();
    res.json({ groups });
  })
);

router.post(
  '/admin/attributes',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = attributeGroupSchema.parse(req.body);
    const group = await AttributeGroupModel.create(parsed);
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_ATTRIBUTE_GROUP',
      resourceType: 'AttributeGroup',
      resourceId: String(group._id),
      details: { name: group.name, attributesCount: group.attributes.length },
      ipAddress: req.ip,
    });
    res.status(201).json({ group });
  })
);

router.patch(
  '/admin/attributes/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid attribute group ID.' });
      return;
    }
    const parsed = toPatchSchema(attributeGroupSchema).parse(req.body);
    const updated = await AttributeGroupModel.findByIdAndUpdate(req.params.id, parsed, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      res.status(404).json({ error: 'Attribute group not found' });
      return;
    }
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_ATTRIBUTE_GROUP',
      resourceType: 'AttributeGroup',
      resourceId: String(updated._id),
      details: { name: updated.name },
      ipAddress: req.ip,
    });
    res.json({ group: updated });
  })
);

router.delete(
  '/admin/attributes/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid attribute group ID.' });
      return;
    }
    const deleted = await AttributeGroupModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Attribute group not found' });
      return;
    }
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_ATTRIBUTE_GROUP',
      resourceType: 'AttributeGroup',
      resourceId: String(deleted._id),
      details: { name: deleted.name },
      ipAddress: req.ip,
    });
    res.json({ ok: true });
  })
);

router.post(
  '/admin/products',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = productSchema.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(parsed.categoryId)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }
    if (parsed.subcategoryId && !mongoose.Types.ObjectId.isValid(parsed.subcategoryId)) {
      res.status(400).json({ error: 'Invalid subcategory ID.' });
      return;
    }
    if (parsed.brandId && !mongoose.Types.ObjectId.isValid(parsed.brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }

    const product = await ProductModel.create({
      ...parsed,
      brandId: parsed.brandId || null,
      subcategoryId: parsed.subcategoryId || null,
      videoThumbnail: parsed.videoThumbnail || undefined,
      ogImage: parsed.ogImage || undefined,
      variants: parsed.variants.map((v) => ({
        ...v,
        image: v.image || undefined,
      })),
      flashSaleStart: parsed.flashSaleStart ? new Date(parsed.flashSaleStart) : null,
      flashSaleEnd: parsed.flashSaleEnd ? new Date(parsed.flashSaleEnd) : null,
    });

    await InventoryMovementModel.create({
      productId: product._id,
      sku: product.sku,
      type: 'initial',
      quantityDelta: product.stockOnHand,
      reservedDelta: 0,
      reason: 'Initial product creation',
      actorId: req.user!._id,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_PRODUCT',
      resourceType: 'Product',
      resourceId: String(product._id),
      details: { sku: product.sku, name: product.name, basePrice: product.basePrice },
      ipAddress: req.ip,
    });

    res.status(201).json({ product });
  })
);

router.patch(
  '/admin/products/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }
    const parsed = toPatchSchema(productSchema).parse(req.body);
    if (parsed.categoryId && !mongoose.Types.ObjectId.isValid(parsed.categoryId)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }
    if (parsed.subcategoryId && !mongoose.Types.ObjectId.isValid(parsed.subcategoryId)) {
      res.status(400).json({ error: 'Invalid subcategory ID.' });
      return;
    }
    if (parsed.brandId && !mongoose.Types.ObjectId.isValid(parsed.brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }

    const existing = await ProductModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (parsed.stockOnHand !== undefined && parsed.stockOnHand < existing.reservedStock) {
      res.status(400).json({
        error: `Stock on hand (${parsed.stockOnHand}) cannot be lower than reserved stock (${existing.reservedStock}).`,
      });
      return;
    }

    const existingVariantMap = new Map<string, { _id: unknown; stockOnHand: number; reservedStock: number }>();
    for (const v of existing.variants || []) {
      existingVariantMap.set(String(v._id), {
        _id: v._id,
        stockOnHand: Number(v.stockOnHand || 0),
        reservedStock: Number(v.reservedStock || 0),
      });
    }

    if (parsed.variants !== undefined) {
      for (const v of parsed.variants) {
        if (v._id) {
          const prevVar = existingVariantMap.get(String(v._id));
          if (prevVar && v.stockOnHand < prevVar.reservedStock) {
            res.status(400).json({
              error: `Variant ${v.sku} stock on hand (${v.stockOnHand}) cannot be lower than reserved stock (${prevVar.reservedStock}).`,
            });
            return;
          }
        }
      }
    }

    const oldImageIds: string[] = [
      ...existing.images.map((img: { publicId: string }) => img.publicId),
      ...existing.variants
        .map((v: { image?: { publicId?: string } }) => v.image?.publicId)
        .filter((id: string | undefined): id is string => Boolean(id)),
      ...(existing.videoThumbnail?.publicId ? [existing.videoThumbnail.publicId] : []),
      ...(existing.ogImage?.publicId ? [existing.ogImage.publicId] : []),
    ];
    const previousPrice = existing.basePrice;
    const previousStockOnHand = Number(existing.stockOnHand || 0);

    Object.assign(existing, {
      ...parsed,
      brandId: parsed.brandId === '' ? null : (parsed.brandId ?? existing.brandId),
      subcategoryId: parsed.subcategoryId === '' ? null : (parsed.subcategoryId ?? existing.subcategoryId),
      videoThumbnail:
        parsed.videoThumbnail !== undefined
          ? parsed.videoThumbnail || undefined
          : existing.videoThumbnail,
      ogImage: parsed.ogImage !== undefined ? parsed.ogImage || undefined : existing.ogImage,
      variants:
        parsed.variants !== undefined
          ? parsed.variants.map((v) => ({
              ...v,
              reservedStock: v._id ? existingVariantMap.get(String(v._id))?.reservedStock ?? 0 : 0,
              image: v.image || undefined,
            }))
          : existing.variants,
      flashSaleStart:
        parsed.flashSaleStart !== undefined
          ? parsed.flashSaleStart
            ? new Date(parsed.flashSaleStart)
            : null
          : existing.flashSaleStart,
      flashSaleEnd:
        parsed.flashSaleEnd !== undefined
          ? parsed.flashSaleEnd
            ? new Date(parsed.flashSaleEnd)
            : null
          : existing.flashSaleEnd,
    });

    await existing.save();

    if (parsed.stockOnHand !== undefined && parsed.stockOnHand !== previousStockOnHand) {
      await InventoryMovementModel.create({
        productId: existing._id,
        sku: existing.sku,
        type: 'adjustment',
        quantityDelta: parsed.stockOnHand - previousStockOnHand,
        reservedDelta: 0,
        reason: 'Product editor stock update',
        actorId: req.user!._id,
      });
    }

    if (parsed.variants !== undefined) {
      for (const nextV of existing.variants) {
        const prevV = existingVariantMap.get(String(nextV._id));
        const delta = Number(nextV.stockOnHand || 0) - (prevV?.stockOnHand ?? 0);
        if (delta !== 0) {
          await InventoryMovementModel.create({
            productId: existing._id,
            variantId: nextV._id,
            sku: nextV.sku,
            type: prevV ? 'adjustment' : 'initial',
            quantityDelta: delta,
            reservedDelta: 0,
            reason: prevV ? 'Variant stock updated in product editor' : 'New variant created',
            actorId: req.user!._id,
          });
        }
      }
    }

    const currentIds = new Set<string>([
      ...existing.images.map((i: { publicId: string }) => i.publicId),
      ...existing.variants
        .map((v: { image?: { publicId?: string } }) => v.image?.publicId)
        .filter((id: string | undefined): id is string => Boolean(id)),
      ...(existing.videoThumbnail?.publicId ? [existing.videoThumbnail.publicId] : []),
      ...(existing.ogImage?.publicId ? [existing.ogImage.publicId] : []),
    ]);

    for (const oldId of oldImageIds) {
      if (!currentIds.has(oldId)) {
        void destroyCloudinaryAssetIfUnused(oldId);
      }
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: previousPrice !== existing.basePrice ? 'UPDATE_PRODUCT_PRICE' : 'UPDATE_PRODUCT',
      resourceType: 'Product',
      resourceId: String(existing._id),
      details: { sku: existing.sku, previousPrice, newPrice: existing.basePrice },
      ipAddress: req.ip,
    });

    res.json({ product: existing });
  })
);

router.delete(
  '/admin/products/:id',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const existing = await ProductModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const hasOrders = await OrderModel.exists({ 'items.productId': existing._id });
    if (hasOrders) {
      res.status(409).json({
        error: 'Cannot delete a product that appears in existing customer orders. Change its status to Archived instead to preserve order history.',
      });
      return;
    }

    const assetPublicIds: string[] = [
      ...existing.images.map((img: { publicId: string }) => img.publicId),
      ...existing.variants
        .map((v: { image?: { publicId?: string } }) => v.image?.publicId)
        .filter((id: string | undefined): id is string => Boolean(id)),
      ...(existing.videoThumbnail?.publicId ? [existing.videoThumbnail.publicId] : []),
      ...(existing.ogImage?.publicId ? [existing.ogImage.publicId] : []),
    ];

    await existing.deleteOne();

    for (const publicId of assetPublicIds) {
      if (publicId) void destroyCloudinaryAssetIfUnused(publicId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_PRODUCT',
      resourceType: 'Product',
      resourceId: req.params.id,
      details: { sku: existing.sku, name: existing.name },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

// ADMIN: Bulk CSV Export & Import
router.get(
  '/admin/products/export/csv',
  requireAuth,
  requirePermission('catalog:read'),
  asyncHandler(async (_req, res) => {
    const products = await ProductModel.find({ status: { $ne: 'archived' } })
      .populate('categoryId', 'slug')
      .populate('brandId', 'slug')
      .lean();

    const headers = ['sku', 'name', 'slug', 'categorySlug', 'brandSlug', 'basePrice', 'salePrice', 'stockOnHand', 'status'];
    const lines = [headers.join(',')];

    for (const p of products) {
      const catSlug = (p.categoryId as { slug?: string } | null)?.slug || '';
      const brSlug = (p.brandId as { slug?: string } | null)?.slug || '';
      const row = [
        sanitizeCsvCell(p.sku),
        sanitizeCsvCell(p.name),
        sanitizeCsvCell(p.slug),
        sanitizeCsvCell(catSlug),
        sanitizeCsvCell(brSlug),
        p.basePrice,
        p.salePrice ?? '',
        p.stockOnHand,
        p.status,
      ];
      lines.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="novara-catalog-export.csv"');
    res.send(lines.join('\n'));
  })
);

router.post(
  '/admin/products/import/csv',
  requireAuth,
  requirePermission('catalog:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const csvText = z.string().min(5).max(500_000).parse(req.body?.csvText);
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV must contain a header row and at least one product row.' });
      return;
    }

    if (lines.length > 501) {
      res.status(400).json({ error: 'Bulk CSV import is bounded to 500 rows per batch.' });
      return;
    }

    const categories = await CategoryModel.find().lean();
    const brands = await BrandModel.find().lean();
    const catMap = new Map(categories.map((c) => [c.slug, c._id]));
    const brandMap = new Map(brands.map((b) => [b.slug, b._id]));

    const errors: Array<{ row: number; sku: string; error: string }> = [];
    let importedCount = 0;

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      const [sku, name, slug, categorySlug, brandSlug, basePriceStr, salePriceStr, stockStr, statusStr] = cols;
      if (!sku || !name || !slug || !categorySlug) {
        errors.push({ row: i + 1, sku: sku || '', error: 'Missing required sku, name, slug, or categorySlug.' });
        continue;
      }
      const categoryId = catMap.get(categorySlug.toLowerCase());
      if (!categoryId) {
        errors.push({ row: i + 1, sku, error: `Unknown categorySlug: ${categorySlug}` });
        continue;
      }

      const basePrice = Number(basePriceStr);
      const salePrice = salePriceStr ? Number(salePriceStr) : null;
      const stockOnHand = Number(stockStr || 0);
      if (!Number.isFinite(basePrice) || basePrice < 0) {
        errors.push({ row: i + 1, sku, error: 'Invalid basePrice.' });
        continue;
      }

      try {
        const created = await ProductModel.create({
          sku: sku.toUpperCase(),
          name,
          slug: slug.toLowerCase(),
          categoryId,
          brandId: brandSlug ? brandMap.get(brandSlug.toLowerCase()) || null : null,
          description: `${name} — Imported via NOVARA bulk catalog import.`,
          basePrice,
          salePrice: salePrice && salePrice > 0 ? salePrice : null,
          stockOnHand: Number.isFinite(stockOnHand) && stockOnHand >= 0 ? Math.floor(stockOnHand) : 0,
          status: statusStr === 'published' ? 'published' : 'draft',
        });
        await InventoryMovementModel.create({
          productId: created._id,
          sku: created.sku,
          type: 'initial',
          quantityDelta: created.stockOnHand,
          reservedDelta: 0,
          reason: 'Bulk CSV catalog import',
          actorId: req.user!._id,
        });
        importedCount += 1;
      } catch (err) {
        errors.push({
          row: i + 1,
          sku,
          error: err instanceof Error ? err.message : 'Duplicate SKU or slug.',
        });
      }
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'BULK_CSV_IMPORT',
      resourceType: 'Product',
      details: { importedCount, errorCount: errors.length },
      ipAddress: req.ip,
    });

    res.json({ importedCount, errorCount: errors.length, errors });
  })
);

export default router;
