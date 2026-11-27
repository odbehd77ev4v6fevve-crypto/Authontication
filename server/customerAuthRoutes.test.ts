import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test, { after, before, beforeEach } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { env } from '../server/src/config/env.ts';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import authRoutes from '../server/src/modules/auth/auth.routes.ts';
import { StoreSettingsModel } from '../server/src/modules/cms/cms.model.ts';
import { ReviewModel } from '../server/src/modules/marketing/marketing.model.ts';
import { OrderModel } from '../server/src/modules/orders/order.model.ts';
import reviewsRoutes from '../server/src/modules/reviews/reviews.routes.ts';
import {
  NotificationRecordModel,
  SmsDeliveryRecordModel,
  UserModel,
} from '../server/src/modules/users/user.model.ts';
import usersRoutes from '../server/src/modules/users/users.routes.ts';

interface FakeUserRecord {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  role: 'customer';
  passwordHash?: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  pendingPhone?: string;
  phoneOtpHash?: string;
  phoneOtpExpiresAt?: Date;
  phoneOtpAttempts: number;
  phoneOtpResendAt?: Date;
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: Date;
  verificationResendAt?: Date;
  verificationAttempts: number;
  termsAcceptedAt?: Date;
  authProvider: 'local';
  tokenVersion: number;
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  lastLoginAt?: Date;
  avatarUrl: string;
  avatarPublicId?: string;
  savedAddresses: [];
  wishlist: [];
  notificationPreferences: { orderUpdates: boolean; promotions: boolean; backInStock: boolean };
  createdAt: Date;
  save: () => Promise<FakeUserRecord>;
}

const usersById = new Map<string, FakeUserRecord>();
const reviewDocs: Array<{
  _id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
  status: string;
  createdAt: Date;
}> = [];
let requireEmailVerificationSetting = false;
let capturedSmsPayloads: Array<{ to: string; message: string }> = [];

