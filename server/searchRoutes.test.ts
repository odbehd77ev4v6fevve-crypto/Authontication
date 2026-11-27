import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import {
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SEED_PLACEHOLDERS,
  DEFAULT_SEED_SYNONYMS,
  DEFAULT_SUGGESTIONS_UI_CONFIG,
} from '../shared/searchHelpers.ts';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import {
  BrandModel,
  CategoryModel,
  ProductModel,
  SearchAnalyticsModel,
} from '../server/src/modules/catalog/catalog.model.ts';
import catalogRoutes from '../server/src/modules/catalog/catalog.routes.ts';
import { invalidateSearchCache } from '../server/src/modules/search/search.cache.ts';
import {
  SearchConfigModel,
  SearchPlaceholderModel,
  SearchSynonymModel,
} from '../server/src/modules/search/search.model.ts';
import searchRoutes from '../server/src/modules/search/search.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { UserModel } from '../server/src/modules/users/user.model.ts';

const ADMIN_ID = '507f1f77bcf86cd799439051';
const CUSTOMER_ID = '507f1f77bcf86cd799439052';

const CAT_PHONE_ID = '607f1f77bcf86cd799439101';
const CAT_LAPTOP_ID = '607f1f77bcf86cd799439102';
const BRAND_APPLE_ID = '607f1f77bcf86cd799439201';
const BRAND_DELL_ID = '607f1f77bcf86cd799439202';

interface MockPlaceholder {
  _id: string;
  text: string;
  language: 'bn' | 'en' | 'mixed';
  isEnabled: boolean;
  displayOrder: number;
  deviceScope: 'all' | 'desktop' | 'mobile';
  notes?: string;
  createdAt: Date;
}

interface MockSynonym {
  _id: string;
  primaryTerm: string;
  normalizedPrimary: string;
  aliases: string[];
  languagePair: string;
  categoryHint: string;
  isActive: boolean;
  priority: number;
}

let mockConfigDoc: Record<string, unknown> | null = null;
let mockPlaceholders: MockPlaceholder[] = [];
let mockSynonyms: MockSynonym[] = [];
let idSeq = 1;

const mockCategories = [
  { _id: CAT_PHONE_ID, name: 'Smartphones', nameBn: 'স্মার্টফোন ও মোবাইল', slug: 'smartphones', isActive: true },
  { _id: CAT_LAPTOP_ID, name: 'Laptops', nameBn: 'ল্যাপটপ', slug: 'laptops', isActive: true },
];

const mockBrands = [
  { _id: BRAND_APPLE_ID, name: 'Apple', slug: 'apple', isActive: true },
  { _id: BRAND_DELL_ID, name: 'Dell', slug: 'dell', isActive: true },
];

