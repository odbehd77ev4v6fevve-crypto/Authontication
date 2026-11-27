import mongoose from 'mongoose';
import {
  computeCartOrderSummary,
  filterCartRecommendations,
  getEffectiveCartItemMaxQty,
  normalizeVariantOptions,
} from '../../../../shared/cartHelpers.ts';
import {
  calculateAutomaticDiscount,
  calculateCouponDiscount,
  resolveEffectiveUnitPrice,
} from '../../../../shared/pricing.ts';
import { ProductModel } from '../catalog/catalog.model.ts';
import { formatProductForStorefront } from '../catalog/catalog.routes.ts';
import { StoreSettingsModel } from '../cms/cms.model.ts';
import {
  CouponModel,
  CouponRedemptionModel,
  DiscountRuleModel,
} from '../marketing/marketing.model.ts';
import { CustomerGroupModel, UserModel } from '../users/user.model.ts';
import { CartModel } from './cart.model.ts';

export class CartServiceError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function buildHydratedCart(userId: string) {
  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    cart = await CartModel.create({ userId, items: [], appliedCouponCode: null });
  }

  const productIds = cart.items.map((i: { productId: unknown }) => i.productId);
  const [products, settings, userDoc, discountRules] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }).lean(),
    StoreSettingsModel.findOne({ key: 'primary' }).lean(),
    UserModel.findById(userId).select('customerGroupId').lean(),
    DiscountRuleModel.find({ isActive: true }).lean(),
  ]);
  const customerGroup = userDoc?.customerGroupId
    ? await CustomerGroupModel.findOne({ _id: userDoc.customerGroupId, isActive: true }).lean()
    : null;
  const userCustomerGroupId = userDoc?.customerGroupId ? String(userDoc.customerGroupId) : null;
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const validItems: typeof cart.items = [];
  const hydratedItems: Array<{
    productId: string;
    variantId: string | null;
    slug: string;
    sku: string;
    name: string;
    variantTitle: string | null;
    selectedOptions: Record<string, string>;
    imageUrl: string;
    quantity: number;
    unitPrice: number;
    originalPrice: number | null;
    availableStock: number;
    lowStockThreshold: number;
    allowBackorders: boolean;
    maxOrderQuantity: number;
    ratingAverage: number;
    ratingCount: number;
    categoryId: string;
    codEligible: boolean;
    staleWarning?: string;
  }> = [];

  for (const item of cart.items) {
    const product = productMap.get(String(item.productId));
    if (!product || product.status !== 'published') {
      continue;
    }

    let variant = null;
    if (item.variantId) {
      variant = product.variants.find(
        (v: { _id?: unknown; isActive?: boolean }) =>
          String(v._id) === String(item.variantId) && v.isActive !== false
      );
      if (!variant) continue;
    } else if (product.variants.length > 0) {
      continue;
    }

    const availableStock = variant
      ? Math.max(0, variant.stockOnHand - variant.reservedStock)
      : Math.max(0, product.stockOnHand - product.reservedStock);
    const allowBackorders = Boolean(product.allowBackorders);
    const maxOrderQty = Math.min(50, Math.max(1, Number(product.maxOrderQuantity || 50)));
    const lowStockThreshold = variant
      ? Math.max(1, Number(variant.lowStockThreshold ?? product.lowStockThreshold ?? 5))
      : Math.max(1, Number(product.lowStockThreshold ?? 5));

    const pricing = resolveEffectiveUnitPrice({
      basePrice: product.basePrice,
      salePrice: product.salePrice,
      flashSalePrice: product.flashSalePrice,
      flashSaleStart: product.flashSaleStart,
      flashSaleEnd: product.flashSaleEnd,
      variantPrice: variant?.price ?? null,
    });

    const maxAllowed =
      availableStock > 0
        ? getEffectiveCartItemMaxQty({ availableStock, maxOrderQuantity: maxOrderQty, allowBackorders })
        : allowBackorders
        ? maxOrderQty
        : item.quantity;
    const clampedQty = Math.min(item.quantity, maxAllowed);
    validItems.push({
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: clampedQty,
    });

    hydratedItems.push({
      productId: String(product._id),
      variantId: variant ? String(variant._id) : null,
      slug: product.slug,
      sku: variant ? variant.sku : product.sku,
      name: product.name,
      variantTitle: variant ? variant.title : null,
      selectedOptions: normalizeVariantOptions(variant?.options),
      imageUrl: variant?.image?.url || product.images[0]?.url || '',
      quantity: clampedQty,
      unitPrice: pricing.unitPrice,
      originalPrice: pricing.originalPrice,
      availableStock,
      lowStockThreshold,
      allowBackorders,
      maxOrderQuantity: maxOrderQty,
      ratingAverage: Number(product.ratingAverage || 0),
      ratingCount: Number(product.ratingCount || 0),
      categoryId: String(product.categoryId),
      codEligible: product.codEligible,
      staleWarning:
        availableStock === 0 && !allowBackorders
          ? 'Currently out of stock'
          : clampedQty < item.quantity
          ? `Adjusted to allowed limit (${maxAllowed})`
          : undefined,
    });
  }

  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  const subtotal = hydratedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const pricingLines = hydratedItems.map((i) => ({
    productId: i.productId,
    categoryId: i.categoryId,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
  }));

  const autoDiscount = calculateAutomaticDiscount({
    lines: pricingLines,
    rules: discountRules.map((r) => ({
      _id: r._id,
      name: r.name,
      ruleType: r.ruleType,
      value: r.value,
      maxDiscountCap: r.maxDiscountCap,
      minOrderAmount: r.minOrderAmount,
      minQuantity: r.minQuantity,
      targetScope: r.targetScope,
      targetIds: r.targetIds,
      priority: r.priority,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      isActive: r.isActive,
    })),
    customerGroup: customerGroup
      ? {
          _id: customerGroup._id,
          name: customerGroup.name,
          discountPercent: customerGroup.discountPercent,
          isActive: customerGroup.isActive,
        }
      : null,
    userCustomerGroupId,
  });

  let couponDiscountAmount = 0;
  let couponMessage: string | undefined;
  let appliedCouponCode = cart.appliedCouponCode || null;

  if (appliedCouponCode) {
    const coupon = await CouponModel.findOne({ code: appliedCouponCode });
    if (!coupon) {
      appliedCouponCode = null;
      cart.appliedCouponCode = null;
      await cart.save();
    } else {
      const customerUsedCount = await CouponRedemptionModel.countDocuments({
        couponId: coupon._id,
        userId,
        status: { $ne: 'released' },
      });
      const check = calculateCouponDiscount(
        {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          maxDiscountCap: coupon.maxDiscountCap,
          minOrderAmount: coupon.minOrderAmount,
          isActive: coupon.isActive,
          startsAt: coupon.startsAt,
          expiresAt: coupon.expiresAt,
          usageLimit: coupon.usageLimit,
          usedCount: coupon.usedCount,
          perCustomerLimit: coupon.perCustomerLimit,
          customerUsedCount,
          eligibleCategoryIds: coupon.eligibleCategoryIds.map(String),
          eligibleProductIds: coupon.eligibleProductIds.map(String),
          eligibleCustomerGroupIds: (coupon.eligibleCustomerGroupIds || []).map(String),
          userCustomerGroupId,
        },
        pricingLines
      );

      if (check.valid) {
        couponDiscountAmount = check.discountAmount;
      } else {
        couponMessage = check.reason;
      }
    }
  }

  const summary = computeCartOrderSummary({
    subtotal,
    discountAmount: couponDiscountAmount,
    automaticDiscountAmount: autoDiscount.discountAmount,
    automaticDiscountLabel: autoDiscount.appliedRuleName,
    shippingConfig: settings?.shipping,
    taxRate: settings?.taxRate ?? 0,
    taxSettings: settings?.taxSettings,
    itemCount: hydratedItems.length,
  });

  return {
    items: hydratedItems,
    uniqueLineCount: hydratedItems.length,
    subtotal,
    discountAmount: summary.discountAmount,
    automaticDiscountAmount: autoDiscount.discountAmount,
    automaticDiscountLabel: autoDiscount.appliedRuleName,
    appliedCouponCode,
    couponMessage,
    summary,
  };
}

