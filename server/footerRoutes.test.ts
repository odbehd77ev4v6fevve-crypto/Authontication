import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import {
  DEFAULT_FOOTER_CONFIG,
  cloneFooterConfig,
} from '../shared/footerHelpers.ts';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import { CategoryModel } from '../server/src/modules/catalog/catalog.model.ts';
import {
  BlogPostModel,
  StaticPageModel,
  StoreSettingsModel,
} from '../server/src/modules/cms/cms.model.ts';
import { invalidateFooterCache } from '../server/src/modules/footer/footer.cache.ts';
import { FooterConfigModel } from '../server/src/modules/footer/footer.model.ts';
import footerRoutes from '../server/src/modules/footer/footer.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { UserModel } from '../server/src/modules/users/user.model.ts';

const ADMIN_ID = '507f1f77bcf86cd799439041';
const CUSTOMER_ID = '507f1f77bcf86cd799439042';

let storedFooterDoc: Record<string, unknown> | null = null;
let mockPaymentMethods = [
  { key: 'cod', label: 'Cash on Delivery', enabled: true },
  { key: 'bkash', label: 'bKash', enabled: true },
  { key: 'nagad', label: 'Nagad', enabled: false },
  { key: 'card', label: 'Debit / Credit Card', enabled: false },
];

function makeQueryWrapper<T>(value: T) {
  const chain = {
    select: () => chain,
    sort: () => chain,
    limit: () => chain,
    lean: async () => value,
  };
  return chain;
}

function wrapFooterDoc(doc: Record<string, unknown>) {
  const mutable = doc as Record<string, unknown>;
  mutable.markModified = () => {};
  mutable.toObject = () => JSON.parse(JSON.stringify(mutable));
  mutable.save = async () => {
    mutable.updatedAt = new Date();
    storedFooterDoc = JSON.parse(JSON.stringify(mutable));
    return mutable;
  };
  return mutable;
}

const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindById: UserModel.findById,
  auditCreate: AuditLogModel.create,
  footerFindOne: FooterConfigModel.findOne,
  footerCreate: FooterConfigModel.create,
  storeFindOne: StoreSettingsModel.findOne,
  storeUpdateOne: StoreSettingsModel.updateOne,
  pageFind: StaticPageModel.find,
  catFind: CategoryModel.find,
  blogFind: BlogPostModel.find,
};

let server: ReturnType<express.Express['listen']>;
let baseUrl = '';
let adminToken = '';
let customerToken = '';

before(async () => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });

  UserModel.findById = (async (id: string) => {
    if (String(id) === ADMIN_ID) {
      return {
        _id: ADMIN_ID,
        name: 'Footer Admin',
        email: 'footer-admin@novara.test',
        role: 'super_admin',
        isActive: true,
        tokenVersion: 0,
        permissions: [],
      };
    }
    if (String(id) === CUSTOMER_ID) {
      return {
        _id: CUSTOMER_ID,
        name: 'Customer User',
        email: 'customer@novara.test',
        role: 'customer',
        isActive: true,
        tokenVersion: 0,
        permissions: [],
      };
    }
    return null;
  }) as unknown as typeof UserModel.findById;

  AuditLogModel.create = (async () => ({})) as unknown as typeof AuditLogModel.create;

  FooterConfigModel.findOne = (() => {
    const query = {
      lean: async () => (storedFooterDoc ? JSON.parse(JSON.stringify(storedFooterDoc)) : null),
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve(storedFooterDoc ? wrapFooterDoc(storedFooterDoc) : null).then(resolve, reject),
    };
    return query;
  }) as unknown as typeof FooterConfigModel.findOne;

  FooterConfigModel.create = (async (payload: Record<string, unknown>) => {
    const rec = wrapFooterDoc({
      _id: '607f1f77bcf86cd799439901',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    });
    storedFooterDoc = JSON.parse(JSON.stringify(rec));
    return rec;
  }) as unknown as typeof FooterConfigModel.create;

  StoreSettingsModel.findOne = (() => ({
    select: () => ({
      lean: async () => ({
        storeName: 'NOVARA COMMERCE',
        paymentMethods: mockPaymentMethods,
      }),
    }),
    lean: async () => ({
      storeName: 'NOVARA COMMERCE',
      paymentMethods: mockPaymentMethods,
    }),
  })) as unknown as typeof StoreSettingsModel.findOne;

  StoreSettingsModel.updateOne = (async () => ({ acknowledged: true })) as unknown as typeof StoreSettingsModel.updateOne;
  StaticPageModel.find = (() => makeQueryWrapper([{ _id: 'p1', title: 'Privacy Policy', slug: 'privacy', pageType: 'policy' }])) as unknown as typeof StaticPageModel.find;
  CategoryModel.find = (() => makeQueryWrapper([{ _id: 'c1', name: 'Smartphones', slug: 'smartphones' }])) as unknown as typeof CategoryModel.find;
  BlogPostModel.find = (() => makeQueryWrapper([{ _id: 'b1', title: 'Tech Buying Guide', slug: 'tech-guide' }])) as unknown as typeof BlogPostModel.find;

  storedFooterDoc = wrapFooterDoc({
    _id: '607f1f77bcf86cd799439901',
    key: 'primary',
    draft: cloneFooterConfig(DEFAULT_FOOTER_CONFIG),
    published: cloneFooterConfig(DEFAULT_FOOTER_CONFIG),
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    updatedByName: 'System Seed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  invalidateFooterCache();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/footer', footerRoutes);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  adminToken = signAuthToken(ADMIN_ID, 'super_admin');
  customerToken = signAuthToken(CUSTOMER_ID, 'customer');
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  if (originalReadyState) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
  }
  UserModel.findById = originals.userFindById;
  AuditLogModel.create = originals.auditCreate;
  FooterConfigModel.findOne = originals.footerFindOne;
  FooterConfigModel.create = originals.footerCreate;
  StoreSettingsModel.findOne = originals.storeFindOne;
  StoreSettingsModel.updateOne = originals.storeUpdateOne;
  StaticPageModel.find = originals.pageFind;
  CategoryModel.find = originals.catFind;
  BlogPostModel.find = originals.blogFind;
});

