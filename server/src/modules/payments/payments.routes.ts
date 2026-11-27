import crypto from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { sendTransactionalEmail } from '../../services/email.service.ts';
import {
  getPaymentGatewayStatus,
  initiateSslCommerzRefund,
  querySslCommerzRefundStatus,
  verifySslCommerzCallback,
  verifySslCommerzIpnSignature,
} from '../../services/payment.service.ts';
import { StoreSettingsModel } from '../cms/cms.model.ts';
import { releaseReservedInventory } from '../inventory/inventory.routes.ts';
import {
  AdminNotificationModel,
  OrderModel,
  PaymentTransactionModel,
  RefundRecordModel,
} from '../orders/order.model.ts';
import { releaseOrderCouponRedemption } from '../orders/orderCoupon.service.ts';

const router = Router();
router.use(requireDatabase);

export function isAuthorizedSslCommerzIpn(
  body: Record<string, unknown>,
  headers: Record<string, unknown>,
  paymentConfig: {
    webhookSecret: string;
    isGatewayConfigured: boolean;
    storeId: string;
    storePassword: string;
  } = env.payment
): boolean {
  const rawWebhookHeader = headers['x-webhook-secret'];
  const webhookHeader = typeof rawWebhookHeader === 'string' ? rawWebhookHeader : '';
  const secretConfigured = Boolean(paymentConfig.webhookSecret);
  const webhookSecretMatches =
    secretConfigured &&
    webhookHeader.length === paymentConfig.webhookSecret.length &&
    crypto.timingSafeEqual(
      Buffer.from(webhookHeader),
      Buffer.from(paymentConfig.webhookSecret)
    );

  const storeId = typeof body.store_id === 'string' ? body.store_id.trim() : '';
  const signatureValid =
    paymentConfig.isGatewayConfigured &&
    storeId === paymentConfig.storeId &&
    verifySslCommerzIpnSignature(body, paymentConfig.storePassword);

  return webhookSecretMatches || signatureValid;
}

async function resolveCodEnabledFromSettings(): Promise<boolean> {
  const settings = await StoreSettingsModel.findOne({ key: 'primary' })
    .select('paymentMethods')
    .lean();
  const codRow = settings?.paymentMethods?.find(
    (m: { key: string; enabled: boolean }) => m.key === 'cod'
  );
  return codRow ? Boolean(codRow.enabled) : true;
}

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const codEnabled = await resolveCodEnabledFromSettings();
    res.json(getPaymentGatewayStatus(codEnabled));
  })
);