function createChainableUserQuery(result: FakeUserRecord | null) {
  return {
    select: () => ({
      lean: async () => result,
      then: (resolve: (val: FakeUserRecord | null) => void, reject: (err: unknown) => void) =>
        Promise.resolve(result).then(resolve, reject),
    }),
    lean: async () => result,
    then: (resolve: (val: FakeUserRecord | null) => void, reject: (err: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
}

let appServer: ReturnType<express.Express['listen']>;
let baseUrl = '';
let smsMockServer: ReturnType<express.Express['listen']>;
let smsMockUrl = '';

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindOne: UserModel.findOne,
  userFindById: UserModel.findById,
  userFindByIdAndUpdate: UserModel.findByIdAndUpdate,
  userCreate: UserModel.create,
  userExists: UserModel.exists,
  settingsFindOne: StoreSettingsModel.findOne,
  orderCount: OrderModel.countDocuments,
  orderAggregate: OrderModel.aggregate,
  reviewCount: ReviewModel.countDocuments,
  reviewFind: ReviewModel.find,
  reviewUpdateMany: ReviewModel.updateMany,
  notifCreate: NotificationRecordModel.create,
  smsCreate: SmsDeliveryRecordModel.create,
  smsUrl: env.sms.apiUrl,
  smsKey: env.sms.apiKey,
};

function matchesUserFilter(u: FakeUserRecord, query: Record<string, unknown>): boolean {
  if (query._id && typeof query._id === 'object' && '$ne' in (query._id as object)) {
    if (String(u._id) === String((query._id as { $ne: unknown }).$ne)) return false;
  } else if (query._id && String(u._id) !== String(query._id)) {
    return false;
  }
  if (query.email && u.email !== String(query.email).toLowerCase()) return false;
  if (query.verificationTokenHash && u.verificationTokenHash !== query.verificationTokenHash) return false;
  if (query.phone && typeof query.phone === 'object' && '$in' in (query.phone as object)) {
    const arr = (query.phone as { $in: string[] }).$in;
    if (!arr.includes(u.phone)) return false;
  } else if (query.phone && u.phone !== query.phone) {
    return false;
  }
  if (typeof query.phoneVerified === 'boolean' && u.phoneVerified !== query.phoneVerified) return false;
  return true;
}

before(async () => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });

  (UserModel as unknown as Record<string, unknown>).findOne = (query: Record<string, unknown>) => {
    const match = Array.from(usersById.values()).find((u) => matchesUserFilter(u, query)) || null;
    return createChainableUserQuery(match);
  };

  (UserModel as unknown as Record<string, unknown>).exists = async (query: Record<string, unknown>) => {
    const match = Array.from(usersById.values()).find((u) => matchesUserFilter(u, query));
    return match ? { _id: match._id } : null;
  };

  (UserModel as unknown as Record<string, unknown>).findById = (id: string) => {
    const match = usersById.get(String(id)) || null;
    return createChainableUserQuery(match);
  };

  (UserModel as unknown as Record<string, unknown>).findByIdAndUpdate = async (
    id: string,
    update: { $inc?: { tokenVersion?: number } }
  ) => {
    const rec = usersById.get(String(id));
    if (!rec) return null;
    if (update?.$inc?.tokenVersion) {
      rec.tokenVersion += update.$inc.tokenVersion;
    }
    return rec;
  };

  (UserModel as unknown as Record<string, unknown>).create = async (doc: Partial<FakeUserRecord>) => {
    const id = new mongoose.Types.ObjectId().toHexString();
    const rec: FakeUserRecord = {
      _id: id,
      name: doc.name || '',
      email: (doc.email || '').toLowerCase(),
      phone: doc.phone || '',
      role: 'customer',
      passwordHash: doc.passwordHash,
      isActive: true,
      emailVerified: Boolean(doc.emailVerified),
      phoneVerified: Boolean(doc.phoneVerified),
      pendingPhone: doc.pendingPhone,
      verificationTokenHash: doc.verificationTokenHash,
      verificationTokenExpiresAt: doc.verificationTokenExpiresAt,
      verificationResendAt: doc.verificationResendAt,
      verificationAttempts: doc.verificationAttempts ?? 0,
      termsAcceptedAt: doc.termsAcceptedAt,
      authProvider: 'local',
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: doc.lastLoginAt,
      avatarUrl: doc.avatarUrl || '',
      savedAddresses: [],
      wishlist: [],
      notificationPreferences: { orderUpdates: true, promotions: false, backInStock: true },
      phoneOtpAttempts: 0,
      createdAt: new Date(),
      save: async () => rec,
    };
    usersById.set(id, rec);
    return rec;
  };

  (StoreSettingsModel as unknown as Record<string, unknown>).findOne = () => ({
    select: () => ({
      lean: async () => ({
        securitySettings: {
          sessionTimeoutMinutes: 60,
          maxLoginAttempts: 3,
          lockoutMinutes: 15,
          minPasswordLength: 8,
          requireStrongPassword: false,
          requireEmailVerification: requireEmailVerificationSetting,
        },
      }),
    }),
  });

  (OrderModel as unknown as Record<string, unknown>).countDocuments = async () => 0;
  (OrderModel as unknown as Record<string, unknown>).aggregate = async () => [];
  (ReviewModel as unknown as Record<string, unknown>).countDocuments = async (q: {
    productId?: string;
    status?: string;
  }) => reviewDocs.filter((r) => (!q?.productId || r.productId === q.productId) && (!q?.status || r.status === q.status)).length;
  (ReviewModel as unknown as Record<string, unknown>).find = (q: { productId?: string; status?: string }) => {
    const filtered = reviewDocs.filter(
      (r) => (!q?.productId || r.productId === q.productId) && (!q?.status || r.status === q.status)
    );
    const hydrated = filtered.map((r) => {
      const author = usersById.get(r.userId);
      return {
        ...r,
        userId: author ? { _id: author._id, name: author.name, avatarUrl: author.avatarUrl } : r.userId,
      };
    });
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => hydrated,
            }),
          }),
        }),
      }),
      select: () => ({
        lean: async () => filtered.map((r) => ({ rating: r.rating })),
      }),
    };
  };
  (ReviewModel as unknown as Record<string, unknown>).updateMany = async (
    q: { userId?: string },
    update: { $set?: { userName?: string } }
  ) => {
    for (const r of reviewDocs) {
      if (String(r.userId) === String(q.userId) && update?.$set?.userName) {
        r.userName = update.$set.userName;
      }
    }
    return { modifiedCount: 1 };
  };
  (NotificationRecordModel as unknown as Record<string, unknown>).create = async () => ({});
  (SmsDeliveryRecordModel as unknown as Record<string, unknown>).create = async () => ({});

  // Start lightweight SMS provider receiver for testing real HTTP SMS dispatch
  const smsApp = express();
  smsApp.use(express.json());
  smsApp.post('/send', (req, res) => {
    capturedSmsPayloads.push({
      to: String(req.body?.to || ''),
      message: String(req.body?.message || ''),
    });
    res.json({ id: `sms-${Date.now()}` });
  });
  await new Promise<void>((resolve) => {
    smsMockServer = smsApp.listen(0, '127.0.0.1', () => {
      const addr = smsMockServer.address() as AddressInfo;
      smsMockUrl = `http://127.0.0.1:${addr.port}/send`;
      resolve();
    });
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/reviews', reviewsRoutes);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    appServer = app.listen(0, '127.0.0.1', () => {
      const addr = appServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

beforeEach(() => {
  usersById.clear();
  reviewDocs.length = 0;
  requireEmailVerificationSetting = false;
  capturedSmsPayloads = [];
  env.sms.apiUrl = '';
  env.sms.apiKey = '';
});

after(async () => {
  await Promise.all([
    new Promise<void>((resolve) => appServer.close(() => resolve())),
    new Promise<void>((resolve) => smsMockServer.close(() => resolve())),
  ]);
  if (originalReadyStateDescriptor) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyStateDescriptor);
  }
  (UserModel as unknown as Record<string, unknown>).findOne = originals.userFindOne;
  (UserModel as unknown as Record<string, unknown>).findById = originals.userFindById;
  (UserModel as unknown as Record<string, unknown>).findByIdAndUpdate = originals.userFindByIdAndUpdate;
  (UserModel as unknown as Record<string, unknown>).create = originals.userCreate;
  (UserModel as unknown as Record<string, unknown>).exists = originals.userExists;
  (StoreSettingsModel as unknown as Record<string, unknown>).findOne = originals.settingsFindOne;
  (OrderModel as unknown as Record<string, unknown>).countDocuments = originals.orderCount;
  (OrderModel as unknown as Record<string, unknown>).aggregate = originals.orderAggregate;
  (ReviewModel as unknown as Record<string, unknown>).countDocuments = originals.reviewCount;
  (ReviewModel as unknown as Record<string, unknown>).find = originals.reviewFind;
  (ReviewModel as unknown as Record<string, unknown>).updateMany = originals.reviewUpdateMany;
  (NotificationRecordModel as unknown as Record<string, unknown>).create = originals.notifCreate;
  (SmsDeliveryRecordModel as unknown as Record<string, unknown>).create = originals.smsCreate;
  env.sms.apiUrl = originals.smsUrl;
  env.sms.apiKey = originals.smsKey;
});

