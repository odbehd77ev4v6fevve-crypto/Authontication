import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { isSafeDestinationUrl } from '../../../../shared/security.ts';
import {
  filterEligibleCustomerCoupons,
  hasValidScheduleWindow,
} from '../../../../shared/wishlistHelpers.ts';
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
  AdvertisementModel,
  CampaignModel,
  CouponModel,
  CouponRedemptionModel,
  DiscountRuleModel,
  PromoPopupModel,
} from './marketing.model.ts';

const router = Router();
router.use(requireDatabase);

// Public Marketing Endpoints (accessible to guests & logged-in customers)
router.get(
  '/public/campaigns',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const campaigns = await CampaignModel.find({
      status: { $in: ['active', 'scheduled'] },
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ campaigns });
  })
);

router.get(
  '/public/ads',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const placement = typeof req.query.placement === 'string' ? req.query.placement.trim() : '';
    const filter: Record<string, unknown> = {
      status: 'active',
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    };
    if (placement) filter.placement = placement;
    const ads = await AdvertisementModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ads });
  })
);

router.post(
  '/public/ads/:id/track',
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid advertisement ID.' });
      return;
    }
    const type = z.enum(['impression', 'click']).parse(req.body?.type);
    const incField = type === 'click' ? { clicks: 1 } : { impressions: 1 };
    await AdvertisementModel.findByIdAndUpdate(req.params.id, { $inc: incField });
    res.json({ ok: true });
  })
);

router.get(
  '/public/popups',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const popups = await PromoPopupModel.find({
      isEnabled: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ popups });
  })
);

router.use(requireAuth);

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40),
  description: z.string().trim().max(240).optional(),
  type: z.enum(['fixed', 'percentage']),
  value: z.number().min(1),
  maxDiscountCap: z.number().min(0).nullable().optional(),
  minOrderAmount: z.number().min(0).default(0),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).nullable().optional(),
  eligibleCategoryIds: z.array(z.string()).default([]),
  eligibleProductIds: z.array(z.string()).default([]),
  eligibleCustomerGroupIds: z.array(z.string()).default([]),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

router.get(
  '/my-coupons',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const now = new Date();
    const [coupons, allUserRedemptions, redemptions] = await Promise.all([
      CouponModel.find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
        ],
      })
        .select(
          'code description type value maxDiscountCap minOrderAmount expiresAt perCustomerLimit usageLimit usedCount eligibleCustomerGroupIds'
        )
        .sort({ expiresAt: 1, createdAt: -1 })
        .lean(),
      CouponRedemptionModel.find({ userId: req.user!._id }).select('couponId').lean(),
      CouponRedemptionModel.find({ userId: req.user!._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('orderId', 'orderNumber totalAmount createdAt')
        .lean(),
    ]);

    const redemptionCounts: Record<string, number> = {};
    for (const r of allUserRedemptions) {
      const key = String(r.couponId);
      redemptionCounts[key] = (redemptionCounts[key] || 0) + 1;
    }

    const userGroupId = req.user?.customerGroupId ? String(req.user.customerGroupId) : null;
    const eligibleCoupons = filterEligibleCustomerCoupons(coupons, redemptionCounts, userGroupId);

    res.json({ coupons: eligibleCoupons, redemptions });
  })
);

router.get(
  '/admin/coupons',
  requirePermission('coupons:write'),
  asyncHandler(async (_req, res) => {
    const coupons = await CouponModel.find().sort({ createdAt: -1 });
    const recentRedemptions = await CouponRedemptionModel.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email');
    res.json({ coupons, recentRedemptions });
  })
);

router.post(
  '/admin/coupons',
  requirePermission('coupons:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = couponSchema.parse(req.body);
    if (parsed.type === 'percentage' && parsed.value > 95) {
      res.status(400).json({ error: 'Percentage coupon cannot exceed 95%.' });
      return;
    }
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.expiresAt)) {
      res.status(400).json({ error: 'Coupon expiry date must be after start date.' });
      return;
    }

    const coupon = await CouponModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_COUPON',
      resourceType: 'Coupon',
      resourceId: String(coupon._id),
      details: { code: coupon.code, type: coupon.type, value: coupon.value },
      ipAddress: req.ip,
    });

    res.status(201).json({ coupon });
  })
);