export async function addItemToCart(
  userId: string,
  input: { productId: string; variantId?: string | null; quantity: number }
) {
  if (!mongoose.Types.ObjectId.isValid(input.productId)) {
    throw new CartServiceError(400, 'Invalid product ID.');
  }
  if (input.variantId && !mongoose.Types.ObjectId.isValid(input.variantId)) {
    throw new CartServiceError(400, 'Invalid variant ID.');
  }

  const product = await ProductModel.findOne({ _id: input.productId, status: 'published' });
  if (!product) {
    throw new CartServiceError(404, 'Product not found or unavailable.');
  }

  let available = Math.max(0, product.stockOnHand - product.reservedStock);
  const activeVariants = product.variants.filter((v: { isActive?: boolean }) => v.isActive !== false);
  if (activeVariants.length > 0) {
    if (!input.variantId) {
      throw new CartServiceError(400, 'Please select a product variant.');
    }
    const variant = activeVariants.find((v: { _id?: unknown }) => String(v._id) === input.variantId);
    if (!variant) {
      throw new CartServiceError(404, 'Selected variant is unavailable.');
    }
    available = Math.max(0, variant.stockOnHand - variant.reservedStock);
  } else if (product.variants.length > 0) {
    available = 0;
  }

  const allowBackorders = Boolean(product.allowBackorders);
  const maxOrderQty = Math.min(50, Math.max(1, Number(product.maxOrderQuantity || 50)));

  if (available < 1 && !allowBackorders) {
    throw new CartServiceError(409, 'This item is currently out of stock.');
  }

  const effectiveCap = getEffectiveCartItemMaxQty({
    availableStock: available,
    maxOrderQuantity: maxOrderQty,
    allowBackorders,
  });

  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    cart = await CartModel.create({ userId, items: [] });
  }

  const existing = cart.items.find(
    (i: { productId: unknown; variantId?: unknown }) =>
      String(i.productId) === input.productId &&
      String(i.variantId || '') === String(input.variantId || '')
  );

  if (existing) {
    existing.quantity = Math.min(effectiveCap, existing.quantity + input.quantity);
  } else {
    cart.items.push({
      productId: product._id,
      variantId: input.variantId ? (input.variantId as never) : null,
      quantity: Math.min(effectiveCap, input.quantity),
    });
  }

  await cart.save();
  return buildHydratedCart(userId);
}