// Idempotent SSLCommerz server-verified IPN & callback handlers
async function handleGatewaySuccess(tranId: string, valId: string) {
  const tx = await PaymentTransactionModel.findOne({ transactionRef: tranId });
  if (!tx) return { found: false, alreadyProcessed: false, verified: false };

  // Idempotency guard: if already verified or refunded, do not double-process
  if (tx.status === 'verified' || tx.status === 'refunded') {
    return { found: true, alreadyProcessed: true, verified: true, orderNumber: tx.orderNumber };
  }

  const verification = await verifySslCommerzCallback({
    valId,
    tranId,
    expectedAmount: tx.amount,
  });

  if (!verification.verified) {
    // Non-destructive telemetry note only — NEVER poison tx.status to 'failed' here
    // because unverified redirect or tampered query must not block real IPN verification.
    await PaymentTransactionModel.updateOne(
      { _id: tx._id, status: { $in: ['initiated', 'pending'] } },
      {
        $set: {
          rawPayloadSummary: {
            ...(tx.rawPayloadSummary || {}),
            lastUnverifiedReason: verification.reason,
            lastCheckedAt: new Date().toISOString(),
          },
        },
      }
    );
    return {
      found: true,
      verified: false,
      reason: verification.reason,
      orderNumber: tx.orderNumber,
    };
  }

  const claimedTx = await PaymentTransactionModel.findOneAndUpdate(
    { _id: tx._id, status: { $nin: ['verified', 'refunded'] } },
    {
      $set: {
        status: 'verified',
        providerValId: verification.providerValId,
        bankTranId: verification.bankTranId,
        storeAmount: verification.storeAmount,
        riskLevel: verification.riskLevel,
        channel: verification.channel,
        rawPayloadSummary: verification.rawSummary,
        verifiedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claimedTx) {
    return { found: true, alreadyProcessed: true, verified: true, orderNumber: tx.orderNumber };
  }

  const existingOrder = await OrderModel.findById(claimedTx.orderId)
    .select('orderStatus paymentStatus')
    .lean();
  const nextOrderStatus =
    existingOrder &&
    (existingOrder.orderStatus === 'pending' || existingOrder.orderStatus === 'payment_failed')
      ? 'confirmed'
      : existingOrder?.orderStatus || 'confirmed';

  const updatedOrder = await OrderModel.findOneAndUpdate(
    { _id: claimedTx.orderId, paymentStatus: { $ne: 'paid' } },
    {
      $set: {
        paymentStatus: 'paid',
        orderStatus: nextOrderStatus,
        paymentExpiresAt: null,
      },
      $push: {
        statusHistory: {
          status: nextOrderStatus,
          paymentStatus: 'paid',
          note: `Payment verified via ${verification.channel || 'SSLCommerz'} (${tranId})`,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (updatedOrder) {
    await AdminNotificationModel.create({
      type: 'payment_verified',
      title: `Payment Verified · ${updatedOrder.orderNumber}`,
      message: `৳${updatedOrder.totalAmount.toLocaleString()} verified via ${verification.channel || 'SSLCommerz'}.`,
      orderNumber: updatedOrder.orderNumber,
      orderId: updatedOrder._id,
    });

    void sendTransactionalEmail({
      userId: String(updatedOrder.userId),
      email: updatedOrder.customerEmail,
      type: 'payment_status',
      subject: `Payment confirmed for NOVARA Order ${updatedOrder.orderNumber}`,
      html: `<p>Your payment of <strong>৳${updatedOrder.totalAmount.toLocaleString()}</strong> for order <strong>${updatedOrder.orderNumber}</strong> is verified.</p>`,
    });
  }

  return { found: true, verified: true, orderNumber: tx.orderNumber };
}

async function handleGatewayFailureOrCancel(
  tranId: string,
  outcome: 'failed' | 'cancelled',
  sourceLabel: string
) {
  const claimedTx = await PaymentTransactionModel.findOneAndUpdate(
    { transactionRef: tranId, status: { $in: ['initiated', 'pending'] } },
    { $set: { status: outcome } },
    { new: true }
  );

  if (!claimedTx) {
    const existingTx = await PaymentTransactionModel.findOne({ transactionRef: tranId })
      .select('orderNumber')
      .lean();
    return { found: Boolean(existingTx), orderNumber: existingTx?.orderNumber || '' };
  }

  const claimedOrder = await OrderModel.findOneAndUpdate(
    {
      _id: claimedTx.orderId,
      orderStatus: 'pending',
      paymentStatus: { $nin: ['paid', 'refund_pending', 'refunded'] },
    },
    {
      $set: {
        paymentStatus: 'failed',
        orderStatus: 'payment_failed',
        fulfillmentStatus: 'cancelled',
        paymentExpiresAt: null,
      },
      $push: {
        statusHistory: {
          status: 'payment_failed',
          paymentStatus: 'failed',
          fulfillmentStatus: 'cancelled',
          note: `Payment ${outcome} via ${sourceLabel} (${tranId})`,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (claimedOrder) {
    await releaseReservedInventory({
      items: claimedOrder.items.map(
        (i: { productId: unknown; variantId?: unknown; sku: string; quantity: number }) => ({
          productId: String(i.productId),
          variantId: i.variantId ? String(i.variantId) : null,
          sku: i.sku,
          quantity: i.quantity,
        })
      ),
      reason: `Payment ${outcome} for ${claimedOrder.orderNumber}`,
      orderId: claimedOrder._id,
    });
    await releaseOrderCouponRedemption(claimedOrder._id);
  }

  return { found: true, orderNumber: claimedTx.orderNumber };
}

async function syncOrderAndTxAfterRefundMutation(orderId: mongoose.Types.ObjectId) {
  const order = await OrderModel.findById(orderId);
  if (!order) return null;

  const allRefunds = await RefundRecordModel.find({ orderId: order._id });
  const processedAmount = allRefunds
    .filter((r) => r.status === 'processed')
    .reduce((sum, r) => sum + r.amount, 0);
  const pendingAmount = allRefunds
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);

  if (processedAmount >= order.totalAmount) {
    order.paymentStatus = 'refunded';
    order.orderStatus = 'refunded';
    await PaymentTransactionModel.updateMany(
      { orderId: order._id, status: 'verified' },
      { $set: { status: 'refunded' } }
    );
  } else if (processedAmount > 0 || pendingAmount > 0) {
    order.paymentStatus = 'refund_pending';
    order.orderStatus = 'refund_pending';
  } else if (order.paymentStatus === 'refund_pending' || order.orderStatus === 'refund_pending') {
    order.paymentStatus = 'paid';
    order.orderStatus = order.deliveredAt ? 'delivered' : 'confirmed';
  }

  await order.save();
  return order;
}

router.post(
  '/sslcommerz/ipn',
  asyncHandler(async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const tranId = String(body.tran_id || '').trim();
    const valId = String(body.val_id || '').trim();
    const status = String(body.status || '').trim().toUpperCase();

    if (!tranId) {
      res.status(400).json({ error: 'Missing tran_id' });
      return;
    }

    // Always verify IPN authenticity BEFORE processing any status (including VALID / VALIDATED)
    if (!isAuthorizedSslCommerzIpn(body, req.headers as Record<string, unknown>)) {
      res.status(403).json({
        error: 'Invalid payment IPN signature',
        code: 'IPN_VERIFICATION_FAILED',
      });
      return;
    }

    if (status === 'VALID' || status === 'VALIDATED') {
      const result = await handleGatewaySuccess(tranId, valId);
      res.json({ ok: true, ...result });
      return;
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      const outcome = status === 'CANCELLED' ? 'cancelled' : 'failed';
      await handleGatewayFailureOrCancel(tranId, outcome, 'gateway IPN');
    }

    res.json({ ok: true });
  })
);

router.post(
  '/sslcommerz/success',
  asyncHandler(async (req, res) => {
    const tranId = String(req.body?.tran_id || '').trim();
    const valId = String(req.body?.val_id || '').trim();
    const result = await handleGatewaySuccess(tranId, valId);
    const dest = result.verified
      ? `${env.appUrl}/order-success/${result.orderNumber || ''}?payment=verified`
      : `${env.appUrl}/order-success/${result.orderNumber || ''}?payment=unverified`;
    res.redirect(302, dest);
  })
);

router.post(
  '/sslcommerz/fail',
  asyncHandler(async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const tranId = String(body.tran_id || '').trim();
    let orderNumber = '';
    if (tranId && isAuthorizedSslCommerzIpn(body, req.headers as Record<string, unknown>)) {
      const outcome = await handleGatewayFailureOrCancel(tranId, 'failed', 'gateway fail callback');
      orderNumber = outcome.orderNumber;
    } else if (tranId) {
      const tx = await PaymentTransactionModel.findOne({ transactionRef: tranId })
        .select('orderNumber')
        .lean();
      orderNumber = tx?.orderNumber || '';
    }
    res.redirect(302, `${env.appUrl}/order-success/${orderNumber}?payment=failed`);
  })
);

router.post(
  '/sslcommerz/cancel',
  asyncHandler(async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const tranId = String(body.tran_id || '').trim();
    let orderNumber = '';
    if (tranId && isAuthorizedSslCommerzIpn(body, req.headers as Record<string, unknown>)) {
      const outcome = await handleGatewayFailureOrCancel(
        tranId,
        'cancelled',
        'gateway cancel callback'
      );
      orderNumber = outcome.orderNumber;
    } else if (tranId) {
      const tx = await PaymentTransactionModel.findOne({ transactionRef: tranId })
        .select('orderNumber')
        .lean();
      orderNumber = tx?.orderNumber || '';
    }
    res.redirect(302, `${env.appUrl}/order-success/${orderNumber}?payment=cancelled`);
  })
);

// ADMIN: Transactions, Reconciliation & Refunds
router.get(
  '/admin/transactions',
  requireAuth,
  requirePermission('payments:read'),
  asyncHandler(async (_req, res) => {
    const [transactions, refunds, codEnabled] = await Promise.all([
      PaymentTransactionModel.find().sort({ createdAt: -1 }).limit(100),
      RefundRecordModel.find().sort({ createdAt: -1 }).limit(100).populate('processedBy', 'name email'),
      resolveCodEnabledFromSettings(),
    ]);
    res.json({ transactions, refunds, gatewayStatus: getPaymentGatewayStatus(codEnabled) });
  })
);

router.post(
  '/admin/refunds',
  requireAuth,
  requirePermission('payments:refund'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      orderId: z.string().min(1),
      amount: z.number().min(1),
      method: z.string().trim().min(2).max(60),
      reason: z.string().trim().min(3).max(300),
      manualOverride: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(parsed.orderId)) {
      res.status(400).json({ error: 'Invalid order ID.' });
      return;
    }

    const order = await OrderModel.findById(parsed.orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'refund_pending') {
      res.status(400).json({ error: 'Only paid orders can be refunded.' });
      return;
    }

    if (parsed.amount > order.totalAmount) {
      res.status(400).json({ error: 'Refund amount cannot exceed order total.' });
      return;
    }

    const existingRefunds = await RefundRecordModel.find({
      orderId: order._id,
      status: { $in: ['pending', 'processed'] },
    });
    const alreadyCommitted = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    if (alreadyCommitted + parsed.amount > order.totalAmount) {
      res.status(409).json({
        error: `Cumulative refund (৳${alreadyCommitted + parsed.amount}) exceeds order total (৳${order.totalAmount}).`,
      });
      return;
    }

    const tx = await PaymentTransactionModel.findOne({ orderId: order._id }).sort({ createdAt: -1 });
    const reference = `RF-${order.orderNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    let refundStatus: 'pending' | 'processed' | 'failed' = 'pending';
    let refundMode: 'gateway_api' | 'manual_offline' = 'manual_offline';
    let bankTranId: string | undefined;
    let refundRefId: string | undefined;
    let providerStatus: string | undefined;
    let failureReason: string | undefined;
    let processedAt: Date | null = null;

    if (order.paymentMethod === 'sslcommerz' && !parsed.manualOverride) {
      const resolvedBankTranId =
        tx?.bankTranId ||
        (typeof tx?.rawPayloadSummary?.bank_tran_id === 'string'
          ? tx.rawPayloadSummary.bank_tran_id
          : undefined);

      if (!resolvedBankTranId) {
        res.status(400).json({
          error:
            'SSLCommerz gateway refund requires bank_tran_id from a verified payment transaction. Enable manualOverride for an offline bank/MFS disbursement.',
          code: 'MISSING_BANK_TRAN_ID',
        });
        return;
      }

      refundMode = 'gateway_api';
      bankTranId = resolvedBankTranId;
      const gatewayResult = await initiateSslCommerzRefund({
        bankTranId: resolvedBankTranId,
        refundAmount: parsed.amount,
        refundRemarks: parsed.reason,
        refId: reference,
      });

      refundStatus = gatewayResult.status;
      refundRefId = gatewayResult.refundRefId;
      providerStatus = gatewayResult.providerStatus;
      failureReason = gatewayResult.errorReason;
      if (gatewayResult.status === 'processed') {
        processedAt = new Date();
      }
    }

    const refund = await RefundRecordModel.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      transactionId: tx?._id,
      amount: parsed.amount,
      method: parsed.method,
      refundMode,
      reference,
      bankTranId,
      refundRefId,
      providerStatus,
      failureReason,
      status: refundStatus,
      reason: parsed.reason,
      processedBy: req.user!._id,
      processedAt,
    });

    const syncedOrder = (await syncOrderAndTxAfterRefundMutation(order._id)) || order;
    syncedOrder.statusHistory.push({
      status: syncedOrder.orderStatus,
      paymentStatus: syncedOrder.paymentStatus,
      note:
        refundMode === 'gateway_api'
          ? `SSLCommerz refund ${refund.status} (৳${parsed.amount}): ${parsed.reason}`
          : `Manual offline refund queued as pending (৳${parsed.amount}): ${parsed.reason}`,
      actorId: req.user!._id,
      actorRole: req.user!.role,
      createdAt: new Date(),
    });
    await syncedOrder.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'PROCESS_REFUND',
      resourceType: 'Order',
      resourceId: String(order._id),
      details: {
        orderNumber: order.orderNumber,
        amount: parsed.amount,
        reason: parsed.reason,
        refundMode,
        status: refund.status,
        refundRefId,
      },
      ipAddress: req.ip,
    });

    if (refund.status === 'processed' || refund.status === 'pending') {
      void sendTransactionalEmail({
        userId: String(order.userId),
        email: order.customerEmail,
        type: 'refund_update',
        subject:
          refund.status === 'processed'
            ? `Refund Processed for Order ${order.orderNumber}`
            : `Refund Initiated for Order ${order.orderNumber}`,
        html:
          refund.status === 'processed'
            ? `<p>A refund of <strong>৳${parsed.amount.toLocaleString()}</strong> has been processed for order <strong>${order.orderNumber}</strong>.</p>`
            : `<p>A refund of <strong>৳${parsed.amount.toLocaleString()}</strong> has been initiated (${refundMode === 'gateway_api' ? 'gateway processing' : 'manual settlement pending'}) for order <strong>${order.orderNumber}</strong>.</p>`,
      });
    }

    res.status(201).json({ refund, order: syncedOrder });
  })
);

router.patch(
  '/admin/refunds/:id',
  requireAuth,
  requirePermission('payments:refund'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      action: z.enum(['complete', 'reject', 'retry']),
      note: z.string().trim().max(300).optional(),
    });
    const parsed = schema.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: 'Invalid refund ID.' });
      return;
    }

    const refund = await RefundRecordModel.findById(req.params.id);
    if (!refund) {
      res.status(404).json({ error: 'Refund record not found' });
      return;
    }

    if (parsed.action === 'retry') {
      if (refund.refundMode !== 'gateway_api' || refund.status !== 'failed' || !refund.bankTranId) {
        res.status(400).json({ error: 'Only failed gateway refunds with bankTranId can be retried.' });
        return;
      }
      const gatewayResult = await initiateSslCommerzRefund({
        bankTranId: refund.bankTranId,
        refundAmount: refund.amount,
        refundRemarks: parsed.note || refund.reason,
        refId: `${refund.reference}-R`,
      });
      refund.status = gatewayResult.status;
      refund.refundRefId = gatewayResult.refundRefId || refund.refundRefId;
      refund.providerStatus = gatewayResult.providerStatus;
      refund.failureReason = gatewayResult.errorReason;
      refund.processedAt = gatewayResult.status === 'processed' ? new Date() : null;
      await refund.save();
    } else if (parsed.action === 'complete') {
      if (refund.status !== 'pending') {
        res.status(400).json({ error: 'Only pending refunds can be marked settled.' });
        return;
      }
      refund.status = 'processed';
      refund.providerStatus = refund.providerStatus || 'MANUAL_SETTLED';
      refund.processedAt = new Date();
      await refund.save();
    } else if (parsed.action === 'reject') {
      if (refund.status !== 'pending' && refund.status !== 'failed') {
        res.status(400).json({ error: 'Only pending or failed refunds can be rejected.' });
        return;
      }
      refund.status = 'rejected';
      refund.failureReason = parsed.note || 'Rejected by finance administrator';
      await refund.save();
    }

    const syncedOrder = await syncOrderAndTxAfterRefundMutation(refund.orderId);
    if (syncedOrder) {
      syncedOrder.statusHistory.push({
        status: syncedOrder.orderStatus,
        paymentStatus: syncedOrder.paymentStatus,
        note: `Refund ${refund.reference} updated (${parsed.action}) -> ${refund.status}${parsed.note ? `: ${parsed.note}` : ''}`,
        actorId: req.user!._id,
        actorRole: req.user!.role,
        createdAt: new Date(),
      });
      await syncedOrder.save();
    }

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: `REFUND_${parsed.action.toUpperCase()}`,
      resourceType: 'RefundRecord',
      resourceId: String(refund._id),
      details: { orderNumber: refund.orderNumber, status: refund.status, note: parsed.note },
      ipAddress: req.ip,
    });

    res.json({ refund, order: syncedOrder });
  })
);

router.post(
  '/admin/refunds/:id/sync',
  requireAuth,
  requirePermission('payments:refund'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: 'Invalid refund ID.' });
      return;
    }

    const refund = await RefundRecordModel.findById(req.params.id);
    if (!refund) {
      res.status(404).json({ error: 'Refund record not found' });
      return;
    }
    if (refund.refundMode !== 'gateway_api' || !refund.refundRefId) {
      res.status(400).json({ error: 'Only gateway refunds with a refundRefId can be synced.' });
      return;
    }

    const statusResult = await querySslCommerzRefundStatus(refund.refundRefId);
    refund.providerStatus = statusResult.providerStatus;
    refund.status = statusResult.status;
    refund.failureReason = statusResult.errorReason;
    if (statusResult.status === 'processed' && !refund.processedAt) {
      refund.processedAt = new Date();
    }
    await refund.save();

    const syncedOrder = await syncOrderAndTxAfterRefundMutation(refund.orderId);
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'SYNC_GATEWAY_REFUND',
      resourceType: 'RefundRecord',
      resourceId: String(refund._id),
      details: { orderNumber: refund.orderNumber, status: refund.status, providerStatus: refund.providerStatus },
      ipAddress: req.ip,
    });

    res.json({ refund, order: syncedOrder });
  })
);

export default router;