test('Footer admin routes enforce 401/403 RBAC', async () => {
  const unauthRes = await fetch(`${baseUrl}/api/footer/admin`);
  assert.equal(unauthRes.status, 401);

  const custRes = await fetch(`${baseUrl}/api/footer/admin`, {
    headers: { Cookie: `novara_token=${customerToken}` },
  });
  assert.equal(custRes.status, 403);

  const adminRes = await fetch(`${baseUrl}/api/footer/admin`, {
    headers: { Cookie: `novara_token=${adminToken}` },
  });
  assert.equal(adminRes.status, 200);
});

test('Public footer cross-checks StoreSettings.paymentMethods and filters disabled gateways', async () => {
  invalidateFooterCache();
  const res = await fetch(`${baseUrl}/api/footer/public`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    enabled: boolean;
    footer: { payments: { badges: Array<{ key: string }> } };
  };
  assert.equal(body.enabled, true);
  const badgeKeys = body.footer.payments.badges.map((b) => b.key);
  assert.deepEqual(badgeKeys, ['bkash', 'cod']);
  assert.equal(badgeKeys.includes('visa'), false);
  assert.equal(badgeKeys.includes('nagad'), false);
});

test('Draft edits do NOT leak to public storefront until explicit publish', async () => {
  // Update draft brand storeName
  const draftRes = await fetch(`${baseUrl}/api/footer/admin/draft`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      brand: { storeName: 'DRAFT ONLY BRAND' },
    }),
  });
  assert.equal(draftRes.status, 200);

  // Public must still show NOVARA COMMERCE
  const pubBefore = await (await fetch(`${baseUrl}/api/footer/public`)).json() as {
    footer: { brand: { storeName: string } };
  };
  assert.equal(pubBefore.footer.brand.storeName, 'NOVARA COMMERCE');

  // Now Publish
  const pubAction = await fetch(`${baseUrl}/api/footer/admin/publish`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
  });
  assert.equal(pubAction.status, 200);

  const pubAfter = await (await fetch(`${baseUrl}/api/footer/public`)).json() as {
    footer: { brand: { storeName: string } };
  };
  assert.equal(pubAfter.footer.brand.storeName, 'DRAFT ONLY BRAND');
});

test('Columns CRUD, duplication, menu items, social links, reorder, and XSS URL rejection work end-to-end', async () => {
  // Reject javascript: URL
  const badRes = await fetch(`${baseUrl}/api/footer/admin/columns/col-customer-service/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      label: 'Bad Link',
      url: 'javascript:alert(1)',
    }),
  });
  assert.equal(badRes.status, 400);

  // Create column
  const colRes = await fetch(`${baseUrl}/api/footer/admin/columns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Warranty & Care',
      alignment: 'left',
    }),
  });
  assert.equal(colRes.status, 201);
  const colData = (await colRes.json()) as { column: { id: string } };
  const newColId = colData.column.id;

  // Add menu item to new column
  const itemRes = await fetch(`${baseUrl}/api/footer/admin/columns/${newColId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      label: 'Service Centers',
      linkType: 'internal_route',
      url: '/contact',
      openInNewTab: false,
    }),
  });
  assert.equal(itemRes.status, 201);

  // Duplicate column
  const dupRes = await fetch(`${baseUrl}/api/footer/admin/columns/${newColId}/duplicate`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
  });
  assert.equal(dupRes.status, 201);
  const dupBody = (await dupRes.json()) as { column: { id: string; title: string; items: unknown[] } };
  assert.equal(dupBody.column.title, 'Warranty & Care (Copy)');
  assert.equal(dupBody.column.items.length, 1);

  // Reorder columns placing duplicate first
  const reorderRes = await fetch(`${baseUrl}/api/footer/admin/columns/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({ orderedIds: [dupBody.column.id, newColId] }),
  });
  assert.equal(reorderRes.status, 200);
  const reorderBody = (await reorderRes.json()) as { draft: { columns: Array<{ id: string }> } };
  assert.equal(reorderBody.draft.columns[0].id, dupBody.column.id);

  // Add social link
  const socRes = await fetch(`${baseUrl}/api/footer/admin/social-links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      platform: 'tiktok',
      label: 'TikTok Shop',
      url: 'https://tiktok.com/@shopvista',
      isActive: true,
    }),
  });
  assert.equal(socRes.status, 201);

  // Publish and check public
  await fetch(`${baseUrl}/api/footer/admin/publish`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
  });

  const publicAfter = await (await fetch(`${baseUrl}/api/footer/public`)).json() as {
    footer: {
      columns: Array<{ id: string; title: string }>;
      social: { links: Array<{ label: string }> };
    };
  };
  assert.equal(publicAfter.footer.columns[0].title, 'Warranty & Care (Copy)');
  assert.ok(publicAfter.footer.social.links.some((l) => l.label === 'TikTok Shop'));
});