export async function updateCartItemQty(
  userId: string,
  input: { productId: string; variantId?: string | null; quantity: number }
) {
  const cart = await CartModel.findOne({ userId });
  if (!cart) {
    throw new CartServiceError(404, 'Cart not found');
  }

  if (input.quantity === 0) {
    cart.items = cart.items.filter(
      (i: { productId: unknown; variantId?: unknown }) =>
        !(
          String(i.productId) === input.productId &&
          String(i.variantId || '') === String(input.variantId || '')
        )
    );
  } else {
    const target = cart.items.find(
      (i: { productId: unknown; variantId?: unknown }) =>
        String(i.productId) === input.productId &&
        String(i.variantId || '') === String(input.variantId || '')
    );
    if (target) {
      const product = await ProductModel.findOne({ _id: input.productId, status: 'published' });
      if (!product) {
        throw new CartServiceError(404, 'Product is no longer available.');
      }
      const variant = input.variantId
        ? product.variants.find(
            (v: { _id?: unknown; isActive?: boolean }) =>
              String(v._id) === input.variantId && v.isActive !== false
          )
        : null;
      if (input.variantId && !variant) {
        throw new CartServiceError(404, 'Selected variant is unavailable.');
      }
      const available = variant
        ? Math.max(0, variant.stockOnHand - variant.reservedStock)
        : product.variants.length > 0
        ? 0
        : Math.max(0, product.stockOnHand - product.reservedStock);
      const allowBackorders = Boolean(product.allowBackorders);
      const maxOrderQty = Math.min(50, Math.max(1, Number(product.maxOrderQuantity || 50)));

      if (input.quantity > maxOrderQty) {
        throw new CartServiceError(
          409,
          `Maximum ${maxOrderQty} unit(s) allowed per order for this item.`
        );
      }
      if (!allowBackorders && available < input.quantity) {
        throw new CartServiceError(409, `Only ${available} unit(s) available in stock.`);
      }
      target.quantity = input.quantity;
    }
  }

  await cart.save();
  return buildHydratedCart(userId);
}

