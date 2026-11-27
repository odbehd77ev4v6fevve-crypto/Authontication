import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  buildSalesTimeSeries,
  computeGrowthPercent,
  computeOrderStatusBreakdown,
  computeTopSellingProducts,
  getNetRecognizedOrderAmount,
  isOrderRevenueEligible,
  rangeToDays,
  type DashboardRange,
} from '../../../../shared/adminAnalytics.ts';
import { escapeHtml, escapeRegex, sanitizeCsvCell } from '../../../../shared/security.ts';
import { userHasEffectivePermission } from '../../services/rbac.service.ts';
import { env } from '../../config/env.ts';
import { requireDatabase } from '../../database/connection.ts';
import { seedDatabaseIfNeeded } from '../../database/seed.ts';
import {
  optionalAuth,
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { sendTransactionalEmail } from '../../services/email.service.ts';
import { CategoryModel, ProductModel } from '../catalog/catalog.model.ts';
import { CampaignModel, CouponModel, ReviewModel } from '../marketing/marketing.model.ts';
import {
  AdminNotificationModel,
  OrderModel,
  PaymentTransactionModel,
  RefundRecordModel,
  ReturnRequestModel,
} from '../orders/order.model.ts';
import { UserModel } from '../users/user.model.ts';
import {
  AuditLogModel,
  NewsletterSubscriptionModel,
  SupportEnquiryModel,
} from './support.model.ts';

const router = Router();
router.use(requireDatabase);

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public: Newsletter Subscribe & Unsubscribe
router.post(
  '/newsletter/subscribe',
  publicFormLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().trim().email().max(150),
      consent: z.boolean().refine((v) => v === true, 'Marketing consent is required.'),
      source: z.enum(['homepage_newsletter', 'footer_newsletter']).optional(),
    });
    const parsed = schema.parse(req.body);
    const email = parsed.email.toLowerCase();

    const existing = await NewsletterSubscriptionModel.findOne({ email });
    if (existing && existing.status === 'subscribed') {
      res.status(409).json({
        error: 'Already subscribed',
        message: 'This email address is already subscribed to our newsletter.',
      });
      return;
    }

    if (existing) {
      existing.status = 'subscribed';
      existing.consentRecordedAt = new Date();
      existing.unsubscribedAt = null;
      if (parsed.source) existing.source = parsed.source;
      await existing.save();
    } else {
      await NewsletterSubscriptionModel.create({
        email,
        status: 'subscribed',
        consentRecordedAt: new Date(),
        unsubscribeToken: crypto.randomBytes(20).toString('hex'),
        source: parsed.source || 'homepage_newsletter',
      });
    }

    res.status(201).json({ ok: true, message: 'Subscribed to NOVARA COMMERCE updates.' });
  })
);

router.post(
  '/newsletter/unsubscribe',
  asyncHandler(async (req, res) => {
    const email = z.string().trim().email().parse(req.body?.email).toLowerCase();
    const sub = await NewsletterSubscriptionModel.findOne({ email });
    if (!sub) {
      res.status(404).json({ error: 'Subscription not found.' });
      return;
    }
    sub.status = 'unsubscribed';
    sub.unsubscribedAt = new Date();
    await sub.save();
    res.json({ ok: true, message: 'You have been unsubscribed.' });
  })
);