router.patch(
  '/admin/coupons/:id',
  requirePermission('coupons:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid coupon ID.' });
      return;
    }
    const parsed = toPatchSchema(couponSchema).parse(req.body);
    const existing = await CouponModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    const nextStartsAt =
      parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
    const nextExpiresAt =
      parsed.expiresAt !== undefined
        ? parsed.expiresAt
          ? new Date(parsed.expiresAt)
          : null
        : existing.expiresAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextExpiresAt)) {
      res.status(400).json({ error: 'Coupon expiry date must be after start date.' });
      return;
    }

    Object.assign(existing, {
      ...parsed,
      startsAt: nextStartsAt,
      expiresAt: nextExpiresAt,
    });
    await existing.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_COUPON',
      resourceType: 'Coupon',
      resourceId: String(existing._id),
      details: parsed,
      ipAddress: req.ip,
    });

    res.json({ coupon: existing });
  })
);

router.delete(
  '/admin/coupons/:id',
  requirePermission('coupons:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid coupon ID.' });
      return;
    }
    const deleted = await CouponModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_COUPON',
      resourceType: 'Coupon',
      resourceId: String(deleted._id),
      details: { code: deleted.code },
      ipAddress: req.ip,
    });
    res.json({ ok: true });
  })
);

// ADMIN: Discount Rules CRUD
const discountRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().default(''),
  ruleType: z.enum(['percentage', 'fixed', 'bulk_tier']).default('percentage'),
  value: z.number().min(1),
  maxDiscountCap: z.number().min(0).nullable().optional(),
  minOrderAmount: z.number().min(0).default(0),
  minQuantity: z.number().int().min(1).default(1),
  targetScope: z.enum(['all', 'category', 'product', 'customer_group']).default('all'),
  targetIds: z.array(z.string().trim()).default([]),
  priority: z.number().int().default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

router.get(
  '/admin/discount-rules',
  requirePermission('coupons:write'),
  asyncHandler(async (_req, res) => {
    const rules = await DiscountRuleModel.find().sort({ priority: -1, createdAt: -1 }).lean();
    res.json({ rules });
  })
);

router.post(
  '/admin/discount-rules',
  requirePermission('coupons:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = discountRuleSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'End date must be after start date.' });
      return;
    }
    const rule = await DiscountRuleModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_DISCOUNT_RULE',
      resourceType: 'DiscountRule',
      resourceId: String(rule._id),
      details: { name: rule.name, ruleType: rule.ruleType, value: rule.value },
      ipAddress: req.ip,
    });
    res.status(201).json({ rule });
  })
);

router.patch(
  '/admin/discount-rules/:id',
  requirePermission('coupons:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid discount rule ID.' });
      return;
    }
    const parsed = toPatchSchema(discountRuleSchema).parse(req.body);
    const existing = await DiscountRuleModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Discount rule not found' });
      return;
    }
    const nextStartsAt =
      parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined ? (parsed.endsAt ? new Date(parsed.endsAt) : null) : existing.endsAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'End date must be after start date.' });
      return;
    }
    Object.assign(existing, { ...parsed, startsAt: nextStartsAt, endsAt: nextEndsAt });
    await existing.save();
    res.json({ rule: existing });
  })
);

router.delete(
  '/admin/discount-rules/:id',
  requirePermission('coupons:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid discount rule ID.' });
      return;
    }
    const deleted = await DiscountRuleModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Discount rule not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ADMIN: Campaigns CRUD
const campaignSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(150).toLowerCase(),
  description: z.string().trim().max(500).optional().default(''),
  bannerImageUrl: z
    .string()
    .trim()
    .refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid image URL')
    .optional()
    .default(''),
  bannerImagePublicId: z.string().trim().optional().default(''),
  discountLabel: z.string().trim().max(60).optional().default(''),
  discountPercent: z.number().min(0).max(95).default(0),
  productIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'active', 'scheduled', 'ended']).default('draft'),
});