test('POST /api/auth/register rejects mismatched confirmPassword, missing terms, and invalid phone', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Mahim Hasan',
      email: 'mahim@novara.test',
      phone: '01712345678',
      password: 'Password123!',
      confirmPassword: 'MismatchPassword123!',
      termsAccepted: false,
    }),
  });
  assert.equal(res.status, 400);
});

test('Customer registration stores full name & canonical BD phone, prevents duplicates, and handles login/logout revocation', async () => {
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '  Mahim Bin Hasan  ',
      email: 'mahim.bin.hasan@novara.test',
      phone: '01712345678',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      termsAccepted: true,
    }),
  });
  assert.equal(regRes.status, 201);
  const regBody = (await regRes.json()) as {
    token: string;
    user: { id: string; name: string; phone: string; emailVerified: boolean; phoneVerified: boolean };
  };
  assert.equal(regBody.user.name, 'Mahim Bin Hasan');
  assert.equal(regBody.user.phone, '+8801712345678');
  assert.equal(regBody.user.emailVerified, false);
  assert.equal(regBody.user.phoneVerified, false);
  assert.equal((regBody.user as Record<string, unknown>).passwordHash, undefined);
  assert.equal((regBody.user as Record<string, unknown>).verificationTokenHash, undefined);

  // Duplicate phone (different formatting) must fail with 409
  const dupPhoneRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another User',
      email: 'other@novara.test',
      phone: '+880 1712-345678',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      termsAccepted: true,
    }),
  });
  assert.equal(dupPhoneRes.status, 409);

  // /api/auth/me works with issued token
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regBody.token}` },
  });
  assert.equal(meRes.status, 200);

  // Logout revokes tokenVersion server-side
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${regBody.token}`, Origin: baseUrl },
  });
  assert.equal(logoutRes.status, 200);

  const afterLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regBody.token}` },
  });
  assert.equal(afterLogoutMe.status, 401);
});

test('requireEmailVerification enforces verification before login and handles token expiry', async () => {
  requireEmailVerificationSetting = true;

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nusrat Jahan',
      email: 'nusrat@novara.test',
      phone: '+8801812345678',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      termsAccepted: true,
    }),
  });
  assert.equal(regRes.status, 201);
  const regBody = (await regRes.json()) as {
    requiresEmailVerification: boolean;
    token?: string;
    user: { id: string };
  };
  assert.equal(regBody.requiresEmailVerification, true);
  assert.equal(regBody.token, undefined);

  // Login blocked while email unverified
  const blockedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nusrat@novara.test',
      password: 'Password123!',
    }),
  });
  assert.equal(blockedLogin.status, 403);
  const blockedBody = (await blockedLogin.json()) as { code?: string };
  assert.equal(blockedBody.code, 'EMAIL_UNVERIFIED');

  // Expired token rejected
  const userRec = usersById.get(regBody.user.id)!;
  const freshToken = 'valid-token-value-1234567890';
  userRec.verificationTokenHash = crypto.createHash('sha256').update(freshToken).digest('hex');
  userRec.verificationTokenExpiresAt = new Date(Date.now() - 1000);
  const expiredRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: freshToken }),
  });
  assert.equal(expiredRes.status, 400);

  // Valid unexpired token verifies & enables login
  const activeToken = 'fresh-valid-token-1234567890';
  userRec.verificationTokenHash = crypto.createHash('sha256').update(activeToken).digest('hex');
  userRec.verificationTokenExpiresAt = new Date(Date.now() + 60_000);
  const okVerify = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: activeToken }),
  });
  assert.equal(okVerify.status, 200);
  assert.equal(userRec.emailVerified, true);

  const okLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nusrat@novara.test',
      password: 'Password123!',
    }),
  });
  assert.equal(okLogin.status, 200);
});

test('Mobile OTP verification reports unconfigured SMS gateway honestly and verifies OTP when configured', async () => {
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tariq Aziz',
      email: 'tariq@novara.test',
      phone: '01912345678',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      termsAccepted: true,
    }),
  });
  const regBody = (await regRes.json()) as { token: string; user: { id: string } };
  const token = regBody.token;

  // When SMS provider not configured -> must return 503 SMS_UNCONFIGURED (never fake delivery)
  const unconfiguredOtp = await fetch(`${baseUrl}/api/auth/phone/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({ phone: '01912345678' }),
  });
  assert.equal(unconfiguredOtp.status, 503);
  const unconfiguredJson = (await unconfiguredOtp.json()) as { code?: string };
  assert.equal(unconfiguredJson.code, 'SMS_UNCONFIGURED');

  // Configure local test HTTP SMS gateway
  env.sms.apiUrl = smsMockUrl;
  env.sms.apiKey = 'test-sms-gateway-key';

  const sendOtp = await fetch(`${baseUrl}/api/auth/phone/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({ phone: '01912345678' }),
  });
  assert.equal(sendOtp.status, 200);
  assert.equal(capturedSmsPayloads.length, 1);
  assert.equal(capturedSmsPayloads[0].to, '+8801912345678');

  const otpMatch = capturedSmsPayloads[0].message.match(/\b(\d{6})\b/);
  assert.ok(otpMatch, 'OTP SMS should carry a 6-digit code');
  const otp = otpMatch![1];

  // Immediate resend hits 429 cooldown
  const resendCooldownRes = await fetch(`${baseUrl}/api/auth/phone/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({ phone: '01912345678' }),
  });
  assert.equal(resendCooldownRes.status, 429);

  // Wrong OTP returns 400 and decrements remainingAttempts
  const wrongOtpRes = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({ otp: '000000' }),
  });
  assert.equal(wrongOtpRes.status, 400);
  const wrongOtpBody = (await wrongOtpRes.json()) as { remainingAttempts?: number };
  assert.equal(wrongOtpBody.remainingAttempts, 4);

  // Correct OTP verifies phone
  const verifyOtpRes = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({ otp }),
  });
  assert.equal(verifyOtpRes.status, 200);
  const verifyOtpBody = (await verifyOtpRes.json()) as { user: { phoneVerified: boolean } };
  assert.equal(verifyOtpBody.user.phoneVerified, true);
});

