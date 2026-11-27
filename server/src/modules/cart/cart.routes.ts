import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireDatabase } from '../../database/connection.ts';
import {
  optionalAuth,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import {
  addItemToCart,
  applyCartCouponCode,
  buildHydratedCart,
  CartServiceError,
  clearCustomerCart,
  getCartRecommendationProducts,
  mergeGuestItemsIntoCart,
  removeCartCouponCode,
  updateCartItemQty,
} from './cart.service.ts';

const router = Router();
router.use(requireDatabase);

function handleCartError(res: Parameters<Parameters<typeof asyncHandler>[0]>[1], err: unknown) {
  if (err instanceof CartServiceError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  throw err;
}

// Public / Auth: Dynamic "You May Also Like" recommendations excluding cart items
router.get(
  '/recommendations',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const excludeParam = typeof req.query.excludeIds === 'string' ? req.query.excludeIds : '';
    const excludeIds = excludeParam
      .split(',')
      .map((s) => s.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .slice(0, 50);
    const limit = Math.min(12, Math.max(1, Number(req.query.limit || 10)));

    const products = await getCartRecommendationProducts({
      userId: req.user ? String(req.user._id) : null,
      excludeIds,
      limit,
    });
    res.json({ products });
  })
);

router.post(
  '/recommendations',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      excludeIds: z.array(z.string().trim()).max(50).optional().default([]),
      limit: z.number().int().min(1).max(12).optional().default(10),
    });
    const parsed = schema.parse(req.body || {});
    const products = await getCartRecommendationProducts({
      userId: req.user ? String(req.user._id) : null,
      excludeIds: parsed.excludeIds,
      limit: parsed.limit,
    });
    res.json({ products });
  })
);

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cart = await buildHydratedCart(String(req.user!._id));
    res.json(cart);
  })
);

router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cart = await buildHydratedCart(String(req.user!._id));
    res.json({
      uniqueLineCount: cart.uniqueLineCount,
      subtotal: cart.subtotal,
      discountAmount: cart.discountAmount,
      appliedCouponCode: cart.appliedCouponCode,
      couponMessage: cart.couponMessage,
      summary: cart.summary,
    });
  })
);

router.post(
  '/items',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      quantity: z.number().int().min(1).max(50).default(1),
    });
    const parsed = schema.parse(req.body);
    try {
      const hydrated = await addItemToCart(String(req.user!._id), parsed);
      res.json(hydrated);
    } catch (err) {
      handleCartError(res, err);
    }
  })
);

router.patch(
  '/items',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      quantity: z.number().int().min(0).max(50),
    });
    const parsed = schema.parse(req.body);
    try {
      const hydrated = await updateCartItemQty(String(req.user!._id), parsed);
      res.json(hydrated);
    } catch (err) {
      handleCartError(res, err);
    }
  })
);

router.delete(
  '/items/:productId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const variantId =
      typeof req.query.variantId === 'string' && req.query.variantId
        ? req.query.variantId
        : null;
    try {
      const hydrated = await updateCartItemQty(String(req.user!._id), {
        productId: req.params.productId,
        variantId,
        quantity: 0,
      });
      res.json(hydrated);
    } catch (err) {
      handleCartError(res, err);
    }
  })
);

router.delete(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const hydrated = await clearCustomerCart(String(req.user!._id));
    res.json(hydrated);
  })
);

router.post(
  '/merge',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            variantId: z.string().nullable().optional(),
            quantity: z.number().int().min(1).max(50),
          })
        )
        .max(50),
    });
    const parsed = schema.parse(req.body);
    const hydrated = await mergeGuestItemsIntoCart(String(req.user!._id), parsed.items);
    res.json(hydrated);
  })
);

router.post(
  '/coupon',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const code = z.string().trim().toUpperCase().min(2).max(40).parse(req.body?.code);
    try {
      const hydrated = await applyCartCouponCode(String(req.user!._id), code);
      res.json(hydrated);
    } catch (err) {
      handleCartError(res, err);
    }
  })
);

router.delete(
  '/coupon',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const hydrated = await removeCartCouponCode(String(req.user!._id));
    res.json(hydrated);
  })
);

export { buildHydratedCart };
export default router;