const mockProducts = [
  {
    _id: '607f1f77bcf86cd799439301',
    name: 'Apple iPhone 16 Pro Max',
    nameBn: 'অ্যাপল আইফোন ১৬ প্রো ম্যাক্স',
    slug: 'apple-iphone-16-pro-max',
    sku: 'APL-IP16PM',
    brandId: mockBrands[0],
    categoryId: mockCategories[0],
    subcategoryId: null,
    bilingualKeywords: ['iphone', 'আইফোন', 'মোবাইল', 'smartphone'],
    metaKeywords: ['apple mobile'],
    features: ['A18 Pro', 'Titanium'],
    attributes: { Storage: '256GB' },
    shortDescription: 'Flagship Apple mobile phone.',
    description: 'Latest iPhone with A18 Pro chip.',
    basePrice: 175000,
    salePrice: 169000,
    stockOnHand: 10,
    reservedStock: 1,
    allowBackorders: false,
    variants: [],
    images: [{ publicId: 'img-1', url: '/assets/iphone.jpg' }],
    status: 'published',
    isFeatured: true,
    salesCount: 50,
    ratingAverage: 4.9,
    createdAt: new Date(),
  },
  {
    _id: '607f1f77bcf86cd799439302',
    name: 'Dell XPS 15 Laptop',
    nameBn: 'ডেল এক্সপিএস ১৫ ল্যাপটপ',
    slug: 'dell-xps-15-laptop',
    sku: 'DEL-XPS15',
    brandId: mockBrands[1],
    categoryId: mockCategories[1],
    subcategoryId: null,
    bilingualKeywords: ['laptop', 'ল্যাপটপ', 'notebook'],
    metaKeywords: ['ultrabook'],
    features: ['OLED 3.5K'],
    attributes: { RAM: '32GB' },
    shortDescription: 'Creator notebook computer.',
    description: 'High performance Dell laptop.',
    basePrice: 210000,
    salePrice: null,
    stockOnHand: 0,
    reservedStock: 0,
    allowBackorders: false,
    variants: [],
    images: [{ publicId: 'img-2', url: '/assets/xps.jpg' }],
    status: 'published',
    isFeatured: false,
    salesCount: 20,
    ratingAverage: 4.7,
    createdAt: new Date(),
  },
  {
    _id: '607f1f77bcf86cd799439303',
    name: 'Draft Secret Phone',
    nameBn: 'গোপন মোবাইল',
    slug: 'draft-secret-phone',
    sku: 'DRF-001',
    brandId: mockBrands[0],
    categoryId: mockCategories[0],
    subcategoryId: null,
    bilingualKeywords: ['মোবাইল'],
    basePrice: 50000,
    stockOnHand: 5,
    reservedStock: 0,
    variants: [],
    images: [],
    status: 'draft',
    createdAt: new Date(),
  },
];

let analyticsStore: Array<{
  query: string;
  normalizedQuery: string;
  language: 'bn' | 'en' | 'mixed';
  resultCount: number;
  searchCount: number;
  zeroResultCount: number;
  clickCount: number;
  conversionCount: number;
}> = [];