// Public: Support Enquiry Submission (with honeypot spam check)
router.post(
  '/enquiries',
  publicFormLimiter,
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (req.body?.website) {
      res.status(400).json({ error: 'Spam detected.' });
      return;
    }

    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(150),
      phone: z.string().trim().max(25).optional(),
      subject: z.string().trim().min(3).max(160),
      orderNumber: z.string().trim().max(40).optional(),
      message: z.string().trim().min(10).max(3000),
    });
    const parsed = schema.parse(req.body);

    const ticketNumber = `SUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const enquiry = await SupportEnquiryModel.create({
      ticketNumber,
      userId: req.user?._id || null,
      ...parsed,
    });

    res.status(201).json({
      ticketNumber: enquiry.ticketNumber,
      message: `Support ticket ${enquiry.ticketNumber} created. Our team will respond shortly.`,
    });
  })
);

// ADMIN: Support Enquiries Management
router.get(
  '/admin/enquiries',
  requireAuth,
  requirePermission('support:manage'),
  asyncHandler(async (_req, res) => {
    const enquiries = await SupportEnquiryModel.find()
      .populate('assignedStaffId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ enquiries });
  })
);

router.patch(
  '/admin/enquiries/:id',
  requireAuth,
  requirePermission('support:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid support enquiry ID.' });
      return;
    }
    const schema = z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      internalNote: z.string().trim().min(2).max(500).optional(),
      assignToSelf: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const enquiry = await SupportEnquiryModel.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ error: 'Support enquiry not found' });
      return;
    }

    if (parsed.status) enquiry.status = parsed.status;
    if (parsed.assignToSelf) enquiry.assignedStaffId = req.user!._id;
    if (parsed.internalNote) {
      enquiry.internalNotes.push({
        note: parsed.internalNote,
        actorName: req.user!.name,
        actorId: req.user!._id,
        createdAt: new Date(),
      });
    }
    await enquiry.save();
    res.json({ enquiry });
  })
);

router.post(
  '/admin/enquiries/:id/reply',
  requireAuth,
  requirePermission('support:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid support enquiry ID.' });
      return;
    }
    const parsed = z
      .object({
        replyMessage: z.string().trim().min(5).max(3000),
        status: z.enum(['in_progress', 'resolved', 'closed']).default('resolved'),
      })
      .parse(req.body);

    const enquiry = await SupportEnquiryModel.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ error: 'Support enquiry not found' });
      return;
    }

    enquiry.status = parsed.status;
    enquiry.assignedStaffId = req.user!._id;
    enquiry.internalNotes.push({
      note: `[Reply sent to ${enquiry.email}]: ${parsed.replyMessage}`,
      actorName: req.user!.name,
      actorId: req.user!._id,
      createdAt: new Date(),
    });
    await enquiry.save();

    const emailRes = await sendTransactionalEmail({
      userId: enquiry.userId ? String(enquiry.userId) : undefined,
      email: enquiry.email,
      type: 'marketing',
      subject: `Re: [${enquiry.ticketNumber}] ${enquiry.subject}`,
      html: `<p>Hello ${escapeHtml(enquiry.name)},</p><p>${escapeHtml(parsed.replyMessage)}</p><hr/><p>Reference Ticket: <strong>${enquiry.ticketNumber}</strong></p>`,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'REPLY_SUPPORT_ENQUIRY',
      resourceType: 'SupportEnquiry',
      resourceId: String(enquiry._id),
      details: { ticketNumber: enquiry.ticketNumber, emailStatus: emailRes.status },
      ipAddress: req.ip,
    });

    res.json({ enquiry, emailStatus: emailRes.status });
  })
);

// ADMIN: Global Search (Ctrl+K)
router.get(
  '/admin/search',
  requireAuth,
  requirePermission('dashboard:view'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 1) {
      res.json({ products: [], orders: [], customers: [], categories: [], coupons: [] });
      return;
    }

    const escaped = escapeRegex(q);
    const regex = { $regex: escaped, $options: 'i' };

    const [canCatalog, canOrders, canCustomers, canCoupons] = await Promise.all([
      userHasEffectivePermission(req.user, 'catalog:read'),
      userHasEffectivePermission(req.user, 'orders:read'),
      userHasEffectivePermission(req.user, 'customers:read'),
      userHasEffectivePermission(req.user, 'coupons:write'),
    ]);

    const [products, categories, orders, customers, coupons] = await Promise.all([
      canCatalog
        ? ProductModel.find({ $or: [{ name: regex }, { sku: regex }], status: { $ne: 'archived' } })
            .select('name sku slug basePrice images status')
            .limit(5)
            .lean()
        : Promise.resolve([]),
      canCatalog
        ? CategoryModel.find({ $or: [{ name: regex }, { slug: regex }] })
            .select('name slug isActive')
            .limit(5)
            .lean()
        : Promise.resolve([]),
      canOrders
        ? OrderModel.find({
            $or: [{ orderNumber: regex }, { customerName: regex }, { customerPhone: regex }],
          })
            .select('orderNumber customerName totalAmount orderStatus createdAt')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
        : Promise.resolve([]),
      canCustomers
        ? UserModel.find({ role: 'customer', $or: [{ name: regex }, { email: regex }, { phone: regex }] })
            .select('name email phone emailVerified isActive')
            .limit(5)
            .lean()
        : Promise.resolve([]),
      canCoupons
        ? CouponModel.find({ $or: [{ code: regex }, { description: regex }] })
            .select('code type value isActive')
            .limit(5)
            .lean()
        : Promise.resolve([]),
    ]);

    res.json({ products, categories, orders, customers, coupons });
  })
);

// ADMIN: System & Security Health Diagnostics
router.get(
  '/admin/system-health',
  requireAuth,
  requirePermission('dashboard:view'),
  asyncHandler(async (_req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    const mem = process.memoryUsage();

    res.json({
      status: dbConnected ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      database: {
        connected: dbConnected,
        state: dbConnected ? 'connected' : 'disconnected',
      },
      integrations: {
        jwtConfigured: Boolean(env.hasConfiguredJwtSecret && env.jwtSecret.length >= 32),
        cloudinaryConfigured: env.cloudinary.isConfigured,
        resendConfigured: env.resend.isConfigured,
        paymentConfigured: env.payment.isGatewayConfigured,
        paymentSandbox: env.payment.sandbox,
        googleOAuthConfigured: env.oauth.isGoogleConfigured,
        facebookOAuthConfigured: env.oauth.isFacebookConfigured,
      },
    });
  })
);

// Shared filtered order query helper for Admin Reports & CSV Exports
export function buildOrderReportFilter(query: Record<string, unknown>, now = new Date()): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const status = typeof query.status === 'string' ? query.status.trim() : '';
  const paymentMethod = typeof query.paymentMethod === 'string' ? query.paymentMethod.trim() : '';
  const paymentStatus = typeof query.paymentStatus === 'string' ? query.paymentStatus.trim() : '';
  const q = typeof query.q === 'string' ? query.q.trim() : '';

  if (status) filter.orderStatus = status;
  if (paymentMethod) {
    if (paymentMethod === 'card' || paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      filter.paymentChannel = paymentMethod;
    } else {
      filter.paymentMethod = paymentMethod;
    }
  }
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const rawDateFrom =
    typeof query.dateFrom === 'string'
      ? query.dateFrom
      : typeof query.startDate === 'string'
        ? query.startDate
        : '';
  const rawDateTo =
    typeof query.dateTo === 'string'
      ? query.dateTo
      : typeof query.endDate === 'string'
        ? query.endDate
        : '';
  const rawRange = typeof query.range === 'string' ? query.range.trim().toUpperCase() : '';
  const rawDays = query.days !== undefined ? Number(query.days) : NaN;

  const createdAtFilter: Record<string, Date> = {};
  if (rawDateFrom || rawDateTo) {
    if (rawDateFrom) {
      const from = new Date(rawDateFrom);
      if (!Number.isNaN(from.getTime())) createdAtFilter.$gte = from;
    }
    if (rawDateTo) {
      const to = new Date(rawDateTo);
      if (!Number.isNaN(to.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateTo.trim())) {
          to.setUTCHours(23, 59, 59, 999);
        } else {
          to.setHours(23, 59, 59, 999);
        }
        createdAtFilter.$lte = to;
      }
    }
  } else if (['7D', '30D', '3M', '1Y'].includes(rawRange)) {
    const days = rangeToDays(rawRange as DashboardRange);
    createdAtFilter.$gte = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  } else if (Number.isFinite(rawDays) && rawDays > 0) {
    const clampedDays = Math.min(365, Math.max(1, Math.round(rawDays)));
    createdAtFilter.$gte = new Date(now.getTime() - clampedDays * 24 * 60 * 60 * 1000);
  }

  if (Object.keys(createdAtFilter).length > 0) {
    filter.createdAt = createdAtFilter;
  }

  if (q) {
    const escaped = escapeRegex(q);
    filter.$or = [
      { orderNumber: { $regex: escaped, $options: 'i' } },
      { customerName: { $regex: escaped, $options: 'i' } },
      { customerEmail: { $regex: escaped, $options: 'i' } },
      { customerPhone: { $regex: escaped, $options: 'i' } },
      { transactionRef: { $regex: escaped, $options: 'i' } },
    ];
  }

  return filter;
}

// ADMIN: Overview Dashboard KPIs & Charts
router.get(
  '/admin/dashboard',
  requireAuth,
  requirePermission('dashboard:view'),
  asyncHandler(async (req, res) => {
    const rawRange = typeof req.query.range === 'string' ? req.query.range.toUpperCase() : '30D';
    const range: DashboardRange = (['7D', '30D', '3M', '1Y'].includes(rawRange)
      ? rawRange
      : '30D') as DashboardRange;
    const days = req.query.days ? Math.min(365, Math.max(1, Number(req.query.days))) : rangeToDays(range);
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    const [
      ordersWindow,
      recentOrders,
      allProducts,
      totalCustomers,
      newCustomersCurrent,
      newCustomersPrevious,
      customerSignupsWindow,
      latestCustomers,
      pendingReviewsCount,
      openReturnsCount,
      cancellationRequestsCount,
      openSupportCount,
      unreadNotificationsCount,
      recentAuditLogs,
      activeCoupon,
      activeCampaign,
    ] = await Promise.all([
      OrderModel.find({ createdAt: { $gte: previousStart } })
        .select('orderNumber customerName customerEmail totalAmount subtotal discountAmount shippingCharge taxAmount orderStatus paymentMethod paymentStatus createdAt items')
        .sort({ createdAt: -1 })
        .lean(),
      OrderModel.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select('orderNumber customerName customerEmail totalAmount orderStatus paymentStatus createdAt items')
        .lean(),
      ProductModel.find({ status: { $ne: 'archived' } })
        .select('name sku stockOnHand reservedStock lowStockThreshold variants basePrice salePrice salesCount images status createdAt')
        .lean(),
      UserModel.countDocuments({ role: 'customer' }),
      UserModel.countDocuments({ role: 'customer', createdAt: { $gte: currentStart, $lte: now } }),
      UserModel.countDocuments({ role: 'customer', createdAt: { $gte: previousStart, $lt: currentStart } }),
      UserModel.find({ role: 'customer', createdAt: { $gte: currentStart, $lte: now } })
        .select('createdAt')
        .lean(),
      UserModel.find({ role: 'customer' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email avatarUrl emailVerified isActive createdAt')
        .lean(),
      ReviewModel.countDocuments({ status: 'pending' }),
      ReturnRequestModel.countDocuments({ status: { $in: ['requested', 'approved', 'received'] } }),
      OrderModel.countDocuments({ 'cancellationRequest.status': 'requested' }),
      SupportEnquiryModel.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      AdminNotificationModel.countDocuments({ isRead: false }),
      AuditLogModel.find().sort({ createdAt: -1 }).limit(8).lean(),
      CouponModel.findOne({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
      })
        .sort({ value: -1, createdAt: -1 })
        .lean(),
      CampaignModel.findOne({ status: 'active' }).sort({ discountPercent: -1, createdAt: -1 }).lean(),
    ]);

    const windowOrderIds = ordersWindow.map((o) => o._id);
    const processedRefunds =
      windowOrderIds.length > 0
        ? await RefundRecordModel.find({ orderId: { $in: windowOrderIds }, status: 'processed' })
            .select('orderId amount')
            .lean()
        : [];
    const refundByOrderId = new Map<string, number>();
    for (const rf of processedRefunds) {
      const key = String(rf.orderId);
      refundByOrderId.set(key, (refundByOrderId.get(key) || 0) + Number(rf.amount || 0));
    }

    const enrichedOrders = ordersWindow.map((o) => ({
      ...o,
      _id: String(o._id),
      refundedAmount: refundByOrderId.get(String(o._id)) || 0,
    }));

    const currentOrders = enrichedOrders.filter((o) => new Date(o.createdAt) >= currentStart);
    const previousOrders = enrichedOrders.filter((o) => new Date(o.createdAt) < currentStart);

    const eligibleCurrent = currentOrders.filter((o) => isOrderRevenueEligible(o));
    const eligiblePrevious = previousOrders.filter((o) => isOrderRevenueEligible(o));

    const grossSales = currentOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const netSales = eligibleCurrent.reduce((s, o) => s + getNetRecognizedOrderAmount(o), 0);
    const prevNetSales = eligiblePrevious.reduce((s, o) => s + getNetRecognizedOrderAmount(o), 0);

    const orderCount = currentOrders.length;
    const prevOrderCount = previousOrders.length;
    const avgOrderValue =
      eligibleCurrent.length > 0 ? Math.round(netSales / eligibleCurrent.length) : 0;
    const pendingOrders = currentOrders.filter((o) => o.orderStatus === 'pending').length;
    const cancelledOrRefundedCount = currentOrders.filter((o) =>
      ['cancelled', 'payment_failed', 'returned', 'refunded'].includes(o.orderStatus)
    ).length;

    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter((p) => p.status === 'published').length;

    // Build 7-point customer signup sparkline across the current window
    const customerSparkBuckets = 7;
    const customerSparkValues = Array.from({ length: customerSparkBuckets }, () => 0);
    const sparkSpanMs = Math.max(1, now.getTime() - currentStart.getTime()) / customerSparkBuckets;
    for (const cust of customerSignupsWindow) {
      const createdMs = new Date(cust.createdAt).getTime();
      if (Number.isNaN(createdMs)) continue;
      const idx = Math.min(
        customerSparkBuckets - 1,
        Math.max(0, Math.floor((createdMs - currentStart.getTime()) / sparkSpanMs))
      );
      customerSparkValues[idx] += 1;
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inventoryValuation = 0;

    for (const p of allProducts) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const avail = Math.max(0, v.stockOnHand - v.reservedStock);
          if (avail === 0) outOfStockCount += 1;
          else if (avail <= v.lowStockThreshold) lowStockCount += 1;
          inventoryValuation += v.stockOnHand * (v.price ?? p.basePrice);
        }
      } else {
        const avail = Math.max(0, p.stockOnHand - p.reservedStock);
        if (avail === 0) outOfStockCount += 1;
        else if (avail <= p.lowStockThreshold) lowStockCount += 1;
        inventoryValuation += p.stockOnHand * p.basePrice;
      }
    }

    const salesSeries = buildSalesTimeSeries(
      enrichedOrders.map((o) => ({
        _id: o._id,
        totalAmount: o.totalAmount,
        refundedAmount: o.refundedAmount,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      range,
      now
    );

    const statusBreakdown = computeOrderStatusBreakdown(currentOrders);
    const topSellingProducts = computeTopSellingProducts(
      currentOrders.map((o) => ({
        _id: o._id,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        items: o.items,
      })),
      allProducts.map((p) => ({
        _id: String(p._id),
        name: p.name,
        sku: p.sku,
        basePrice: p.basePrice,
        salePrice: p.salePrice,
        salesCount: p.salesCount,
        images: p.images,
      })),
      5,
      { allowSalesCountFallback: false }
    );

    const dbConnected = mongoose.connection.readyState === 1;

    res.json({
      range,
      days,
      metrics: {
        grossSales,
        netSales,
        salesGrowthPercent: computeGrowthPercent(netSales, prevNetSales),
        orderCount,
        ordersGrowthPercent: computeGrowthPercent(orderCount, prevOrderCount),
        totalCustomers,
        newCustomersCurrent,
        customersGrowthPercent: computeGrowthPercent(newCustomersCurrent, newCustomersPrevious),
        customerSparkValues,
        totalProducts,
        activeProducts,
        avgOrderValue,
        pendingOrders,
        cancelledOrRefundedCount,
        lowStockCount,
        outOfStockCount,
        inventoryValuation,
        pendingReviewsCount,
        openReturnsCount,
        cancellationRequestsCount,
        openSupportCount,
        unreadNotificationsCount,
      },
      salesOverview: salesSeries,
      orderStatusBreakdown: statusBreakdown,
      topSellingProducts,
      recentOrders,
      latestCustomers,
      specialOffer: activeCampaign
        ? {
            kind: 'campaign',
            title: activeCampaign.name,
            highlight: activeCampaign.discountLabel || `${activeCampaign.discountPercent}% OFF`,
            subtitle: activeCampaign.description || 'Active promotional campaign',
            code: activeCampaign.slug,
          }
        : activeCoupon
        ? {
            kind: 'coupon',
            title: 'Special Offer',
            highlight:
              activeCoupon.type === 'percentage'
                ? `${activeCoupon.value}% OFF`
                : `৳${activeCoupon.value} OFF`,
            subtitle: activeCoupon.description || `Code: ${activeCoupon.code}`,
            code: activeCoupon.code,
          }
        : null,
      recentAuditLogs,
      securitySummary: {
        dbConnected,
        jwtConfigured: Boolean(env.hasConfiguredJwtSecret && env.jwtSecret.length >= 32),
        paymentSandbox: env.payment.sandbox,
      },
    });
  })
);

// ADMIN: Detailed Reports & Analytics
router.get(
  '/admin/analytics',
  requireAuth,
  requirePermission('reports:read'),
  asyncHandler(async (req, res) => {
    const rawRange = typeof req.query.range === 'string' ? req.query.range.toUpperCase() : '30D';
    const range: DashboardRange = (['7D', '30D', '3M', '1Y'].includes(rawRange)
      ? rawRange
      : '30D') as DashboardRange;
    const days = req.query.days ? Math.min(365, Math.max(1, Number(req.query.days))) : rangeToDays(range);
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    const [ordersWindow, products, customers, newCustomersCount, processedRefundsWindow, topCustomersAgg] =
      await Promise.all([
        OrderModel.find({ createdAt: { $gte: prevStart } }).sort({ createdAt: -1 }).lean(),
        ProductModel.find({ status: { $ne: 'archived' } })
          .select('name sku basePrice purchasePrice costPrice salePrice stockOnHand reservedStock lowStockThreshold variants salesCount images status')
          .lean(),
        UserModel.countDocuments({ role: 'customer' }),
        UserModel.countDocuments({ role: 'customer', createdAt: { $gte: since } }),
        RefundRecordModel.find({ createdAt: { $gte: prevStart }, status: 'processed' })
          .select('orderId amount createdAt')
          .lean(),
        OrderModel.aggregate<{
          _id: mongoose.Types.ObjectId;
          ordersCount: number;
          totalSpent: number;
          customerName: string;
          customerEmail: string;
        }>([
          {
            $match: {
              createdAt: { $gte: since },
              orderStatus: { $nin: ['cancelled', 'payment_failed', 'refunded', 'returned'] },
              paymentStatus: { $nin: ['failed', 'refunded'] },
              $or: [
                { paymentMethod: 'cod' },
                { paymentStatus: { $in: ['paid', 'refund_pending'] } },
              ],
            },
          },
          {
            $group: {
              _id: '$userId',
              ordersCount: { $sum: 1 },
              totalSpent: { $sum: '$totalAmount' },
              customerName: { $first: '$customerName' },
              customerEmail: { $first: '$customerEmail' },
            },
          },
          { $sort: { totalSpent: -1 } },
          { $limit: 10 },
        ]),
      ]);

    const refundByOrderId = new Map<string, number>();
    for (const rf of processedRefundsWindow) {
      const key = String(rf.orderId);
      refundByOrderId.set(key, (refundByOrderId.get(key) || 0) + Number(rf.amount || 0));
    }

    const enrichedOrders = ordersWindow.map((o) => ({
      ...o,
      _id: String(o._id),
      refundedAmount: refundByOrderId.get(String(o._id)) || 0,
    }));

    const currentOrders = enrichedOrders.filter((o) => new Date(o.createdAt) >= since);
    const validCurrent = currentOrders.filter((o) => isOrderRevenueEligible(o));

    const grossSales = currentOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const netRevenue = validCurrent.reduce((s, o) => s + getNetRecognizedOrderAmount(o), 0);
    const discountsGiven = validCurrent.reduce((s, o) => s + Number(o.discountAmount || 0), 0);
    const shippingCollected = validCurrent.reduce((s, o) => s + Number(o.shippingCharge || 0), 0);
    const taxCollected = validCurrent.reduce((s, o) => s + Number(o.taxAmount || 0), 0);
    const refundedAmount = processedRefundsWindow
      .filter((rf) => new Date(rf.createdAt) >= since)
      .reduce((sum, rf) => sum + Number(rf.amount || 0), 0);

    const salesSeries = buildSalesTimeSeries(
      enrichedOrders.map((o) => ({
        _id: o._id,
        totalAmount: o.totalAmount,
        refundedAmount: o.refundedAmount,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      range,
      now
    );

    const topProducts = computeTopSellingProducts(
      currentOrders.map((o) => ({
        _id: o._id,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        items: o.items,
      })),
      products.map((p) => ({
        _id: String(p._id),
        name: p.name,
        sku: p.sku,
        basePrice: p.basePrice,
        salePrice: p.salePrice,
        salesCount: p.salesCount,
        images: p.images,
      })),
      15,
      { allowSalesCountFallback: false }
    );

    let totalUnits = 0;
    let inventoryValuation = 0;
    let costValuation = 0;
    let costedSkuCount = 0;
    let uncostedSkuCount = 0;
    const lowStockItems: Array<{ name: string; sku: string; available: number; threshold: number }> = [];

    for (const p of products) {
      const unitCost =
        typeof p.costPrice === 'number' && Number.isFinite(p.costPrice)
          ? p.costPrice
          : typeof p.purchasePrice === 'number' && Number.isFinite(p.purchasePrice)
            ? p.purchasePrice
            : null;

      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const avail = Math.max(0, v.stockOnHand - v.reservedStock);
          totalUnits += v.stockOnHand;
          inventoryValuation += v.stockOnHand * (v.price ?? p.basePrice);
          if (unitCost !== null) {
            costValuation += v.stockOnHand * unitCost;
            costedSkuCount += 1;
          } else {
            uncostedSkuCount += 1;
          }
          if (avail <= v.lowStockThreshold) {
            lowStockItems.push({ name: `${p.name} (${v.title})`, sku: v.sku, available: avail, threshold: v.lowStockThreshold });
          }
        }
      } else {
        const avail = Math.max(0, p.stockOnHand - p.reservedStock);
        totalUnits += p.stockOnHand;
        inventoryValuation += p.stockOnHand * p.basePrice;
        if (unitCost !== null) {
          costValuation += p.stockOnHand * unitCost;
          costedSkuCount += 1;
        } else {
          uncostedSkuCount += 1;
        }
        if (avail <= p.lowStockThreshold) {
          lowStockItems.push({ name: p.name, sku: p.sku, available: avail, threshold: p.lowStockThreshold });
        }
      }
    }

    res.json({
      range,
      days,
      revenue: {
        grossSales,
        netRevenue,
        discountsGiven,
        shippingCollected,
        taxCollected,
        refundedAmount,
        ordersCount: currentOrders.length,
        avgOrderValue: validCurrent.length > 0 ? Math.round(netRevenue / validCurrent.length) : 0,
      },
      salesSeries,
      orderStatusBreakdown: computeOrderStatusBreakdown(currentOrders),
      topProducts,
      customers: {
        totalCustomers: customers,
        newCustomersCount,
        repeatBuyersCount: topCustomersAgg.filter((c) => c.ordersCount > 1).length,
        topSpenders: topCustomersAgg,
      },
      inventory: {
        totalProducts: products.length,
        totalUnits,
        inventoryValuation,
        costValuation: Math.round(costValuation),
        costedSkuCount,
        uncostedSkuCount,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 25),
      },
    });
  })
);

router.get(
  '/admin/reports',
  requireAuth,
  requirePermission('reports:read'),
  asyncHandler(async (req, res) => {
    const orderFilter = buildOrderReportFilter(req.query as Record<string, unknown>);
    const filteredOrders = await OrderModel.find(orderFilter)
      .select('_id totalAmount orderStatus paymentMethod paymentStatus items createdAt')
      .lean();
    const orderIds = filteredOrders.map((o) => o._id);

    const [ordersByStatus, paymentSummary, refundSummary, couponStats, catalogProducts] =
      await Promise.all([
        OrderModel.aggregate([
          { $match: orderFilter },
          { $group: { _id: '$orderStatus', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
        ]),
        PaymentTransactionModel.aggregate([
          ...(Object.keys(orderFilter).length > 0
            ? [{ $match: { orderId: { $in: orderIds } } }]
            : []),
          { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
        ]),
        RefundRecordModel.aggregate([
          ...(Object.keys(orderFilter).length > 0
            ? [{ $match: { orderId: { $in: orderIds } } }]
            : []),
          { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
        ]),
        CouponModel.find().select('code type value usedCount usageLimit isActive').lean(),
        ProductModel.find({ status: { $ne: 'archived' } })
          .select('name sku basePrice salePrice images')
          .lean(),
      ]);

    const topProducts = computeTopSellingProducts(
      filteredOrders.map((o) => ({
        _id: String(o._id),
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        items: o.items,
      })),
      catalogProducts.map((p) => ({
        _id: String(p._id),
        name: p.name,
        sku: p.sku,
        basePrice: p.basePrice,
        salePrice: p.salePrice,
        images: p.images,
      })),
      10,
      { allowSalesCountFallback: false }
    );

    res.json({ ordersByStatus, paymentSummary, refundSummary, couponStats, topProducts });
  })
);

router.get(
  '/admin/reports/orders.csv',
  requireAuth,
  requirePermission('reports:read'),
  asyncHandler(async (req, res) => {
    const orderFilter = buildOrderReportFilter(req.query as Record<string, unknown>);
    const orders = await OrderModel.find(orderFilter).sort({ createdAt: -1 }).limit(2000).lean();
    const orderIds = orders.map((o) => o._id);
    const processedRefunds =
      orderIds.length > 0
        ? await RefundRecordModel.find({ orderId: { $in: orderIds }, status: 'processed' })
            .select('orderId amount')
            .lean()
        : [];
    const refundByOrderId = new Map<string, number>();
    for (const rf of processedRefunds) {
      const key = String(rf.orderId);
      refundByOrderId.set(key, (refundByOrderId.get(key) || 0) + Number(rf.amount || 0));
    }

    const lines = [
      'orderNumber,date,customerName,phone,district,paymentMethod,paymentChannel,paymentStatus,orderStatus,couponCode,subtotal,discount,shipping,tax,refunded,netTotal,total',
    ];
    for (const o of orders) {
      const refundedAmt = refundByOrderId.get(String(o._id)) || 0;
      const netTotal = ['cancelled', 'payment_failed', 'refunded', 'returned'].includes(o.orderStatus)
        ? 0
        : Math.max(0, Number(o.totalAmount || 0) - refundedAmt);
      lines.push(
        [
          sanitizeCsvCell(o.orderNumber),
          new Date(o.createdAt).toISOString(),
          sanitizeCsvCell(o.customerName),
          sanitizeCsvCell(o.customerPhone),
          sanitizeCsvCell(o.shippingAddress.districtName),
          sanitizeCsvCell(o.paymentMethod),
          sanitizeCsvCell(o.paymentChannel || o.paymentMethod),
          sanitizeCsvCell(o.paymentStatus),
          sanitizeCsvCell(o.orderStatus),
          sanitizeCsvCell(o.couponCode || ''),
          o.subtotal,
          o.discountAmount,
          o.shippingCharge,
          o.taxAmount || 0,
          refundedAmt,
          netTotal,
          o.totalAmount,
        ].join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="novara-orders-report.csv"');
    res.send(lines.join('\n'));
  })
);

router.get(
  '/admin/audit-logs',
  requireAuth,
  requirePermission('audit:read'),
  asyncHandler(async (req, res) => {
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (q) {
      const escaped = escapeRegex(q);
      filter.$or = [
        { actorEmail: { $regex: escaped, $options: 'i' } },
        { action: { $regex: escaped, $options: 'i' } },
        { resourceType: { $regex: escaped, $options: 'i' } },
      ];
    }
    const logs = await AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(150).lean();
    res.json({ logs });
  })
);

// Super Admin: Idempotent Sample Bangladesh Catalog Seeder (writes real records to MongoDB Atlas)
router.post(
  '/admin/seed-catalog',
  requireAuth,
  requirePermission('settings:write'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await seedDatabaseIfNeeded({ forceCatalog: true });
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'SEED_CATALOG',
      resourceType: 'System',
      details: result,
      ipAddress: req.ip,
    });
    res.json({ ok: true, ...result });
  })
);

export default router;