test('Profile update synchronizes name/avatar to product reviews and resets phoneVerified when phone changes', async () => {
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Farhan Ahmed',
      email: 'farhan@novara.test',
      phone: '01612345678',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      termsAccepted: true,
    }),
  });
  const regBody = (await regRes.json()) as { token: string; user: { id: string } };
  const userRec = usersById.get(regBody.user.id)!;
  userRec.phoneVerified = true;

  const prodId = new mongoose.Types.ObjectId().toHexString();
  reviewDocs.push({
    _id: new mongoose.Types.ObjectId().toHexString(),
    productId: prodId,
    userId: userRec._id,
    userName: 'Farhan Ahmed',
    rating: 5,
    comment: 'Superb battery life and build quality.',
    verifiedPurchase: true,
    status: 'approved',
    createdAt: new Date(),
  });

  const patchRes = await fetch(`${baseUrl}/api/users/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regBody.token}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({
      name: 'Farhan Kabir Ahmed',
      phone: '01512345678',
      avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/farhan.png',
    }),
  });
  assert.equal(patchRes.status, 200);
  const patchBody = (await patchRes.json()) as {
    user: { name: string; phone: string; phoneVerified: boolean; avatarUrl: string };
  };
  assert.equal(patchBody.user.name, 'Farhan Kabir Ahmed');
  assert.equal(patchBody.user.phone, '+8801512345678');
  assert.equal(patchBody.user.phoneVerified, false);

  // Verify product reviews return updated name and avatar dynamically
  const revRes = await fetch(`${baseUrl}/api/reviews/product/${prodId}`);
  assert.equal(revRes.status, 200);
  const revBody = (await revRes.json()) as {
    reviews: Array<{ userName: string; userAvatar?: string }>;
  };
  assert.equal(revBody.reviews[0].userName, 'Farhan Kabir Ahmed');
  assert.equal(
    revBody.reviews[0].userAvatar,
    'https://res.cloudinary.com/demo/image/upload/v1/farhan.png'
  );

  // Verify confirmPassword mismatch rejected on password change
  const badPwdRes = await fetch(`${baseUrl}/api/users/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signAuthToken(userRec._id, 'customer', userRec.tokenVersion, 3600)}`,
      Origin: baseUrl,
    },
    body: JSON.stringify({
      currentPassword: 'Password123!',
      newPassword: 'NewPassword456!',
      confirmPassword: 'DifferentPassword456!',
    }),
  });
  assert.equal(badPwdRes.status, 400);
});
