import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { selectLatestApprovedReviews } from '../../../../shared/homepageHelpers.ts';
import { isSafeDestinationUrl } from '../../../../shared/security.ts';
import { userHasEffectivePermission } from '../../services/rbac.service.ts';
import { validateImageUploadMeta } from '../../../../shared/wishlistHelpers.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  optionalAuth,
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import {
  destroyCloudinaryAssetIfUnused,
  uploadBufferToCloudinary,
} from '../../services/cloudinary.service.ts';
import { ProductModel } from '../catalog/catalog.model.ts';
import { OrderModel } from '../orders/order.model.ts';
import { ReviewModel } from '../marketing/marketing.model.ts';

const router = Router();
router.use(requireDatabase);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const reviewUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many image upload requests. Please try again later.' },
});

const reviewImageSchema = z.object({
  publicId: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid review image URL'),
  alt: z.string().trim().max(160).optional(),
});

async function recalculateProductRating(productId: string) {
  const approved = await ReviewModel.find({ productId, status: 'approved' }).select('rating').lean();
  const count = approved.length;
  const average = count > 0 ? Number((approved.reduce((s, r) => s + r.rating, 0) / count).toFixed(2)) : 0;
  await ProductModel.findByIdAndUpdate(productId, {
    ratingCount: count,
    ratingAverage: average,
  });
}

// Public: Product reviews with real 5-star to 1-star distribution
router.get(
  '/product/:productId',
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));
    const sort: Record<string, 1 | -1> =
      req.query.sort === 'highest'
        ? { rating: -1, createdAt: -1 }
        : req.query.sort === 'lowest'
        ? { rating: 1, createdAt: -1 }
        : { createdAt: -1 };

    const [rawReviews, total, allRatings] = await Promise.all([
      ReviewModel.find({ productId: req.params.productId, status: 'approved' })
        .populate('userId', 'name avatarUrl')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments({ productId: req.params.productId, status: 'approved' }),
      ReviewModel.find({ productId: req.params.productId, status: 'approved' })
        .select('rating')
        .lean(),
    ]);

    const reviews = rawReviews.map((r) => {
      const populatedUser = r.userId as unknown as {
        _id?: unknown;
        name?: string;
        avatarUrl?: string;
      } | null;
      return {
        ...r,
        userId: populatedUser?._id ? String(populatedUser._id) : r.userId ? String(r.userId) : undefined,
        userName: populatedUser?.name || r.userName || 'Verified Customer',
        userAvatar: populatedUser?.avatarUrl || undefined,
      };
    });

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of allRatings) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      distribution[star] += 1;
    }

    const averageRating =
      total > 0 ? Number((allRatings.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(2)) : 0;

    res.json({
      reviews,
      total,
      averageRating,
      distribution,
      page,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// Public/Auth: Check whether the current user is eligible to review this product
router.get(
  '/product/:productId/eligibility',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    if (!req.user) {
      res.json({
        authenticated: false,
        canReview: false,
        hasDeliveredOrder: false,
        alreadyReviewed: false,
        existingReview: null,
      });
      return;
    }

    const [existingReview, deliveredOrder] = await Promise.all([
      ReviewModel.findOne({ productId: req.params.productId, userId: req.user._id }).lean(),
      OrderModel.findOne({
        userId: req.user._id,
        orderStatus: 'delivered',
        'items.productId': req.params.productId,
      })
        .select('_id')
        .lean(),
    ]);

    res.json({
      authenticated: true,
      canReview: Boolean(deliveredOrder) && !existingReview,
      hasDeliveredOrder: Boolean(deliveredOrder),
      alreadyReviewed: Boolean(existingReview),
      existingReview: existingReview || null,
    });
  })
);

// Public: Latest 4 approved/published reviews for homepage "Our Happy Clients"
router.get(
  '/featured',
  asyncHandler(async (_req, res) => {
    const rawReviews = await ReviewModel.find({
      status: 'approved',
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate('productId', 'name slug')
      .populate('userId', 'name avatarUrl')
      .lean();
    const reviews = selectLatestApprovedReviews(rawReviews, 4);
    res.json({ reviews });
  })
);

// Customer: Upload optional review photo to Cloudinary
router.post(
  '/upload-image',
  requireAuth,
  reviewUploadLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }

    const metaCheck = validateImageUploadMeta({
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      maxBytes: 4 * 1024 * 1024,
    });
    if (!metaCheck.valid) {
      res.status(400).json({ error: metaCheck.error });
      return;
    }

    const alt = typeof req.body?.alt === 'string' ? req.body.alt.trim().slice(0, 140) : 'Customer review photo';
    const asset = await uploadBufferToCloudinary(req.file.buffer, 'reviews', alt);
    res.status(201).json({ asset });
  })
);

