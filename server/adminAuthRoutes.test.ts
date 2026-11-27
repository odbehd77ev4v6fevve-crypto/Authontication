import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import { createAdminAuthRouter } from '../server/src/modules/auth/adminAuth.routes.ts';
import { StoreSettingsModel } from '../server/src/modules/cms/cms.model.ts';
import { ReviewModel } from '../server/src/modules/marketing/marketing.model.ts';
import { OrderModel, ReturnRequestModel } from '../server/src/modules/orders/order.model.ts';
import ordersRoutes from '../server/src/modules/orders/orders.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { UserModel } from '../server/src/modules/users/user.model.ts';

interface FakeUserRecord {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'order_manager' | 'customer';
  passwordHash?: string;
  isActive: boolean;
  emailVerified: boolean;
  authProvider: 'local';
  tokenVersion: number;
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  lastLoginAt?: Date;
  avatarUrl: string;
  savedAddresses: [];
  wishlist: [];
  notificationPreferences: { orderUpdates: boolean; promotions: boolean; backInStock: boolean };
  createdAt: Date;
  save: () => Promise<FakeUserRecord>;
}

const adminPasswordHash = bcrypt.hashSync('AdminSecret!2026', 6);
const customerPasswordHash = bcrypt.hashSync('CustomerSecret!2026', 6);

const usersById = new Map<string, FakeUserRecord>();

function seedTestUsers() {
  usersById.clear();
  const makeRecord = (
    overrides: Partial<FakeUserRecord> & Pick<FakeUserRecord, '_id' | 'email' | 'role' | 'name'>
  ): FakeUserRecord => {
    const rec: FakeUserRecord = {
      phone: '',
      isActive: true,
      emailVerified: true,
      authProvider: 'local',
      tokenVersion: 1,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      avatarUrl: '',
      savedAddresses: [],
      wishlist: [],
      notificationPreferences: { orderUpdates: true, promotions: true, backInStock: true },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      save: async () => rec,
      ...overrides,
    };
    return rec;
  };

  const admin = makeRecord({
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Super Admin',
    email: 'admin@novara.test',
    role: 'super_admin',
    passwordHash: adminPasswordHash,
  });
  const customer = makeRecord({
    _id: '507f1f77bcf86cd799439012',
    name: 'Regular Customer',
    email: 'customer@novara.test',
    role: 'customer',
    passwordHash: customerPasswordHash,
  });
  const disabledAdmin = makeRecord({
    _id: '507f1f77bcf86cd799439013',
    name: 'Disabled Staff',
    email: 'disabled@novara.test',
    role: 'order_manager',
    passwordHash: adminPasswordHash,
    isActive: false,
  });

  usersById.set(admin._id, admin);
  usersById.set(customer._id, customer);
  usersById.set(disabledAdmin._id, disabledAdmin);
}

let server: ReturnType<express.Express['listen']>;
let baseUrl = '';

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindOne: UserModel.findOne,
  userFindById: UserModel.findById,
  userFindByIdAndUpdate: UserModel.findByIdAndUpdate,
  settingsFindOne: StoreSettingsModel.findOne,
  orderCount: OrderModel.countDocuments,
  orderAggregate: OrderModel.aggregate,
  reviewCount: ReviewModel.countDocuments,
  returnFind: ReturnRequestModel.find,
  auditCreate: AuditLogModel.create,
};