function makeQueryWrapper<T>(value: T) {
  const chain = {
    select: () => chain,
    sort: () => chain,
    limit: () => chain,
    populate: () => chain,
    lean: async () => JSON.parse(JSON.stringify(value)),
    then: (resolve: (val: T) => void, reject?: (err: unknown) => void) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return chain;
}

function wrapConfigDoc(doc: Record<string, unknown>) {
  const mutable = { ...doc } as Record<string, unknown>;
  mutable.save = async () => {
    mutable.updatedAt = new Date();
    mockConfigDoc = JSON.parse(JSON.stringify(mutable));
    return mutable;
  };
  return mutable;
}

function nextObjectId(): string {
  const hex = String(idSeq++).padStart(24, '6');
  return hex.slice(0, 24);
}

const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindById: UserModel.findById,
  auditCreate: AuditLogModel.create,
  configFindOne: SearchConfigModel.findOne,
  configCreate: SearchConfigModel.create,
  phFind: SearchPlaceholderModel.find,
  phCount: SearchPlaceholderModel.countDocuments,
  phCreate: SearchPlaceholderModel.create,
  phInsertMany: SearchPlaceholderModel.insertMany,
  phUpdateOne: SearchPlaceholderModel.updateOne,
  phFindByIdAndUpdate: SearchPlaceholderModel.findByIdAndUpdate,
  phFindByIdAndDelete: SearchPlaceholderModel.findByIdAndDelete,
  synFind: SearchSynonymModel.find,
  synCount: SearchSynonymModel.countDocuments,
  synExists: SearchSynonymModel.exists,
  synCreate: SearchSynonymModel.create,
  synInsertMany: SearchSynonymModel.insertMany,
  synFindByIdAndUpdate: SearchSynonymModel.findByIdAndUpdate,
  synFindByIdAndDelete: SearchSynonymModel.findByIdAndDelete,
  catFindOne: CategoryModel.findOne,
  catFind: CategoryModel.find,
  brandFindOne: BrandModel.findOne,
  brandFind: BrandModel.find,
  prodFind: ProductModel.find,
  analyticsFind: SearchAnalyticsModel.find,
  analyticsFindOneAndUpdate: SearchAnalyticsModel.findOneAndUpdate,
  analyticsAggregate: SearchAnalyticsModel.aggregate,
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

  mockConfigDoc = {
    _id: '607f1f77bcf86cd799439950',
    key: 'primary',
    engine: { ...DEFAULT_SEARCH_ENGINE_CONFIG },
    placeholderAnimation: { ...DEFAULT_PLACEHOLDER_ANIMATION_CONFIG },
    suggestionsUi: { ...DEFAULT_SUGGESTIONS_UI_CONFIG },
    updatedByName: 'System Seed',
    updatedAt: new Date(),
  };

  mockPlaceholders = DEFAULT_SEED_PLACEHOLDERS.map((p, idx) => ({
    _id: `607f1f77bcf86cd79943940${idx}`,
    text: p.text,
    language: p.language,
    isEnabled: p.isEnabled,
    displayOrder: idx,
    deviceScope: p.deviceScope,
    notes: p.notes || '',
    createdAt: new Date(),
  }));

  mockSynonyms = DEFAULT_SEED_SYNONYMS.map((s, idx) => ({
    _id: `607f1f77bcf86cd7994395${String(idx).padStart(2, '0')}`,
    primaryTerm: s.primaryTerm,
    normalizedPrimary: s.primaryTerm.toLowerCase(),
    aliases: [...s.aliases],
    languagePair: s.languagePair || 'bn-en',
    categoryHint: s.categoryHint || '',
    isActive: s.isActive,
    priority: s.priority ?? 80,
  }));

  analyticsStore = [
    {
      query: 'মোবাইল',
      normalizedQuery: 'মোবাইল',
      language: 'bn',
      resultCount: 2,
      searchCount: 15,
      zeroResultCount: 0,
      clickCount: 6,
      conversionCount: 2,
    },
  ];

  UserModel.findById = (async (id: string) => {
    if (String(id) === ADMIN_ID) {
      return {
        _id: ADMIN_ID,
        name: 'Search Admin',
        email: 'search-admin@novara.test',
        role: 'super_admin',
        isActive: true,
        tokenVersion: 0,
        permissions: [],
      };
    }
    if (String(id) === CUSTOMER_ID) {
      return {
        _id: CUSTOMER_ID,
        name: 'Customer',
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

  SearchConfigModel.findOne = (() => ({
    lean: async () => (mockConfigDoc ? JSON.parse(JSON.stringify(mockConfigDoc)) : null),
    then: (resolve: (v: unknown) => void, reject?: (err: unknown) => void) =>
      Promise.resolve(mockConfigDoc ? wrapConfigDoc(mockConfigDoc) : null).then(resolve, reject),
  })) as unknown as typeof SearchConfigModel.findOne;

  SearchConfigModel.create = (async (payload: Record<string, unknown>) => {
    mockConfigDoc = { _id: nextObjectId(), ...payload, updatedAt: new Date() };
    return wrapConfigDoc(mockConfigDoc);
  }) as unknown as typeof SearchConfigModel.create;

  SearchPlaceholderModel.find = ((filter?: Record<string, unknown>) => {
    let rows = [...mockPlaceholders];
    if (filter?.isEnabled === true) {
      rows = rows.filter((r) => r.isEnabled);
    }
    rows.sort((a, b) => a.displayOrder - b.displayOrder);
    return makeQueryWrapper(rows);
  }) as unknown as typeof SearchPlaceholderModel.find;

  SearchPlaceholderModel.countDocuments = (async () => mockPlaceholders.length) as unknown as typeof SearchPlaceholderModel.countDocuments;

  SearchPlaceholderModel.create = (async (payload: Record<string, unknown>) => {
    const item: MockPlaceholder = {
      _id: nextObjectId(),
      text: String(payload.text || ''),
      language: (payload.language as MockPlaceholder['language']) || 'mixed',
      isEnabled: payload.isEnabled !== false,
      displayOrder: Number(payload.displayOrder ?? mockPlaceholders.length),
      deviceScope: (payload.deviceScope as MockPlaceholder['deviceScope']) || 'all',
      notes: String(payload.notes || ''),
      createdAt: new Date(),
    };
    mockPlaceholders.push(item);
    return item;
  }) as unknown as typeof SearchPlaceholderModel.create;

  SearchPlaceholderModel.insertMany = (async (items: MockPlaceholder[]) => items) as unknown as typeof SearchPlaceholderModel.insertMany;

  SearchPlaceholderModel.updateOne = (async (filter: { _id: string }, update: { $set?: Partial<MockPlaceholder> }) => {
    const found = mockPlaceholders.find((p) => p._id === String(filter._id));
    if (found && update.$set) Object.assign(found, update.$set);
    return { acknowledged: true };
  }) as unknown as typeof SearchPlaceholderModel.updateOne;

  SearchPlaceholderModel.findByIdAndUpdate = (async (id: string, update: { $set?: Partial<MockPlaceholder> }) => {
    const found = mockPlaceholders.find((p) => p._id === String(id));
    if (!found) return null;
    if (update.$set) Object.assign(found, update.$set);
    return found;
  }) as unknown as typeof SearchPlaceholderModel.findByIdAndUpdate;

  SearchPlaceholderModel.findByIdAndDelete = (async (id: string) => {
    const idx = mockPlaceholders.findIndex((p) => p._id === String(id));
    if (idx === -1) return null;
    const [removed] = mockPlaceholders.splice(idx, 1);
    return removed;
  }) as unknown as typeof SearchPlaceholderModel.findByIdAndDelete;

  SearchSynonymModel.find = ((filter?: Record<string, unknown>) => {
    let rows = [...mockSynonyms];
    if (filter?.isActive === true) {
      rows = rows.filter((r) => r.isActive);
    }
    rows.sort((a, b) => b.priority - a.priority);
    return makeQueryWrapper(rows);
  }) as unknown as typeof SearchSynonymModel.find;

  SearchSynonymModel.countDocuments = (async () => mockSynonyms.length) as unknown as typeof SearchSynonymModel.countDocuments;

  SearchSynonymModel.exists = (async (filter: { normalizedPrimary: string; _id?: { $ne: string } }) => {
    const hit = mockSynonyms.find(
      (s) =>
        s.normalizedPrimary === filter.normalizedPrimary &&
        (!filter._id?.$ne || s._id !== String(filter._id.$ne))
    );
    return hit ? { _id: hit._id } : null;
  }) as unknown as typeof SearchSynonymModel.exists;

  SearchSynonymModel.create = (async (payload: Record<string, unknown>) => {
    const item: MockSynonym = {
      _id: nextObjectId(),
      primaryTerm: String(payload.primaryTerm || ''),
      normalizedPrimary: String(payload.normalizedPrimary || ''),
      aliases: (payload.aliases as string[]) || [],
      languagePair: String(payload.languagePair || 'bn-en'),
      categoryHint: String(payload.categoryHint || ''),
      isActive: payload.isActive !== false,
      priority: Number(payload.priority ?? 80),
    };
    mockSynonyms.push(item);
    return item;
  }) as unknown as typeof SearchSynonymModel.create;

  SearchSynonymModel.insertMany = (async (items: MockSynonym[]) => items) as unknown as typeof SearchSynonymModel.insertMany;

  SearchSynonymModel.findByIdAndUpdate = (async (id: string, update: { $set?: Partial<MockSynonym> }) => {
    const found = mockSynonyms.find((s) => s._id === String(id));
    if (!found) return null;
    if (update.$set) Object.assign(found, update.$set);
    return found;
  }) as unknown as typeof SearchSynonymModel.findByIdAndUpdate;

  SearchSynonymModel.findByIdAndDelete = (async (id: string) => {
    const idx = mockSynonyms.findIndex((s) => s._id === String(id));
    if (idx === -1) return null;
    const [removed] = mockSynonyms.splice(idx, 1);
    return removed;
  }) as unknown as typeof SearchSynonymModel.findByIdAndDelete;

  CategoryModel.findOne = ((filter: { slug?: string }) =>
    makeQueryWrapper(mockCategories.find((c) => c.slug === filter.slug) || null)) as unknown as typeof CategoryModel.findOne;

  CategoryModel.find = ((filter?: { parentId?: unknown }) => {
    if (filter?.parentId) return makeQueryWrapper([]);
    return makeQueryWrapper(mockCategories);
  }) as unknown as typeof CategoryModel.find;

  BrandModel.findOne = ((filter: { slug?: string }) =>
    makeQueryWrapper(mockBrands.find((b) => b.slug === filter.slug) || null)) as unknown as typeof BrandModel.findOne;

  BrandModel.find = (() => makeQueryWrapper(mockBrands)) as unknown as typeof BrandModel.find;

  ProductModel.find = ((filter?: { status?: string }) => {
    let rows = [...mockProducts];
    if (filter?.status === 'published') {
      rows = rows.filter((p) => p.status === 'published');
    }
    return makeQueryWrapper(rows);
  }) as unknown as typeof ProductModel.find;

  SearchAnalyticsModel.find = ((filter?: { $or?: unknown }) => {
    const rows = filter?.$or
      ? analyticsStore.filter((a) => a.resultCount === 0 || a.zeroResultCount > 0)
      : analyticsStore;
    return makeQueryWrapper(rows);
  }) as unknown as typeof SearchAnalyticsModel.find;

  SearchAnalyticsModel.findOneAndUpdate = (async (
    filter: { normalizedQuery: string },
    update: {
      $set?: Partial<(typeof analyticsStore)[number]>;
      $setOnInsert?: Partial<(typeof analyticsStore)[number]>;
      $inc?: Record<string, number>;
    },
    opts?: { upsert?: boolean }
  ) => {
    let row = analyticsStore.find((r) => r.normalizedQuery === filter.normalizedQuery);
    if (!row && opts?.upsert) {
      row = {
        query: update.$set?.query || update.$setOnInsert?.query || filter.normalizedQuery,
        normalizedQuery: filter.normalizedQuery,
        language: update.$set?.language || 'en',
        resultCount: update.$set?.resultCount ?? update.$setOnInsert?.resultCount ?? 0,
        searchCount: 0,
        zeroResultCount: 0,
        clickCount: 0,
        conversionCount: 0,
      };
      analyticsStore.push(row);
    }
    if (row) {
      if (update.$set?.resultCount !== undefined) row.resultCount = update.$set.resultCount;
      if (update.$set?.language) row.language = update.$set.language;
      if (update.$inc?.searchCount) row.searchCount += update.$inc.searchCount;
      if (update.$inc?.zeroResultCount) row.zeroResultCount += update.$inc.zeroResultCount;
      if (update.$inc?.clickCount) row.clickCount += update.$inc.clickCount;
      if (update.$inc?.conversionCount) row.conversionCount += update.$inc.conversionCount;
    }
    return row;
  }) as unknown as typeof SearchAnalyticsModel.findOneAndUpdate;

  SearchAnalyticsModel.aggregate = (async (pipeline: Array<{ $group?: { _id: unknown } }>) => {
    const groupId = pipeline?.[0]?.$group?._id;
    if (groupId === null) {
      return [
        {
          _id: null,
          totalSearches: analyticsStore.reduce((s, r) => s + r.searchCount, 0),
          totalClicks: analyticsStore.reduce((s, r) => s + r.clickCount, 0),
          totalConversions: analyticsStore.reduce((s, r) => s + r.conversionCount, 0),
          totalZeroResults: analyticsStore.reduce((s, r) => s + r.zeroResultCount, 0),
          uniqueQueries: analyticsStore.length,
        },
      ];
    }
    const counts: Record<string, number> = {};
    for (const r of analyticsStore) {
      counts[r.language] = (counts[r.language] || 0) + r.searchCount;
    }
    return Object.entries(counts).map(([k, v]) => ({ _id: k, count: v }));
  }) as unknown as typeof SearchAnalyticsModel.aggregate;

  invalidateSearchCache();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/search', searchRoutes);
  app.use('/api/catalog', catalogRoutes);
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
  SearchConfigModel.findOne = originals.configFindOne;
  SearchConfigModel.create = originals.configCreate;
  SearchPlaceholderModel.find = originals.phFind;
  SearchPlaceholderModel.countDocuments = originals.phCount;
  SearchPlaceholderModel.create = originals.phCreate;
  SearchPlaceholderModel.insertMany = originals.phInsertMany;
  SearchPlaceholderModel.updateOne = originals.phUpdateOne;
  SearchPlaceholderModel.findByIdAndUpdate = originals.phFindByIdAndUpdate;
  SearchPlaceholderModel.findByIdAndDelete = originals.phFindByIdAndDelete;
  SearchSynonymModel.find = originals.synFind;
  SearchSynonymModel.countDocuments = originals.synCount;
  SearchSynonymModel.exists = originals.synExists;
  SearchSynonymModel.create = originals.synCreate;
  SearchSynonymModel.insertMany = originals.synInsertMany;
  SearchSynonymModel.findByIdAndUpdate = originals.synFindByIdAndUpdate;
  SearchSynonymModel.findByIdAndDelete = originals.synFindByIdAndDelete;
  CategoryModel.findOne = originals.catFindOne;
  CategoryModel.find = originals.catFind;
  BrandModel.findOne = originals.brandFindOne;
  BrandModel.find = originals.brandFind;
  ProductModel.find = originals.prodFind;
  SearchAnalyticsModel.find = originals.analyticsFind;
  SearchAnalyticsModel.findOneAndUpdate = originals.analyticsFindOneAndUpdate;
  SearchAnalyticsModel.aggregate = originals.analyticsAggregate;
});

test('Public GET /api/search/config returns engine, placeholder animation, and enabled placeholders', async () => {
  invalidateSearchCache();
  const res = await fetch(`${baseUrl}/api/search/config`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    engine: { smartSearchEnabled: boolean };
    placeholderAnimation: { transitionBehavior: string };
    placeholders: Array<{ text: string; isEnabled: boolean }>;
  };
  assert.equal(body.engine.smartSearchEnabled, true);
  assert.equal(body.placeholderAnimation.transitionBehavior, 'type_and_erase');
  assert.ok(body.placeholders.length >= 4);
});

test('Public cross-language suggestions & products endpoints work for Bengali, English, and /api/catalog routes', async () => {
  const sugBn = await fetch(`${baseUrl}/api/search/suggestions?q=${encodeURIComponent('আইফোন')}`);
  assert.equal(sugBn.status, 200);
  const sugBnBody = (await sugBn.json()) as {
    suggestions: Array<{ slug: string }>;
    queryMeta: { language: string; crossLanguageApplied: boolean };
  };
  assert.equal(sugBnBody.queryMeta.language, 'bn');
  assert.ok(sugBnBody.suggestions.some((s) => s.slug === 'apple-iphone-16-pro-max'));
  assert.equal(sugBnBody.suggestions.some((s) => s.slug === 'draft-secret-phone'), false);

  const catProducts = await fetch(`${baseUrl}/api/catalog/products?q=${encodeURIComponent('মোবাইল')}`);
  assert.equal(catProducts.status, 200);
  const catProductsBody = (await catProducts.json()) as {
    products: Array<{ slug: string }>;
  };
  assert.ok(catProductsBody.products.some((p) => p.slug === 'apple-iphone-16-pro-max'));

  const emptySug = await fetch(`${baseUrl}/api/search/suggestions?q=`);
  assert.equal(emptySug.status, 200);
  const emptyBody = (await emptySug.json()) as { popularSearches: string[] };
  assert.ok(emptyBody.popularSearches.includes('মোবাইল'));
});

test('Admin routes enforce 401/403 RBAC and allow super_admin full CRUD + analytics', async () => {
  const unauth = await fetch(`${baseUrl}/api/search/admin/settings`);
  assert.equal(unauth.status, 401);

  const forbidden = await fetch(`${baseUrl}/api/search/admin/settings`, {
    headers: { Cookie: `novara_token=${customerToken}` },
  });
  assert.equal(forbidden.status, 403);

  // Update settings (engine + placeholderAnimation)
  const updateRes = await fetch(`${baseUrl}/api/search/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      engine: { ...DEFAULT_SEARCH_ENGINE_CONFIG, outOfStockBehavior: 'hide', debounceMs: 180 },
      placeholderAnimation: { ...DEFAULT_PLACEHOLDER_ANIMATION_CONFIG, typingSpeedMs: 45 },
    }),
  });
  assert.equal(updateRes.status, 200);

  // Verify outOfStockBehavior === 'hide' hides out-of-stock Dell XPS 15 Laptop
  const laptopSearch = await fetch(`${baseUrl}/api/search/products?q=${encodeURIComponent('ল্যাপটপ')}`);
  assert.equal(laptopSearch.status, 200);
  const laptopBody = (await laptopSearch.json()) as { total: number };
  assert.equal(laptopBody.total, 0);

  // Create placeholder, toggle it, reorder, and delete
  const phCreate = await fetch(`${baseUrl}/api/search/admin/placeholders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      text: 'নতুন শীতকালীন জ্যাকেট খুঁজুন...',
      language: 'bn',
      isEnabled: true,
      deviceScope: 'all',
    }),
  });
  assert.equal(phCreate.status, 201);
  const phCreated = (await phCreate.json()) as { placeholder: { _id: string } };

  const reorderRes = await fetch(`${baseUrl}/api/search/admin/placeholders/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      orderedIds: [phCreated.placeholder._id, ...mockPlaceholders.slice(0, 2).map((p) => p._id)],
    }),
  });
  assert.equal(reorderRes.status, 200);

  // Create custom synonym and verify it matches immediately
  const synRes = await fetch(`${baseUrl}/api/search/admin/synonyms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: `novara_token=${adminToken}`,
    },
    body: JSON.stringify({
      primaryTerm: 'titanium',
      aliases: ['টাইটানিয়াম', 'টিটানিয়াম'],
      languagePair: 'bn-en',
      isActive: true,
      priority: 95,
    }),
  });
  assert.equal(synRes.status, 201);

  const customSynSearch = await fetch(`${baseUrl}/api/search/suggestions?q=${encodeURIComponent('টাইটানিয়াম')}`);
  assert.equal(customSynSearch.status, 200);
  const customSynBody = (await customSynSearch.json()) as { suggestions: Array<{ slug: string }> };
  assert.ok(customSynBody.suggestions.some((s) => s.slug === 'apple-iphone-16-pro-max'));

  // Track click + conversion and inspect admin analytics
  const clickRes = await fetch(`${baseUrl}/api/search/track-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ query: 'আইফোন', productId: '607f1f77bcf86cd799439301' }),
  });
  assert.equal(clickRes.status, 200);

  const convRes = await fetch(`${baseUrl}/api/search/track-conversion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ query: 'আইফোন' }),
  });
  assert.equal(convRes.status, 200);

  const analyticsRes = await fetch(`${baseUrl}/api/search/admin/analytics`, {
    headers: { Cookie: `novara_token=${adminToken}` },
  });
  assert.equal(analyticsRes.status, 200);
  const analyticsBody = (await analyticsRes.json()) as {
    summary: { totalSearches: number; totalClicks: number; totalConversions: number };
    languageBreakdown: { bn: number; en: number };
  };
  assert.ok(analyticsBody.summary.totalSearches >= 15);
  assert.ok(analyticsBody.summary.totalClicks >= 7);
  assert.ok(analyticsBody.summary.totalConversions >= 3);
  assert.ok(analyticsBody.languageBreakdown.bn >= 15);
});