router.get(
  '/admin/campaigns',
  requirePermission('ads:write'),
  asyncHandler(async (_req, res) => {
    const campaigns = await CampaignModel.find().sort({ createdAt: -1 }).lean();
    res.json({ campaigns });
  })
);

router.post(
  '/admin/campaigns',
  requirePermission('ads:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = campaignSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Campaign end date must be after start date.' });
      return;
    }
    const campaign = await CampaignModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_CAMPAIGN',
      resourceType: 'Campaign',
      resourceId: String(campaign._id),
      details: { name: campaign.name, status: campaign.status },
      ipAddress: req.ip,
    });
    res.status(201).json({ campaign });
  })
);

router.patch(
  '/admin/campaigns/:id',
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid campaign ID.' });
      return;
    }
    const parsed = toPatchSchema(campaignSchema).parse(req.body);
    const existing = await CampaignModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const nextStartsAt =
      parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined ? (parsed.endsAt ? new Date(parsed.endsAt) : null) : existing.endsAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Campaign end date must be after start date.' });
      return;
    }
    const prevPublicId = existing.bannerImagePublicId;
    Object.assign(existing, { ...parsed, startsAt: nextStartsAt, endsAt: nextEndsAt });
    await existing.save();
    if (prevPublicId && prevPublicId !== existing.bannerImagePublicId) {
      void destroyCloudinaryAssetIfUnused(prevPublicId);
    }
    res.json({ campaign: existing });
  })
);

router.delete(
  '/admin/campaigns/:id',
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid campaign ID.' });
      return;
    }
    const deleted = await CampaignModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    if (deleted.bannerImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.bannerImagePublicId);
    }
    res.json({ ok: true });
  })
);

// ADMIN: Advertisements CRUD
const adSchema = z.object({
  title: z.string().trim().min(2).max(140),
  placement: z
    .enum(['homepage_top', 'homepage_mid', 'sidebar', 'category_top', 'product_detail', 'global_banner'])
    .default('global_banner'),
  desktopImageUrl: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isSafeDestinationUrl(v, { allowRelative: true }), 'Invalid desktop image URL'),
  desktopImagePublicId: z.string().trim().optional(),
  mobileImageUrl: z
    .string()
    .trim()
    .refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid mobile image URL')
    .optional()
    .default(''),
  mobileImagePublicId: z.string().trim().optional(),
  targetUrl: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v), 'Invalid target URL'),
  altText: z.string().trim().min(2).max(180).default('Promotional Advertisement'),
  status: z.enum(['active', 'paused', 'scheduled']).default('active'),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

router.get(
  '/admin/ads',
  requirePermission('ads:write'),
  asyncHandler(async (_req, res) => {
    const ads = await AdvertisementModel.find().sort({ createdAt: -1 }).lean();
    res.json({ ads });
  })
);

router.post(
  '/admin/ads',
  requirePermission('ads:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = adSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Ad end date must be after start date.' });
      return;
    }
    const ad = await AdvertisementModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_ADVERTISEMENT',
      resourceType: 'Advertisement',
      resourceId: String(ad._id),
      details: { title: ad.title, placement: ad.placement },
      ipAddress: req.ip,
    });
    res.status(201).json({ ad });
  })
);

router.patch(
  '/admin/ads/:id',
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid ad ID.' });
      return;
    }
    const parsed = toPatchSchema(adSchema).parse(req.body);
    const existing = await AdvertisementModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Advertisement not found' });
      return;
    }
    const nextStartsAt =
      parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined ? (parsed.endsAt ? new Date(parsed.endsAt) : null) : existing.endsAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Ad end date must be after start date.' });
      return;
    }
    const prevDesktopId = existing.desktopImagePublicId;
    const prevMobileId = existing.mobileImagePublicId;
    Object.assign(existing, { ...parsed, startsAt: nextStartsAt, endsAt: nextEndsAt });
    await existing.save();
    if (prevDesktopId && prevDesktopId !== existing.desktopImagePublicId) {
      void destroyCloudinaryAssetIfUnused(prevDesktopId);
    }
    if (prevMobileId && prevMobileId !== existing.mobileImagePublicId) {
      void destroyCloudinaryAssetIfUnused(prevMobileId);
    }
    res.json({ ad: existing });
  })
);