export async function clearCustomerCart(userId: string) {
  await CartModel.findOneAndUpdate(
    { userId },
    { items: [], appliedCouponCode: null },
    { upsert: true }
  );
  return buildHydratedCart(userId);
}

export async function mergeGuestItemsIntoCart(
  userId: string,
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>
) {
  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    cart = await CartModel.create({ userId, items: [] });
  }

  for (const guestItem of items) {
    if (!mongoose.Types.ObjectId.isValid(guestItem.productId)) continue;
    const product = await ProductModel.findOne({ _id: guestItem.productId, status: 'published' });
    if (!product) continue;

    const activeVariants = product.variants.filter(
      (v: { isActive?: boolean }) => v.isActive !== false
    );
    const variant = guestItem.variantId
      ? activeVariants.find((v: { _id?: unknown }) => String(v._id) === guestItem.variantId)
      : null;
    if (activeVariants.length > 0 && !variant) continue;
    if (product.variants.length > 0 && activeVariants.length === 0) continue;

    const available = variant
      ? Math.max(0, variant.stockOnHand - variant.reservedStock)
      : Math.max(0, product.stockOnHand - product.reservedStock);
    const allowBackorders = Boolean(product.allowBackorders);
    const maxOrderQty = Math.min(50, Math.max(1, Number(product.maxOrderQuantity || 50)));
    if (available < 1 && !allowBackorders) continue;
    const effectiveCap = getEffectiveCartItemMaxQty({
      availableStock: available,
      maxOrderQuantity: maxOrderQty,
      allowBackorders,
    });

    const existing = cart.items.find(
      (i: { productId: unknown; variantId?: unknown }) =>
        String(i.productId) === guestItem.productId &&
        String(i.variantId || '') === String(guestItem.variantId || '')
    );

    if (existing) {
      existing.quantity = Math.min(effectiveCap, existing.quantity + guestItem.quantity);
    } else {
      cart.items.push({
        productId: product._id,
        variantId: guestItem.variantId ? (guestItem.variantId as never) : null,
        quantity: Math.min(effectiveCap, guestItem.quantity),
      });
    }
  }

  await cart.save();
  return buildHydratedCart(userId);
}

export async function applyCartCouponCode(userId: string, code: string) {
  const coupon = await CouponModel.findOne({ code });
  if (!coupon) {
    throw new CartServiceError(404, 'Invalid coupon code.');
  }

  const [cartBefore, customerUsedCount, userDoc] = await Promise.all([
    buildHydratedCart(userId),
    CouponRedemptionModel.countDocuments({
      couponId: coupon._id,
      userId,
      status: { $ne: 'released' },
    }),
    UserModel.findById(userId).select('customerGroupId').lean(),
  ]);

  const validation = calculateCouponDiscount(
    {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscountCap: coupon.maxDiscountCap,
      minOrderAmount: coupon.minOrderAmount,
      isActive: coupon.isActive,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      perCustomerLimit: coupon.perCustomerLimit,
      customerUsedCount,
      eligibleCategoryIds: coupon.eligibleCategoryIds.map(String),
      eligibleProductIds: coupon.eligibleProductIds.map(String),
      eligibleCustomerGroupIds: (coupon.eligibleCustomerGroupIds || []).map(String),
      userCustomerGroupId: userDoc?.customerGroupId ? String(userDoc.customerGroupId) : null,
    },
    cartBefore.items.map((i) => ({
      productId: i.productId,
      categoryId: i.categoryId,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }))
  );

  if (!validation.valid) {
    throw new CartServiceError(400, validation.reason || 'Coupon cannot be applied.');
  }

  await CartModel.findOneAndUpdate(
    { userId },
    { appliedCouponCode: coupon.code },
    { upsert: true }
  );

  return buildHydratedCart(userId);
}