before(async () => {
  seedTestUsers();

  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });

  (UserModel as unknown as Record<string, unknown>).findOne = (query: { email?: string }) => ({
    select: async () => {
      const target = String(query?.email || '').toLowerCase();
      return Array.from(usersById.values()).find((u) => u.email === target) || null;
    },
  });

  (UserModel as unknown as Record<string, unknown>).findById = async (id: string) => {
    return usersById.get(String(id)) || null;
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

  (StoreSettingsModel as unknown as Record<string, unknown>).findOne = () => ({
    select: () => ({
      lean: async () => ({
        securitySettings: {
          sessionTimeoutMinutes: 1440,
          maxLoginAttempts: 3,
          lockoutMinutes: 15,
        },
      }),
    }),
  });

  (OrderModel as unknown as Record<string, unknown>).countDocuments = async () => 0;
  (OrderModel as unknown as Record<string, unknown>).aggregate = async () => [];
  (ReviewModel as unknown as Record<string, unknown>).countDocuments = async () => 0;
  (AuditLogModel as unknown as Record<string, unknown>).create = async () => ({});
  (ReturnRequestModel as unknown as Record<string, unknown>).find = () => ({
    populate: () => ({
      sort: async () => [{ _id: 'ret-1', status: 'requested' }],
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin/auth', createAdminAuthRouter({ skipRateLimit: true }));
  app.use('/api/orders', ordersRoutes);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  UserModel.findOne = originals.userFindOne;
  UserModel.findById = originals.userFindById;
  UserModel.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  StoreSettingsModel.findOne = originals.settingsFindOne;
  OrderModel.countDocuments = originals.orderCount;
  OrderModel.aggregate = originals.orderAggregate;
  ReviewModel.countDocuments = originals.reviewCount;
  ReturnRequestModel.find = originals.returnFind;
  AuditLogModel.create = originals.auditCreate;

  if (originalReadyStateDescriptor) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyStateDescriptor);
  } else {
    delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('POST /api/admin/auth/login rejects customer accounts with generic 401 and sets no cookie', async () => {
  const res = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@novara.test',
      password: 'CustomerSecret!2026',
    }),
  });

  assert.equal(res.status, 401);
  const body = (await res.json()) as { message?: string; token?: string };
  assert.equal(body.message, 'Invalid administrator email or password.');
  assert.equal(body.token, undefined);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('POST /api/admin/auth/login locks disabled staff accounts with 403', async () => {
  const res = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'disabled@novara.test',
      password: 'AdminSecret!2026',
    }),
  });
  assert.equal(res.status, 403);
});

test('POST /api/admin/auth/login authenticates staff, rotates tokenVersion, returns sanitized user, and revokes on logout', async () => {
  const adminRec = usersById.get('507f1f77bcf86cd799439011')!;
  const initialVersion = adminRec.tokenVersion;

  const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@novara.test',
      password: 'AdminSecret!2026',
    }),
  });

  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie') || '';
  assert.ok(setCookie.includes('novara_token='));
  assert.ok(setCookie.toLowerCase().includes('httponly'));

  const loginBody = (await loginRes.json()) as {
    token: string;
    user: Record<string, unknown>;
  };
  assert.ok(loginBody.token);
  assert.equal(loginBody.user.email, 'admin@novara.test');
  assert.equal(loginBody.user.role, 'super_admin');
  assert.equal('passwordHash' in loginBody.user, false);
  assert.equal(adminRec.tokenVersion, initialVersion + 1);

  // Active token verifies /api/admin/auth/me
  const meRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(meRes.status, 200);

  // Customer token rejected by /api/admin/auth/me
  const custToken = signAuthToken('507f1f77bcf86cd799439012', 'customer', 1, 3600);
  const custMeRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assert.equal(custMeRes.status, 403);

  // Logout bumps tokenVersion and invalidates previously issued Bearer token
  const logoutRes = await fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(logoutRes.status, 200);
  assert.equal(adminRec.tokenVersion, initialVersion + 2);

  const staleMeRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(staleMeRes.status, 401);
});

test('POST /api/admin/auth/login enforces failed-attempt lockout cleanly', async () => {
  seedTestUsers();
  for (let i = 0; i < 3; i += 1) {
    const attempt = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@novara.test',
        password: 'wrong-password',
      }),
    });
    assert.equal(attempt.status, 401);
  }

  const lockedAttempt = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@novara.test',
      password: 'AdminSecret!2026',
    }),
  });
  assert.equal(lockedAttempt.status, 423);
});

test('GET /api/orders/admin/returns is not shadowed by /api/orders/admin/:id', async () => {
  seedTestUsers();
  const adminToken = signAuthToken('507f1f77bcf86cd799439011', 'super_admin', 1, 3600);
  const res = await fetch(`${baseUrl}/api/orders/admin/returns`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { returns: Array<{ _id: string }> };
  assert.equal(body.returns.length, 1);
  assert.equal(body.returns[0]._id, 'ret-1');
});