router.delete(
  '/admin/ads/:id',
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid ad ID.' });
      return;
    }
    const deleted = await AdvertisementModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Advertisement not found' });
      return;
    }
    if (deleted.desktopImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.desktopImagePublicId);
    }
    if (deleted.mobileImagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.mobileImagePublicId);
    }
    res.json({ ok: true });
  })
);

// ADMIN: Promo Popups CRUD
const popupSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(400).optional().default(''),
  ctaText: z.string().trim().max(40).optional().default('Claim Offer'),
  ctaUrl: z.string().trim().min(1).refine((v) => isSafeDestinationUrl(v), 'Invalid CTA URL'),
  imageUrl: z
    .string()
    .trim()
    .refine((v) => !v || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid image URL')
    .optional()
    .default(''),
  imagePublicId: z.string().trim().optional().default(''),
  displayFrequency: z
    .enum(['once_per_session', 'once_per_day', 'once_ever', 'always'])
    .default('once_per_session'),
  delaySeconds: z.number().int().min(0).max(60).default(3),
  targetPages: z.array(z.string().trim()).default(['*']),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isEnabled: z.boolean().default(false),
});

router.get(
  '/admin/popups',
  requirePermission('ads:write'),
  asyncHandler(async (_req, res) => {
    const popups = await PromoPopupModel.find().sort({ createdAt: -1 }).lean();
    res.json({ popups });
  })
);

router.post(
  '/admin/popups',
  requirePermission('ads:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = popupSchema.parse(req.body);
    if (!hasValidScheduleWindow(parsed.startsAt, parsed.endsAt)) {
      res.status(400).json({ error: 'Popup end date must be after start date.' });
      return;
    }
    const popup = await PromoPopupModel.create({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_PROMO_POPUP',
      resourceType: 'PromoPopup',
      resourceId: String(popup._id),
      details: { title: popup.title, isEnabled: popup.isEnabled },
      ipAddress: req.ip,
    });
    res.status(201).json({ popup });
  })
);

router.patch(
  '/admin/popups/:id',
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid popup ID.' });
      return;
    }
    const parsed = toPatchSchema(popupSchema).parse(req.body);
    const existing = await PromoPopupModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Promotional popup not found' });
      return;
    }
    const nextStartsAt =
      parsed.startsAt !== undefined ? (parsed.startsAt ? new Date(parsed.startsAt) : null) : existing.startsAt;
    const nextEndsAt =
      parsed.endsAt !== undefined ? (parsed.endsAt ? new Date(parsed.endsAt) : null) : existing.endsAt;
    if (!hasValidScheduleWindow(nextStartsAt, nextEndsAt)) {
      res.status(400).json({ error: 'Popup end date must be after start date.' });
      return;
    }
    const prevPopupImageId = existing.imagePublicId;
    Object.assign(existing, { ...parsed, startsAt: nextStartsAt, endsAt: nextEndsAt });
    await existing.save();
    if (prevPopupImageId && prevPopupImageId !== existing.imagePublicId) {
      void destroyCloudinaryAssetIfUnused(prevPopupImageId);
    }
    res.json({ popup: existing });
  })
);

router.delete(
  '/admin/popups/:id',
  requirePermission('ads:write'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid popup ID.' });
      return;
    }
    const deleted = await PromoPopupModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Promotional popup not found' });
      return;
    }
    if (deleted.imagePublicId) {
      void destroyCloudinaryAssetIfUnused(deleted.imagePublicId);
    }
    res.json({ ok: true });
  })
);

export default router;
