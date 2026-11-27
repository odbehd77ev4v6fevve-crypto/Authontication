import mongoose, { Schema, type Document } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  description?: string;
  type: 'fixed' | 'percentage';
  value: number;
  maxDiscountCap?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  eligibleCategoryIds: mongoose.Types.ObjectId[];
  eligibleProductIds: mongoose.Types.ObjectId[];
  eligibleCustomerGroupIds: mongoose.Types.ObjectId[];
  startsAt?: Date | null;
  expiresAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 240 },
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 1 },
    maxDiscountCap: { type: Number, min: 0, default: null },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, min: 1, default: null },
    usedCount: { type: Number, default: 0, min: 0 },
    perCustomerLimit: { type: Number, min: 1, default: null },
    eligibleCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    eligibleProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    eligibleCustomerGroupIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerGroup' }],
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const CouponModel = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);

export interface ICouponRedemption extends Document {
  couponId: mongoose.Types.ObjectId;
  code: string;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  discountAmount: number;
  status: 'active' | 'released';
  createdAt: Date;
}

const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    code: { type: String, required: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    discountAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'released'], default: 'active', index: true },
  },
  { timestamps: true }
);

CouponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });
CouponRedemptionSchema.index({ orderId: 1 });

export const CouponRedemptionModel =
  mongoose.models.CouponRedemption ||
  mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema);

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  rating: number;
  title?: string;
  comment: string;
  images: Array<{ publicId: string; url: string; alt?: string }>;
  verifiedPurchase: boolean;
  orderId?: mongoose.Types.ObjectId | null;
  status: 'pending' | 'approved' | 'rejected';
  moderationReason?: string;
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  helpfulVoterIds: mongoose.Types.ObjectId[];
  reports: Array<{
    userId: mongoose.Types.ObjectId;
    reason: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 1500 },
    images: [{ publicId: String, url: String, alt: String }],
    verifiedPurchase: { type: Boolean, default: false },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    moderationReason: { type: String, maxlength: 300 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    helpfulVoterIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reports: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true, maxlength: 240 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const ReviewModel = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);

export interface IDiscountRule extends Document {
  name: string;
  description?: string;
  ruleType: 'percentage' | 'fixed' | 'bulk_tier';
  value: number;
  maxDiscountCap?: number | null;
  minOrderAmount: number;
  minQuantity: number;
  targetScope: 'all' | 'category' | 'product' | 'customer_group';
  targetIds: string[];
  priority: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DiscountRuleSchema = new Schema<IDiscountRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 300 },
    ruleType: { type: String, enum: ['percentage', 'fixed', 'bulk_tier'], default: 'percentage' },
    value: { type: Number, required: true, min: 1 },
    maxDiscountCap: { type: Number, min: 0, default: null },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    minQuantity: { type: Number, default: 1, min: 1 },
    targetScope: {
      type: String,
      enum: ['all', 'category', 'product', 'customer_group'],
      default: 'all',
    },
    targetIds: { type: [String], default: [] },
    priority: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const DiscountRuleModel =
  mongoose.models.DiscountRule || mongoose.model<IDiscountRule>('DiscountRule', DiscountRuleSchema);

export interface ICampaign extends Document {
  name: string;
  slug: string;
  description?: string;
  bannerImageUrl?: string;
  bannerImagePublicId?: string;
  discountLabel?: string;
  discountPercent: number;
  productIds: mongoose.Types.ObjectId[];
  categoryIds: mongoose.Types.ObjectId[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  status: 'draft' | 'active' | 'scheduled' | 'ended';
  clicks: number;
  conversions: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    bannerImageUrl: { type: String, trim: true, default: '' },
    bannerImagePublicId: { type: String, trim: true, default: '' },
    discountLabel: { type: String, trim: true, maxlength: 60 },
    discountPercent: { type: Number, default: 0, min: 0, max: 95 },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['draft', 'active', 'scheduled', 'ended'],
      default: 'draft',
      index: true,
    },
    clicks: { type: Number, default: 0, min: 0 },
    conversions: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const CampaignModel =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);

export interface IAdvertisement extends Document {
  title: string;
  placement:
    | 'homepage_top'
    | 'homepage_mid'
    | 'sidebar'
    | 'category_top'
    | 'product_detail'
    | 'global_banner';
  desktopImageUrl: string;
  desktopImagePublicId?: string;
  mobileImageUrl?: string;
  mobileImagePublicId?: string;
  targetUrl: string;
  altText: string;
  status: 'active' | 'paused' | 'scheduled';
  startsAt?: Date | null;
  endsAt?: Date | null;
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

const AdvertisementSchema = new Schema<IAdvertisement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    placement: {
      type: String,
      enum: ['homepage_top', 'homepage_mid', 'sidebar', 'category_top', 'product_detail', 'global_banner'],
      default: 'global_banner',
      index: true,
    },
    desktopImageUrl: { type: String, required: true },
    desktopImagePublicId: { type: String },
    mobileImageUrl: { type: String, default: '' },
    mobileImagePublicId: { type: String },
    targetUrl: { type: String, required: true, default: '/shop' },
    altText: { type: String, required: true, default: 'Promotional Advertisement' },
    status: { type: String, enum: ['active', 'paused', 'scheduled'], default: 'active', index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    impressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const AdvertisementModel =
  mongoose.models.Advertisement || mongoose.model<IAdvertisement>('Advertisement', AdvertisementSchema);

export interface IPromoPopup extends Document {
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl?: string;
  imagePublicId?: string;
  displayFrequency: 'once_per_session' | 'once_per_day' | 'once_ever' | 'always';
  delaySeconds: number;
  targetPages: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PromoPopupSchema = new Schema<IPromoPopup>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    ctaText: { type: String, trim: true, maxlength: 40, default: 'Claim Offer' },
    ctaUrl: { type: String, trim: true, maxlength: 300, default: '/deals' },
    imageUrl: { type: String, trim: true, default: '' },
    imagePublicId: { type: String, trim: true, default: '' },
    displayFrequency: {
      type: String,
      enum: ['once_per_session', 'once_per_day', 'once_ever', 'always'],
      default: 'once_per_session',
    },
    delaySeconds: { type: Number, default: 3, min: 0, max: 60 },
    targetPages: { type: [String], default: ['*'] },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isEnabled: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const PromoPopupModel =
  mongoose.models.PromoPopup || mongoose.model<IPromoPopup>('PromoPopup', PromoPopupSchema);