export async function removeCartCouponCode(userId: string) {
  await CartModel.findOneAndUpdate({ userId }, { appliedCouponCode: null });
  return buildHydratedCart(userId);
}

export async function getCartRecommendationProducts(options: {
  userId?: string | null;
  excludeIds?: string[];
  limit?: number;
}) {
  const limit = Math.min(12, Math.max(1, Number(options.limit || 10)));
  const excludedIdsSet = new Set<string>(
    (options.excludeIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id))
  );

  if (options.userId) {
    const cart = await CartModel.findOne({ userId: options.userId }).select('items.productId').lean();
    for (const item of cart?.items || []) {
      excludedIdsSet.add(String(item.productId));
    }
  }

  const excludedIdList = Array.from(excludedIdsSet);
  const excludedObjectIds = excludedIdList.map((id) => new mongoose.Types.ObjectId(id));

  const cartProducts =
    excludedObjectIds.length > 0
      ? await ProductModel.find({ _id: { $in: excludedObjectIds } })
          .select('categoryId subcategoryId categoryDomain')
          .lean()
      : [];

  const categoryIds = Array.from(
    new Set(cartProducts.map((p) => (p.categoryId ? String(p.categoryId) : '')).filter(Boolean))
  ).map((id) => new mongoose.Types.ObjectId(id));

  const results: Array<Record<string, unknown> & { _id: unknown }> = [];
  const seenIds = new Set<string>(excludedIdList);

  if (categoryIds.length > 0) {
    const relatedDocs = await ProductModel.find({
      _id: { $nin: excludedObjectIds },
      status: 'published',
      categoryId: { $in: categoryIds },
    })
      .populate('brandId', 'name slug')
      .populate('categoryId', 'name slug nameBn')
      .sort({ isFeatured: -1, salesCount: -1, ratingAverage: -1 })
      .limit(limit * 2)
      .lean();

    const formatted = relatedDocs.map((d) =>
      formatProductForStorefront(d as unknown as Record<string, unknown>)
    ) as unknown as Array<Record<string, unknown> & { _id: unknown }>;
    for (const item of filterCartRecommendations(formatted, Array.from(seenIds), limit)) {
      seenIds.add(String(item._id));
      results.push(item);
    }
  }

  if (results.length < limit) {
    const fallbackDocs = await ProductModel.find({
      _id: { $nin: Array.from(seenIds).map((id) => new mongoose.Types.ObjectId(id)) },
      status: 'published',
    })
      .populate('brandId', 'name slug')
      .populate('categoryId', 'name slug nameBn')
      .sort({ isFeatured: -1, salesCount: -1, ratingAverage: -1, createdAt: -1 })
      .limit((limit - results.length) * 3)
      .lean();

    const formattedFallback = fallbackDocs.map((d) =>
      formatProductForStorefront(d as unknown as Record<string, unknown>)
    ) as unknown as Array<Record<string, unknown> & { _id: unknown }>;
    for (const item of filterCartRecommendations(
      formattedFallback,
      Array.from(seenIds),
      limit - results.length
    )) {
      seenIds.add(String(item._id));
      results.push(item);
    }
  }

  return results;
}
