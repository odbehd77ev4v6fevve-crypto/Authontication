import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireDatabase } from '../../database/connection.ts';
import {
  optionalAuth,
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { ProductModel } from '../catalog/catalog.model.ts';
import { ProductQuestionModel } from './qa.model.ts';

const router = Router();
router.use(requireDatabase);

const questionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many question submissions. Please wait a moment before asking again.' },
});

// Public: Published Q&A for a product (+ authenticated customer's own pending questions)
router.get(
  '/product/:productId',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));

    const publishedFilter = {
      productId: req.params.productId,
      status: 'approved',
      isPublished: true,
    };

    const [questions, total, myPending] = await Promise.all([
      ProductQuestionModel.find(publishedFilter)
        .sort({ answeredAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductQuestionModel.countDocuments(publishedFilter),
      req.user
        ? ProductQuestionModel.find({
            productId: req.params.productId,
            userId: req.user._id,
            $or: [{ status: { $ne: 'approved' } }, { isPublished: false }],
          })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()
        : Promise.resolve([]),
    ]);

    res.json({
      questions,
      myPending,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// Customer: Ask a question (authenticated)
router.post(
  '/',
  requireAuth,
  questionLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      productId: z.string().min(1),
      question: z.string().trim().min(6, 'Please write a clear question (min 6 characters).').max(600),
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

    const item = await ProductQuestionModel.create({
      productId: product._id,
      userId: req.user!._id,
      askedByName: req.user!.name,
      question: parsed.question,
      status: 'pending',
      isPublished: false,
    });

    res.status(201).json({
      question: item,
      message: 'Your question has been submitted and will appear once answered by our team.',
    });
  })
);

// ADMIN: List Q&A moderation queue
router.get(
  '/admin/list',
  requireAuth,
  requirePermission('reviews:moderate'),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const filter: Record<string, unknown> = {};
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      filter.status = status;
    } else if (status === 'unanswered') {
      filter.answer = { $in: ['', null] };
    }

    const questions = await ProductQuestionModel.find(filter)
      .populate('productId', 'name slug sku')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ questions });
  })
);

// ADMIN: Answer, approve/reject, or publish/unpublish a product question
router.patch(
  '/admin/:id',
  requireAuth,
  requirePermission('reviews:moderate'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid question ID.' });
      return;
    }

    const schema = z.object({
      answer: z.string().trim().max(1500).optional(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      isPublished: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const existing = await ProductQuestionModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    if (parsed.answer !== undefined) {
      existing.answer = parsed.answer;
      if (parsed.answer.length > 0) {
        existing.answeredById = req.user!._id;
        existing.answeredByName = req.user!.name;
        existing.answeredAt = new Date();
      } else {
        existing.answeredById = null;
        existing.answeredByName = '';
        existing.answeredAt = null;
      }
    }

    if (parsed.status !== undefined) {
      existing.status = parsed.status;
      if (parsed.status === 'rejected') {
        existing.isPublished = false;
      }
    }

    if (parsed.isPublished !== undefined) {
      existing.isPublished = existing.status === 'rejected' ? false : parsed.isPublished;
      if (existing.isPublished && existing.status === 'pending') {
        existing.status = 'approved';
      }
    }

    await existing.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MODERATE_PRODUCT_QA',
      resourceType: 'ProductQuestion',
      resourceId: String(existing._id),
      details: { status: existing.status, isPublished: existing.isPublished },
      ipAddress: req.ip,
    });

    res.json({ question: existing });
  })
);

// ADMIN: Delete a product question
router.delete(
  '/admin/:id',
  requireAuth,
  requirePermission('reviews:moderate'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid question ID.' });
      return;
    }

    const deleted = await ProductQuestionModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_PRODUCT_QA',
      resourceType: 'ProductQuestion',
      resourceId: String(deleted._id),
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  })
);

export default router;
