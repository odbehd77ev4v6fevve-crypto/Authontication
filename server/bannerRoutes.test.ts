import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import { ProductModel } from '../server/src/modules/catalog/catalog.model.ts';
import { BannerModel } from '../server/src/modules/cms/cms.model.ts';
import cmsRoutes from '../server/src/modules/cms/cms.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { UserModel } from '../server/src/modules/users/user.model.ts';

interface FakeBannerRecord {
  _id: string;
  name: string;
  aspectRatio: string;
  customAspectWidth: number;
  customAspectHeight: number;
  bannerSize: string;
  position: string;
  displayOrder: number;
  priority: number;
  isActive: boolean;
  status: 'draft' | 'published';
  startsAt: Date | null;
  endsAt: Date | null;
  badgeText: string;
  mainHeading: string;
  highlightText: string;
  subHeading: string;
  buttonText: string;
  buttonLink: string;
  altText: string;
  fontFamily: string;
  fontWeight: string;
  textAlignment: string;
  letterSpacingPx: number;
  textColor: string;
  highlightColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  backgroundType: string;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientDirection: string;
  backgroundOpacity: number;
  desktopImageUrl: string;
  desktopImagePublicId: string;
  mobileImageUrl: string;
  mobileImagePublicId: string;
  productSelectionMode: string;
  selectedProductIds: string[];
  targetCategorySlugs: string[];
  targetCustomPageSlugs: string[];
  animationEffect: string;
  animationSpeed: string;
  autoPlay: boolean;
  loop: boolean;
  animationDelaySec: number;
  bannerWidthPx: number;
  bannerHeightPx: number;
  paddingPx: number;
  borderRadiusPx: number;
  boxShadow: boolean;
  overlayEnabled: boolean;
  overlayColor: string;
  overlayOpacity: number;
  patternEnabled: boolean;
  patternType: string;
  blurEnabled: boolean;
  blurPx: number;
  customCss: string;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<FakeBannerRecord>;
}

const ADMIN_ID = '507f1f77bcf86cd799439011';
const MARKETING_ID = '507f1f77bcf86cd799439014';
const CUSTOMER_ID = '507f1f77bcf86cd799439012';
const SAMPLE_PRODUCT_ID = '507f1f77bcf86cd799439099';

const bannersStore = new Map<string, FakeBannerRecord>();
let idCounter = 1;

function newObjectId(): string {
  const hex = (idCounter++).toString(16).padStart(24, 'a');
  return hex;
}

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindById: UserModel.findById,
  auditCreate: AuditLogModel.create,
  bannerFind: BannerModel.find,
  bannerFindById: BannerModel.findById,
  bannerCreate: BannerModel.create,
  bannerFindByIdAndUpdate: BannerModel.findByIdAndUpdate,
  bannerFindByIdAndDelete: BannerModel.findByIdAndDelete,
  productFind: ProductModel.find,
};

let server: ReturnType<express.Express['listen']>;
let baseUrl = '';
let adminToken = '';
let marketingToken = '';
let customerToken = '';