// Customer: Submit review (verified against real delivered orders)
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      productId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().max(120).optional(),
      comment: z.string().trim().min(10).max(1500),
      images: z.array(reviewImageSchema).max(4).optional().default([]),
    });
    const parsed = schema.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(parsed.productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const product = await ProductModel.findById(parsed.productId);
    if (!product || product.status !== 'published') {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const existing = await ReviewModel.findOne({
      productId: parsed.productId,
      userId: req.user!._id,
    });
    if (existing) {
      res.status(409).json({ error: 'You have already submitted a review for this product.' });
      return;
    }

    // Verify purchase strictly from delivered order records
    const deliveredOrder = await OrderModel.findOne({
      userId: req.user!._id,
      orderStatus: 'delivered',
      'items.productId': product._id,
    });

    if (!deliveredOrder) {
      res.status(403).json({
        error: 'Verified purchase required',
        message: 'Only customers who have received a delivered order for this product can submit a review.',
      });
      return;
    }

    const review = await ReviewModel.create({
      productId: product._id,
      userId: req.user!._id,
      userName: req.user!.name,
      rating: parsed.rating,
      title: parsed.title,
      comment: parsed.comment,
      images: parsed.images,
      verifiedPurchase: true,
      orderId: deliveredOrder._id,
      status: 'pending',
    });

    res.status(201).json({
      review,
      message: 'Thank you! Your verified review has been submitted for moderation.',
    });
  })
);

// Customer: Edit own review (returns to pending moderation so edited copy cannot bypass review moderation)
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }

    const schema = z.object({
      rating: z.number().int().min(1).max(5).optional(),
      title: z.string().trim().max(120).optional(),
      comment: z.string().trim().min(10).max(1500).optional(),
      images: z.array(reviewImageSchema).max(4).optional(),
    });
    const parsed = schema.parse(req.body);

    const review = await ReviewModel.findById(req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    if (String(review.userId) !== String(req.user!._id)) {
      res.status(403).json({ error: 'You can only edit your own review.' });
      return;
    }

    const oldPublicIds = (review.images || []).map((img: { publicId?: string }) => img.publicId).filter(Boolean);

    if (parsed.rating !== undefined) review.rating = parsed.rating;
    if (parsed.title !== undefined) review.title = parsed.title;
    if (parsed.comment !== undefined) review.comment = parsed.comment;
    if (parsed.images !== undefined) review.images = parsed.images;
    review.status = 'pending';
    await review.save();

    if (parsed.images !== undefined) {
      const nextIds = new Set(parsed.images.map((img) => img.publicId));
      for (const oldId of oldPublicIds) {
        if (oldId && !nextIds.has(oldId)) {
          void destroyCloudinaryAssetIfUnused(oldId);
        }
      }
    }

    await recalculateProductRating(String(review.productId));

    res.json({
      review,
      message: 'Review updated and resubmitted for moderation.',
    });
  })
);

