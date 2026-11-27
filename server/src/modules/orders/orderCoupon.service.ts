import type mongoose from 'mongoose';
import { CouponModel, CouponRedemptionModel } from '../marketing/marketing.model.ts';

export async function releaseOrderCouponRedemption(
  orderId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const released = await CouponRedemptionModel.findOneAndUpdate(
    { orderId, status: { $ne: 'released' } },
    { $set: { status: 'released' } },
    { new: true }
  );

  if (!released) {
    return false;
  }

  await CouponModel.findOneAndUpdate(
    { _id: released.couponId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } }
  );

  return true;
}