before(async () => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });

  (UserModel as unknown as Record<string, unknown>).findById = async (id: string) => {
    if (String(id) === ADMIN_ID) {
      return {
        _id: ADMIN_ID,
        email: 'admin@novara.test',
        name: 'Super Admin',
        role: 'super_admin',
        isActive: true,
        tokenVersion: 1,
      };
    }
    if (String(id) === MARKETING_ID) {
      return {
        _id: MARKETING_ID,
        email: 'marketing@novara.test',
        name: 'Marketing Manager',
        role: 'marketing_manager',
        isActive: true,
        tokenVersion: 1,
      };
    }
    if (String(id) === CUSTOMER_ID) {
      return {
        _id: CUSTOMER_ID,
        email: 'customer@novara.test',
        name: 'Regular Customer',
        role: 'customer',
        isActive: true,
        tokenVersion: 1,
      };
    }
    return null;
  };

  (AuditLogModel as unknown as Record<string, unknown>).create = async () => ({});

  const makeChain = (rows: FakeBannerRecord[]) => ({
    sort: () => ({
      lean: async () => rows.map((r) => ({ ...r })),
    }),
  });

  (BannerModel as unknown as Record<string, unknown>).find = (query: Record<string, unknown> = {}) => {
    const matches = Array.from(bannersStore.values()).filter((b) => {
      if (query.isActive !== undefined && b.isActive !== query.isActive) return false;
      if (query.status !== undefined && b.status !== query.status) return false;
      if (typeof query.position === 'string' && b.position !== query.position) return false;
      if (
        query.position &&
        typeof query.position === 'object' &&
        '$in' in (query.position as Record<string, unknown>)
      ) {
        const list = (query.position as { $in: string[] }).$in;
        if (!list.includes(b.position)) return false;
      }
      return true;
    });
    return makeChain(matches);
  };

  (BannerModel as unknown as Record<string, unknown>).findById = (id: string) => {
    const rec = bannersStore.get(String(id)) || null;
    const promiseLike = Promise.resolve(rec) as Promise<FakeBannerRecord | null> & {
      lean: () => Promise<FakeBannerRecord | null>;
    };
    promiseLike.lean = async () => (rec ? { ...rec } : null);
    return promiseLike;
  };

  (BannerModel as unknown as Record<string, unknown>).create = async (doc: Partial<FakeBannerRecord>) => {
    const _id = newObjectId();
    const now = new Date();
    const record: FakeBannerRecord = {
      name: 'Untitled Banner',
      aspectRatio: '16:9',
      customAspectWidth: 16,
      customAspectHeight: 9,
      bannerSize: 'full_width',
      position: 'homepage_top_slider',
      displayOrder: 1,
      priority: 10,
      isActive: true,
      status: 'published',
      startsAt: null,
      endsAt: null,
      badgeText: '',
      mainHeading: 'Default Heading',
      highlightText: '',
      subHeading: '',
      buttonText: 'Shop Now',
      buttonLink: '/shop',
      altText: 'Banner',
      fontFamily: 'Poppins',
      fontWeight: '700',
      textAlignment: 'left',
      letterSpacingPx: 0,
      textColor: '#FFFFFF',
      highlightColor: '#A3E635',
      buttonBgColor: '#A3E635',
      buttonTextColor: '#0F172A',
      backgroundType: 'gradient',
      solidColor: '#15803D',
      gradientStart: '#06381C',
      gradientEnd: '#22C55E',
      gradientDirection: '135deg',
      backgroundOpacity: 100,
      desktopImageUrl: '',
      desktopImagePublicId: '',
      mobileImageUrl: '',
      mobileImagePublicId: '',
      productSelectionMode: 'none',
      selectedProductIds: [],
      targetCategorySlugs: [],
      targetCustomPageSlugs: [],
      animationEffect: 'fade',
      animationSpeed: 'normal',
      autoPlay: true,
      loop: true,
      animationDelaySec: 3,
      bannerWidthPx: 1920,
      bannerHeightPx: 460,
      paddingPx: 36,
      borderRadiusPx: 20,
      boxShadow: true,
      overlayEnabled: true,
      overlayColor: '#052E16',
      overlayOpacity: 35,
      patternEnabled: false,
      patternType: 'dots',
      blurEnabled: false,
      blurPx: 6,
      customCss: '',
      ...doc,
      _id,
      createdAt: now,
      updatedAt: now,
      save: async () => {
        record.updatedAt = new Date();
        bannersStore.set(_id, record);
        return record;
      },
    };
    bannersStore.set(_id, record);
    return record;
  };

  (BannerModel as unknown as Record<string, unknown>).findByIdAndUpdate = async (
    id: string,
    update: Partial<FakeBannerRecord>
  ) => {
    const rec = bannersStore.get(String(id));
    if (!rec) return null;
    Object.assign(rec, update, { updatedAt: new Date() });
    return rec;
  };

  (BannerModel as unknown as Record<string, unknown>).findByIdAndDelete = async (id: string) => {
    const rec = bannersStore.get(String(id)) || null;
    if (rec) bannersStore.delete(String(id));
    return rec;
  };

  (ProductModel as unknown as Record<string, unknown>).find = () => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              _id: SAMPLE_PRODUCT_ID,
              name: 'Smart Audio Headphones',
              slug: 'smart-audio-headphones',
              basePrice: 3500,
              salePrice: 2800,
              images: [{ url: '/src/assets/images/product_wireless_earbuds_1795621231733.jpg' }],
              ratingAverage: 4.8,
              ratingCount: 18,
              status: 'published',
            },
          ],
        }),
      }),
      lean: async () => [
        {
          _id: SAMPLE_PRODUCT_ID,
          name: 'Smart Audio Headphones',
          slug: 'smart-audio-headphones',
          basePrice: 3500,
          salePrice: 2800,
          images: [{ url: '/src/assets/images/product_wireless_earbuds_1795621231733.jpg' }],
          ratingAverage: 4.8,
          ratingCount: 18,
          status: 'published',
        },
      ],
    }),
  });

  adminToken = signAuthToken(ADMIN_ID, 'super_admin', 1);
  marketingToken = signAuthToken(MARKETING_ID, 'marketing_manager', 1);
  customerToken = signAuthToken(CUSTOMER_ID, 'customer', 1);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/cms', cmsRoutes);
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
  UserModel.findById = originals.userFindById;
  AuditLogModel.create = originals.auditCreate;
  BannerModel.find = originals.bannerFind;
  BannerModel.findById = originals.bannerFindById;
  BannerModel.create = originals.bannerCreate;
  BannerModel.findByIdAndUpdate = originals.bannerFindByIdAndUpdate;
  BannerModel.findByIdAndDelete = originals.bannerFindByIdAndDelete;
  ProductModel.find = originals.productFind;

  if (originalReadyStateDescriptor) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyStateDescriptor);
  } else {
    delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('admin banner endpoints reject unauthenticated users (401) and customers (403)', async () => {
  const unauthRes = await fetch(`${baseUrl}/api/cms/admin/banners`);
  assert.equal(unauthRes.status, 401);

  const custRes = await fetch(`${baseUrl}/api/cms/admin/banners`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(custRes.status, 403);
});

test('POST /api/cms/admin/banners validates dangerous URLs, inverted schedules, and sanitizes custom CSS', async () => {
  const unsafeRes = await fetch(`${baseUrl}/api/cms/admin/banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${marketingToken}`,
    },
    body: JSON.stringify({
      name: 'XSS Attempt',
      mainHeading: 'Invalid CTA',
      buttonLink: 'javascript:alert(1)',
    }),
  });
  assert.equal(unsafeRes.status, 400);

  const invertedDatesRes = await fetch(`${baseUrl}/api/cms/admin/banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Bad Dates',
      mainHeading: 'Schedule Check',
      startsAt: '2026-12-10T00:00:00.000Z',
      endsAt: '2026-12-01T00:00:00.000Z',
    }),
  });
  assert.equal(invertedDatesRes.status, 400);

  const createRes = await fetch(`${baseUrl}/api/cms/admin/banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${marketingToken}`,
    },
    body: JSON.stringify({
      name: 'Homepage Winter Hero',
      mainHeading: 'Smart Shopping Bigger Savings!',
      highlightText: 'Bigger',
      subHeading: 'Up to 70% Off on Top Brands',
      buttonText: 'Shop Now',
      buttonLink: '/shop',
      position: 'homepage_top_slider',
      productSelectionMode: 'featured',
      customCss: 'border: 2px solid #22c55e; @import url(https://evil.test/x.css); opacity: 0.98;',
    }),
  });
  assert.equal(createRes.status, 201);
  const createdBody = (await createRes.json()) as { banner: FakeBannerRecord };
  assert.equal(createdBody.banner.name, 'Homepage Winter Hero');
  assert.ok(createdBody.banner.customCss.includes('border: 2px solid #22c55e'));
  assert.ok(!createdBody.banner.customCss.includes('@import'));
});

test('GET /api/cms/public/banners returns only published active banners within schedule and attaches resolved products', async () => {
  await fetch(`${baseUrl}/api/cms/admin/banners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Draft Hidden Banner',
      mainHeading: 'Draft Banner Should Stay Hidden',
      position: 'homepage_top_slider',
      status: 'draft',
      isActive: true,
    }),
  });

  await fetch(`${baseUrl}/api/cms/admin/banners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Electronics Category Banner',
      mainHeading: 'Electronics Mega Fest',
      position: 'category_page_banner',
      targetCategorySlugs: ['electronics'],
      isActive: true,
      status: 'published',
    }),
  });

  const topRes = await fetch(`${baseUrl}/api/cms/public/banners?position=homepage_top_slider`);
  assert.equal(topRes.status, 200);
  const topJson = (await topRes.json()) as {
    banners: Array<FakeBannerRecord & { resolvedProducts?: unknown[] }>;
  };
  assert.equal(topJson.banners.length, 1);
  assert.equal(topJson.banners[0].name, 'Homepage Winter Hero');
  assert.equal(topJson.banners[0].resolvedProducts?.length, 1);

  const fashionRes = await fetch(
    `${baseUrl}/api/cms/public/banners?position=category_page_banner&categorySlug=fashion`
  );
  const fashionJson = (await fashionRes.json()) as { banners: FakeBannerRecord[] };
  assert.equal(fashionJson.banners.length, 0);

  const elecRes = await fetch(
    `${baseUrl}/api/cms/public/banners?position=category_page_banner&categorySlug=electronics`
  );
  const elecJson = (await elecRes.json()) as { banners: FakeBannerRecord[] };
  assert.equal(elecJson.banners.length, 1);
});

test('admin banner PATCH, duplicate, reorder, and DELETE persist correctly', async () => {
  const listRes = await fetch(`${baseUrl}/api/cms/admin/banners`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listJson = (await listRes.json()) as { banners: FakeBannerRecord[] };
  assert.ok(listJson.banners.length >= 2);
  const firstId = listJson.banners[0]._id;

  const patchRes = await fetch(`${baseUrl}/api/cms/admin/banners/${firstId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ mainHeading: 'Updated Winter Heading', priority: 99 }),
  });
  assert.equal(patchRes.status, 200);
  const patched = (await patchRes.json()) as { banner: FakeBannerRecord };
  assert.equal(patched.banner.mainHeading, 'Updated Winter Heading');
  assert.equal(patched.banner.priority, 99);

  const dupRes = await fetch(`${baseUrl}/api/cms/admin/banners/${firstId}/duplicate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(dupRes.status, 201);
  const dupJson = (await dupRes.json()) as { banner: FakeBannerRecord };
  assert.ok(dupJson.banner.name.endsWith('(Copy)'));
  assert.equal(dupJson.banner.isActive, false);
  assert.equal(dupJson.banner.status, 'draft');

  const reorderRes = await fetch(`${baseUrl}/api/cms/admin/banners/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ orderedIds: [dupJson.banner._id, firstId] }),
  });
  assert.equal(reorderRes.status, 200);

  const delRes = await fetch(`${baseUrl}/api/cms/admin/banners/${dupJson.banner._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
});