// Customer or Moderator: Delete review
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }

    const review = await ReviewModel.findById(req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    const isOwner = String(review.userId) === String(req.user!._id);
    const canModerate = await userHasEffectivePermission(req.user, 'reviews:moderate');
    if (!isOwner && !canModerate) {
      res.status(403).json({ error: 'Not authorized to delete this review.' });
      return;
    }

    const productId = String(review.productId);
    const oldPublicIds = (review.images || []).map((img: { publicId?: string }) => img.publicId).filter(Boolean);
    await review.deleteOne();
    await recalculateProductRating(productId);

    for (const oldId of oldPublicIds) {
      if (oldId) void destroyCloudinaryAssetIfUnused(oldId);
    }

    res.json({ ok: true });
  })
);

router.post(
  '/:id/helpful',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }
    const review = await ReviewModel.findOneAndUpdate(
      { _id: req.params.id, status: 'approved' },
      { $addToSet: { helpfulVoterIds: req.user!._id } },
      { new: true }
    );
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json({ helpfulCount: review.helpfulVoterIds.length });
  })
);

router.post(
  '/:id/report',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }
    const reason = z.string().trim().min(3).max(240).parse(req.body?.reason);
    const review = await ReviewModel.findById(req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    const alreadyReported = review.reports.some(
      (rep: { userId?: unknown }) => String(rep.userId) === String(req.user!._id)
    );
    if (!alreadyReported) {
      review.reports.push({
        userId: req.user!._id,
        reason,
        createdAt: new Date(),
      });
      await review.save();
    }
    res.json({ ok: true, message: 'Review reported to moderation team.' });
  })
);

router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rawReviews = await ReviewModel.find({ userId: req.user!._id })
      .populate('productId', 'name slug images')
      .populate('userId', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .lean();
    const reviews = rawReviews.map((r) => {
      const populatedUser = r.userId as unknown as {
        _id?: unknown;
        name?: string;
        avatarUrl?: string;
      } | null;
      return {
        ...r,
        userId: populatedUser?._id ? String(populatedUser._id) : r.userId ? String(r.userId) : undefined,
        userName: populatedUser?.name || r.userName || 'Verified Customer',
        userAvatar: populatedUser?.avatarUrl || undefined,
      };
    });
    res.json({ reviews });
  })
);

// ADMIN: Review Moderation Queue
router.get(
  '/admin/list',
  requireAuth,
  requirePermission('reviews:moderate'),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const filter: Record<string, unknown> = {};
    if (status === 'reported') {
      filter['reports.0'] = { $exists: true };
    } else if (status) {
      filter.status = status;
    }

    const reviews = await ReviewModel.find(filter)
      .populate('productId', 'name slug sku')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ reviews });
  })
);

router.patch(
  '/admin/:id/moderate',
  requireAuth,
  requirePermission('reviews:moderate'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }
    const schema = z.object({
      status: z.enum(['approved', 'rejected', 'pending']),
      moderationReason: z.string().trim().max(300).optional(),
    });
    const parsed = schema.parse(req.body);

    const review = await ReviewModel.findById(req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    review.status = parsed.status;
    review.moderationReason = parsed.moderationReason;
    review.moderatedBy = req.user!._id;
    review.moderatedAt = new Date();
    await review.save();

    await recalculateProductRating(String(review.productId));

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MODERATE_REVIEW',
      resourceType: 'Review',
      resourceId: String(review._id),
      details: parsed,
      ipAddress: req.ip,
    });

    res.json({ review });
  })
);

router.delete(
  '/admin/:id',
  requireAuth,
  requirePermission('reviews:moderate'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }

    const review = await ReviewModel.findById(req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    const productId = String(review.productId);
    const oldPublicIds = (review.images || [])
      .map((img: { publicId?: string }) => img.publicId)
      .filter(Boolean);
    await review.deleteOne();
    await recalculateProductRating(productId);

    for (const oldId of oldPublicIds) {
      if (oldId) void destroyCloudinaryAssetIfUnused(oldId);
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_REVIEW',
      resourceType: 'Review',
      resourceId: req.params.id,
      details: { productId },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

export default router;
