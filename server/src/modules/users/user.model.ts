import mongoose, { Schema, type Document } from 'mongoose';
import type { StaffRole } from '../../../../shared/rbac.ts';

export interface IAddressSnapshot {
  recipientName: string;
  phone: string;
  divisionCode: string;
  divisionName: string;
  districtCode: string;
  districtName: string;
  upazilaCode: string;
  upazilaName: string;
  areaCode: string;
  areaName: string;
  zone: 'dhaka_metro' | 'dhaka_suburb' | 'outside_dhaka';
  houseAddress: string;
  roadStreet?: string;
  landmark?: string;
  deliveryInstructions?: string;
}

export interface ISavedAddress extends IAddressSnapshot {
  _id: mongoose.Types.ObjectId;
  label: string;
  isDefault: boolean;
}

export type CustomerGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  gender?: CustomerGender;
  passwordHash?: string;
  role: StaffRole;
  customerGroupId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  pendingPhone?: string;
  phoneOtpHash?: string;
  phoneOtpExpiresAt?: Date;
  phoneOtpAttempts?: number;
  phoneOtpResendAt?: Date;
  authProvider: 'local' | 'google' | 'facebook';
  providerId?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  savedAddresses: ISavedAddress[];
  wishlist: mongoose.Types.ObjectId[];
  notificationPreferences: {
    orderUpdates: boolean;
    promotions: boolean;
    backInStock: boolean;
  };
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: Date;
  verificationResendAt?: Date;
  verificationAttempts?: number;
  termsAcceptedAt?: Date;
  tokenVersion: number;
  failedLoginAttempts: number;
  lockoutUntil?: Date | null;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavedAddressSchema = new Schema<ISavedAddress>(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    recipientName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    divisionCode: { type: String, required: true },
    divisionName: { type: String, required: true },
    districtCode: { type: String, required: true },
    districtName: { type: String, required: true },
    upazilaCode: { type: String, required: true },
    upazilaName: { type: String, required: true },
    areaCode: { type: String, required: true },
    areaName: { type: String, required: true },
    zone: {
      type: String,
      enum: ['dhaka_metro', 'dhaka_suburb', 'outside_dhaka'],
      required: true,
    },
    houseAddress: { type: String, required: true, trim: true, maxlength: 200 },
    roadStreet: { type: String, trim: true, maxlength: 120 },
    landmark: { type: String, trim: true, maxlength: 120 },
    deliveryInstructions: { type: String, trim: true, maxlength: 240 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, maxlength: 25, index: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: undefined,
    },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: [
        'customer',
        'super_admin',
        'admin',
        'order_manager',
        'inventory_manager',
        'catalog_manager',
        'marketing_manager',
        'customer_support',
        'finance_accounts',
        'read_only_analyst',
      ],
      default: 'customer',
      index: true,
    },
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', default: null, index: true },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    pendingPhone: { type: String, trim: true, maxlength: 25 },
    phoneOtpHash: { type: String, select: false },
    phoneOtpExpiresAt: { type: Date, select: false },
    phoneOtpAttempts: { type: Number, default: 0, select: false },
    phoneOtpResendAt: { type: Date, select: false },
    authProvider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },
    providerId: { type: String },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },
    savedAddresses: { type: [SavedAddressSchema], default: [] },
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      backInStock: { type: Boolean, default: true },
    },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    verificationTokenHash: { type: String, select: false },
    verificationTokenExpiresAt: { type: Date, select: false },
    verificationResendAt: { type: Date, select: false },
    verificationAttempts: { type: Number, default: 0, select: false },
    termsAcceptedAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockoutUntil: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export interface ISmsDeliveryRecord extends Document {
  userId?: mongoose.Types.ObjectId;
  phone: string;
  purpose: 'phone_verification' | 'order_alert';
  status: 'queued' | 'sent' | 'failed' | 'skipped_unconfigured';
  providerMessageId?: string;
  errorMessage?: string;
  attempts: number;
  createdAt: Date;
}

const SmsDeliveryRecordSchema = new Schema<ISmsDeliveryRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    phone: { type: String, required: true, trim: true },
    purpose: {
      type: String,
      enum: ['phone_verification', 'order_alert'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped_unconfigured'],
      default: 'queued',
    },
    providerMessageId: { type: String },
    errorMessage: { type: String },
    attempts: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const SmsDeliveryRecordModel =
  mongoose.models.SmsDeliveryRecord ||
  mongoose.model<ISmsDeliveryRecord>('SmsDeliveryRecord', SmsDeliveryRecordSchema);

export interface INotificationRecord extends Document {
  userId?: mongoose.Types.ObjectId;
  email: string;
  type:
    | 'verification'
    | 'password_reset'
    | 'order_confirmation'
    | 'payment_status'
    | 'shipment_update'
    | 'refund_update'
    | 'back_in_stock'
    | 'marketing';
  subject: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped_unconfigured';
  providerMessageId?: string;
  errorMessage?: string;
  attempts: number;
  createdAt: Date;
}

const NotificationRecordSchema = new Schema<INotificationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    type: {
      type: String,
      enum: [
        'verification',
        'password_reset',
        'order_confirmation',
        'payment_status',
        'shipment_update',
        'refund_update',
        'back_in_stock',
        'marketing',
      ],
      required: true,
    },
    subject: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped_unconfigured'],
      default: 'queued',
    },
    providerMessageId: { type: String },
    errorMessage: { type: String },
    attempts: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const NotificationRecordModel =
  mongoose.models.NotificationRecord ||
  mongoose.model<INotificationRecord>('NotificationRecord', NotificationRecordSchema);

export interface ICustomerGroup extends Document {
  name: string;
  slug: string;
  description?: string;
  discountPercent: number;
  badgeColor: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerGroupSchema = new Schema<ICustomerGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 300 },
    discountPercent: { type: Number, default: 0, min: 0, max: 50 },
    badgeColor: { type: String, default: '#16A34A' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const CustomerGroupModel =
  mongoose.models.CustomerGroup ||
  mongoose.model<ICustomerGroup>('CustomerGroup', CustomerGroupSchema);

export interface IRoleDefinition extends Document {
  roleKey: StaffRole;
  label: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  updatedAt: Date;
}

const RoleDefinitionSchema = new Schema<IRoleDefinition>(
  {
    roleKey: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 240, default: '' },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RoleDefinitionModel =
  mongoose.models.RoleDefinition ||
  mongoose.model<IRoleDefinition>('RoleDefinition', RoleDefinitionSchema);

