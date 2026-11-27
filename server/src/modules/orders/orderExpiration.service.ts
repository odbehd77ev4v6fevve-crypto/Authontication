import { getDatabaseStatus } from '../../database/connection.ts';
import { releaseReservedInventory } from '../inventory/inventory.routes.ts';
import { OrderModel, PaymentTransactionModel } from './order.model.ts';
import { releaseOrderCouponRedemption } from './orderCoupon.service.ts';

export interface AbandonedOrderSweepResult {
  scanned: number;
  expired: number;
  orderNumbers: string[];
}

export async function expireAbandonedOnlineOrders(
  now: Date = new Date()
): Promise<AbandonedOrderSweepResult> {
  if (!getDatabaseStatus().connected) {
    return { scanned: 0, expired: 0, orderNumbers: [] };
  }

  const candidates = await OrderModel.find({
    orderStatus: 'pending',
    paymentMethod: 'sslcommerz',
    paymentStatus: { $in: ['unpaid', 'pending'] },
    paymentExpiresAt: { $lte: now },
  })
    .sort({ paymentExpiresAt: 1 })
    .limit(50)
    .lean();

  const expiredOrderNumbers: string[] = [];

  for (const candidate of candidates) {
    const claimed = await OrderModel.findOneAndUpdate(
      {
        _id: candidate._id,
        orderStatus: 'pending',
        paymentMethod: 'sslcommerz',
        paymentStatus: { $in: ['unpaid', 'pending'] },
      },
      {
        $set: {
          orderStatus: 'cancelled',
          fulfillmentStatus: 'cancelled',
          paymentStatus: 'failed',
          cancelledAt: now,
          cancellationReason: 'Online payment session expired before completion',
          paymentExpiresAt: null,
        },
        $push: {
          statusHistory: {
            status: 'cancelled',
            paymentStatus: 'failed',
            fulfillmentStatus: 'cancelled',
            note: 'Auto-cancelled after online payment reservation window expired.',
            actorRole: 'system',
            createdAt: now,
          },
        },
      },
      { new: true }
    );

    if (!claimed) continue;

    await PaymentTransactionModel.updateMany(
      { orderId: claimed._id, status: { $in: ['initiated', 'pending'] } },
      { $set: { status: 'cancelled' } }
    );

    await releaseReservedInventory({
      items: claimed.items.map(
        (i: { productId: unknown; variantId?: unknown; sku: string; quantity: number }) => ({
          productId: String(i.productId),
          variantId: i.variantId ? String(i.variantId) : null,
          sku: i.sku,
          quantity: i.quantity,
        })
      ),
      reason: `Payment reservation expired for ${claimed.orderNumber}`,
      orderId: claimed._id,
    });

    await releaseOrderCouponRedemption(claimed._id);
    expiredOrderNumbers.push(claimed.orderNumber);
  }

  return {
    scanned: candidates.length,
    expired: expiredOrderNumbers.length,
    orderNumbers: expiredOrderNumbers,
  };
}
