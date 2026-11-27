import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import {
  BrandModel,
  CategoryModel,
  CollectionModel,
  ProductModel,
} from '../server/src/modules/catalog/catalog.model.ts';
import { BlogPostModel, StaticPageModel } from '../server/src/modules/cms/cms.model.ts';
import { CampaignModel } from '../server/src/modules/marketing/marketing.model.ts';
import { invalidateNavigationCache } from '../server/src/modules/navigation/navigation.cache.ts';
import {
  MegaMenuSlideModel,
  NavigationItemModel,
  NavigationMenuModel,
  NavigationPlacementModel,
} from '../server/src/modules/navigation/navigation.model.ts';
import navigationRoutes from '../server/src/modules/navigation/navigation.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { UserModel } from '../server/src/modules/users/user.model.ts';

const ADMIN_ID = '507f1f77bcf86cd799439031';
const CUSTOMER_ID = '507f1f77bcf86cd799439032';

let idCounter = 1;
function newObjectIdHex(prefix = 'e'): string {
  return (idCounter++).toString(16).padStart(24, prefix);
}

const placementsStore = new Map<string, Record<string, unknown>>();
const menusStore = new Map<string, Record<string, unknown>>();
const itemsStore = new Map<string, Record<string, unknown>>();
const slidesStore = new Map<string, Record<string, unknown>>();

const fakeCategories = [
  {
    _id: '607f1f77bcf86cd799439101',
    name: 'Mobile & Tablets',
    slug: 'mobile-tablets',
    parentId: null,
    displayOrder: 1,
    isActive: true,
  },
  {
    _id: '607f1f77bcf86cd799439102',
    name: 'Smartphones',
    slug: 'smartphones',
    parentId: '607f1f77bcf86cd799439101',
    displayOrder: 1,
    isActive: true,
  },
  {
    _id: '607f1f77bcf86cd799439103',
    name: 'Hidden Category',
    slug: 'hidden-cat',
    parentId: null,
    displayOrder: 2,
    isActive: false,
  },
];

const fakeProducts = [
  {
    _id: '607f1f77bcf86cd799439201',
    name: 'Titanium Pro 5G',
    slug: 'titanium-pro-5g',
    basePrice: 118000,
    salePrice: 109000,
    images: [{ url: '/src/assets/images/product_smartphone_pro_1795621230630.jpg' }],
    status: 'published',
    isFeatured: true,
    salesCount: 40,
    ratingAverage: 4.9,
    categoryId: '607f1f77bcf86cd799439102',
    createdAt: new Date(),
  },
];

function makeQueryWrapper<T>(rows: T[]) {
  let list = [...rows];
  const chain = {
    select: () => chain,
    sort: () => chain,
    skip: (n: number) => {
      list = list.slice(n);
      return chain;
    },
    limit: (n: number) => {
      list = list.slice(0, n);
      return chain;
    },
    lean: async () => list,
  };
  return chain;
}

function attachSave<T extends Record<string, unknown>>(store: Map<string, Record<string, unknown>>, rec: T): T {
  const mutable = rec as Record<string, unknown>;
  mutable.toObject = () => ({ ...rec });
  mutable.save = async () => {
    mutable.updatedAt = new Date();
    store.set(String(rec._id), rec);
    return rec;
  };
  return rec;
}

const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindById: UserModel.findById,
  auditCreate: AuditLogModel.create,
  placementFind: NavigationPlacementModel.find,
  placementFindOne: NavigationPlacementModel.findOne,
  placementInsertMany: NavigationPlacementModel.insertMany,
  menuCount: NavigationMenuModel.countDocuments,
  menuFind: NavigationMenuModel.find,
  menuFindById: NavigationMenuModel.findById,
  menuExists: NavigationMenuModel.exists,
  menuCreate: NavigationMenuModel.create,
  menuUpdateMany: NavigationMenuModel.updateMany,
  menuFindByIdAndDelete: NavigationMenuModel.findByIdAndDelete,
  itemCount: NavigationItemModel.countDocuments,
  itemFind: NavigationItemModel.find,
  itemFindOne: NavigationItemModel.findOne,
  itemCreate: NavigationItemModel.create,
  itemInsertMany: NavigationItemModel.insertMany,
  itemFindOneAndUpdate: NavigationItemModel.findOneAndUpdate,
  itemDeleteMany: NavigationItemModel.deleteMany,
  itemAggregate: NavigationItemModel.aggregate,
  slideCount: MegaMenuSlideModel.countDocuments,
  slideFind: MegaMenuSlideModel.find,
  slideFindById: MegaMenuSlideModel.findById,
  slideCreate: MegaMenuSlideModel.create,
  slideInsertMany: MegaMenuSlideModel.insertMany,
  slideFindByIdAndUpdate: MegaMenuSlideModel.findByIdAndUpdate,
  slideFindByIdAndDelete: MegaMenuSlideModel.findByIdAndDelete,
  slideUpdateMany: MegaMenuSlideModel.updateMany,
  slideAggregate: MegaMenuSlideModel.aggregate,
  catFind: CategoryModel.find,
  brandFind: BrandModel.find,
  colFind: CollectionModel.find,
  campFind: CampaignModel.find,
  pageFind: StaticPageModel.find,
  blogFind: BlogPostModel.find,
  prodFind: ProductModel.find,
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
    if (String(id) === CUSTOMER_ID) {
      return {
        _id: CUSTOMER_ID,
        email: 'customer@novara.test',
        name: 'Customer',
        role: 'customer',
        isActive: true,
        tokenVersion: 1,
      };
    }
    return null;
  };
  (AuditLogModel as unknown as Record<string, unknown>).create = async () => ({});

  // Catalog / CMS stubs
  (CategoryModel as unknown as Record<string, unknown>).find = (q: Record<string, unknown> = {}) =>
    makeQueryWrapper(fakeCategories.filter((c) => (q.isActive !== undefined ? c.isActive === q.isActive : true)));
  (BrandModel as unknown as Record<string, unknown>).find = () => makeQueryWrapper([]);
  (CollectionModel as unknown as Record<string, unknown>).find = () => makeQueryWrapper([]);
  (CampaignModel as unknown as Record<string, unknown>).find = () => makeQueryWrapper([]);
  (StaticPageModel as unknown as Record<string, unknown>).find = () => makeQueryWrapper([]);
  (BlogPostModel as unknown as Record<string, unknown>).find = () => makeQueryWrapper([]);
  (ProductModel as unknown as Record<string, unknown>).find = () => makeQueryWrapper(fakeProducts);

  // NavigationPlacement stubs
  (NavigationPlacementModel as unknown as Record<string, unknown>).find = () =>
    makeQueryWrapper(Array.from(placementsStore.values()));
  (NavigationPlacementModel as unknown as Record<string, unknown>).findOne = (q: Record<string, unknown>) => ({
    lean: async () =>
      Array.from(placementsStore.values()).find((p) => p.key === q.key) || null,
  });
  (NavigationPlacementModel as unknown as Record<string, unknown>).insertMany = async (docs: Array<Record<string, unknown>>) => {
    for (const d of docs) {
      const _id = newObjectIdHex('1');
      placementsStore.set(_id, { _id, ...d });
    }
    return docs;
  };

  // NavigationMenu stubs
  const matchMenu = (m: Record<string, unknown>, q: Record<string, unknown>) => {
    if (q.placement && m.placement !== q.placement) return false;
    if (q.slug && m.slug !== q.slug) return false;
    if (q.menuType && m.menuType !== q.menuType) return false;
    if (q.status) {
      if (typeof q.status === 'object' && '$in' in (q.status as Record<string, unknown>)) {
        const arr = (q.status as { $in: string[] }).$in;
        if (!arr.includes(String(m.status))) return false;
      } else if (m.status !== q.status) {
        return false;
      }
    }
    if (q._id && typeof q._id === 'object' && '$ne' in (q._id as Record<string, unknown>)) {
      if (String(m._id) === String((q._id as { $ne: unknown }).$ne)) return false;
    }
    return true;
  };

  (NavigationMenuModel as unknown as Record<string, unknown>).countDocuments = async (q: Record<string, unknown> = {}) =>
    Array.from(menusStore.values()).filter((m) => matchMenu(m, q)).length;

  (NavigationMenuModel as unknown as Record<string, unknown>).find = (q: Record<string, unknown> = {}) =>
    makeQueryWrapper(Array.from(menusStore.values()).filter((m) => matchMenu(m, q)));

function stripDocMethods(doc: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!doc) return null;
  const copy = { ...doc };
  delete copy.toObject;
  delete copy.save;
  return copy;
}

  (NavigationMenuModel as unknown as Record<string, unknown>).findById = (id: string) => {
    const rec = menusStore.get(String(id)) || null;
    const p = Promise.resolve(rec) as Promise<Record<string, unknown> | null> & {
      lean: () => Promise<Record<string, unknown> | null>;
    };
    p.lean = async () => stripDocMethods(rec);
    return p;
  };

  (NavigationMenuModel as unknown as Record<string, unknown>).exists = async (q: Record<string, unknown>) => {
    const found = Array.from(menusStore.values()).find((m) => matchMenu(m, q));
    return found ? { _id: found._id } : null;
  };

  (NavigationMenuModel as unknown as Record<string, unknown>).create = async (doc: Record<string, unknown>) => {
    const _id = newObjectIdHex('a');
    const rec = attachSave(menusStore, {
      ...doc,
      _id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    menusStore.set(_id, rec);
    return rec;
  };

  (NavigationMenuModel as unknown as Record<string, unknown>).updateMany = async (
    q: Record<string, unknown>,
    update: Record<string, unknown>
  ) => {
    for (const [k, m] of menusStore.entries()) {
      if (q._id && typeof q._id === 'object' && '$in' in (q._id as Record<string, unknown>)) {
        const ids = (q._id as { $in: unknown[] }).$in.map(String);
        if (!ids.includes(String(m._id))) continue;
      }
      menusStore.set(k, attachSave(menusStore, { ...m, ...update }));
    }
    return { modifiedCount: 1 };
  };

  (NavigationMenuModel as unknown as Record<string, unknown>).findByIdAndDelete = async (id: string) => {
    const rec = menusStore.get(String(id)) || null;
    if (rec) menusStore.delete(String(id));
    return rec;
  };

  // NavigationItem stubs
  (NavigationItemModel as unknown as Record<string, unknown>).countDocuments = async (q: Record<string, unknown> = {}) =>
    Array.from(itemsStore.values()).filter((it) => {
      if (q.menuId && String(it.menuId) !== String(q.menuId)) return false;
      if (q.parentId !== undefined && String(it.parentId || '') !== String(q.parentId || '')) return false;
      return true;
    }).length;

  (NavigationItemModel as unknown as Record<string, unknown>).find = (q: Record<string, unknown> = {}) => {
    const rows = Array.from(itemsStore.values())
      .filter((it) => (!q.menuId || String(it.menuId) === String(q.menuId)))
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
    return makeQueryWrapper(rows);
  };

  (NavigationItemModel as unknown as Record<string, unknown>).findOne = (q: Record<string, unknown>) => {
    const rec =
      Array.from(itemsStore.values()).find(
        (it) =>
          (!q._id || String(it._id) === String(q._id)) &&
          (!q.menuId || String(it.menuId) === String(q.menuId))
      ) || null;
    const p = Promise.resolve(rec) as Promise<Record<string, unknown> | null> & {
      lean: () => Promise<Record<string, unknown> | null>;
    };
    p.lean = async () => (rec ? { ...rec } : null);
    return p;
  };

  (NavigationItemModel as unknown as Record<string, unknown>).create = async (doc: Record<string, unknown>) => {
    const _id = doc._id ? String(doc._id) : newObjectIdHex('b');
    const rec = attachSave(itemsStore, {
      ...doc,
      _id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    itemsStore.set(_id, rec);
    return rec;
  };

  (NavigationItemModel as unknown as Record<string, unknown>).insertMany = async (docs: Array<Record<string, unknown>>) => {
    for (const d of docs) {
      const _id = d._id ? String(d._id) : newObjectIdHex('b');
      itemsStore.set(_id, attachSave(itemsStore, { ...d, _id, createdAt: new Date(), updatedAt: new Date() }));
    }
    return docs;
  };

  (NavigationItemModel as unknown as Record<string, unknown>).findOneAndUpdate = async (
    q: Record<string, unknown>,
    update: Record<string, unknown>
  ) => {
    const rec = itemsStore.get(String(q._id));
    if (!rec || String(rec.menuId) !== String(q.menuId)) return null;
    const next = attachSave(itemsStore, { ...rec, ...update });
    itemsStore.set(String(q._id), next);
    return next;
  };

  (NavigationItemModel as unknown as Record<string, unknown>).deleteMany = async (q: Record<string, unknown>) => {
    const inIds =
      q._id && typeof q._id === 'object' && '$in' in (q._id as Record<string, unknown>)
        ? new Set((q._id as { $in: unknown[] }).$in.map(String))
        : null;
    for (const [k, it] of itemsStore.entries()) {
      if (q.menuId && String(it.menuId) !== String(q.menuId)) continue;
      if (inIds && !inIds.has(String(it._id))) continue;
      itemsStore.delete(k);
    }
    return { deletedCount: 1 };
  };

  (NavigationItemModel as unknown as Record<string, unknown>).aggregate = async () => {
    const counts = new Map<string, number>();
    for (const it of itemsStore.values()) {
      const k = String(it.menuId);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([_id, count]) => ({ _id, count }));
  };

  // MegaMenuSlide stubs
  (MegaMenuSlideModel as unknown as Record<string, unknown>).countDocuments = async () => slidesStore.size;
  (MegaMenuSlideModel as unknown as Record<string, unknown>).find = (q: Record<string, unknown> = {}) => {
    const rows = Array.from(slidesStore.values())
      .filter((s) => {
        if (q.menuIds) {
          const ids = Array.isArray(s.menuIds) ? s.menuIds.map(String) : [];
          return ids.includes(String(q.menuIds));
        }
        return true;
      })
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
    return makeQueryWrapper(rows);
  };
  (MegaMenuSlideModel as unknown as Record<string, unknown>).findById = (id: string) =>
    Promise.resolve(slidesStore.get(String(id)) || null);
  (MegaMenuSlideModel as unknown as Record<string, unknown>).create = async (doc: Record<string, unknown>) => {
    const _id = newObjectIdHex('c');
    const rec = attachSave(slidesStore, { ...doc, _id, createdAt: new Date(), updatedAt: new Date() });
    slidesStore.set(_id, rec);
    return rec;
  };
  (MegaMenuSlideModel as unknown as Record<string, unknown>).insertMany = async (docs: Array<Record<string, unknown>>) => {
    for (const d of docs) {
      const _id = newObjectIdHex('c');
      slidesStore.set(_id, attachSave(slidesStore, { ...d, _id, createdAt: new Date(), updatedAt: new Date() }));
    }
    return docs;
  };
  (MegaMenuSlideModel as unknown as Record<string, unknown>).findByIdAndUpdate = async (
    id: string,
    update: Record<string, unknown>
  ) => {
    const rec = slidesStore.get(String(id));
    if (!rec) return null;
    const next = attachSave(slidesStore, { ...rec, ...update });
    slidesStore.set(String(id), next);
    return next;
  };
  (MegaMenuSlideModel as unknown as Record<string, unknown>).findByIdAndDelete = async (id: string) => {
    const rec = slidesStore.get(String(id)) || null;
    if (rec) slidesStore.delete(String(id));
    return rec;
  };
  (MegaMenuSlideModel as unknown as Record<string, unknown>).updateMany = async () => ({ modifiedCount: 0 });
  (MegaMenuSlideModel as unknown as Record<string, unknown>).aggregate = async () => [];

  adminToken = signAuthToken(ADMIN_ID, 'super_admin', 1);
  customerToken = signAuthToken(CUSTOMER_ID, 'customer', 1);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/navigation', navigationRoutes);
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
  invalidateNavigationCache();
  UserModel.findById = originals.userFindById;
  AuditLogModel.create = originals.auditCreate;
  NavigationPlacementModel.find = originals.placementFind;
  NavigationPlacementModel.findOne = originals.placementFindOne;
  NavigationPlacementModel.insertMany = originals.placementInsertMany;
  NavigationMenuModel.countDocuments = originals.menuCount;
  NavigationMenuModel.find = originals.menuFind;
  NavigationMenuModel.findById = originals.menuFindById;
  NavigationMenuModel.exists = originals.menuExists;
  NavigationMenuModel.create = originals.menuCreate;
  NavigationMenuModel.updateMany = originals.menuUpdateMany;
  NavigationMenuModel.findByIdAndDelete = originals.menuFindByIdAndDelete;
  NavigationItemModel.countDocuments = originals.itemCount;
  NavigationItemModel.find = originals.itemFind;
  NavigationItemModel.findOne = originals.itemFindOne;
  NavigationItemModel.create = originals.itemCreate;
  NavigationItemModel.insertMany = originals.itemInsertMany;
  NavigationItemModel.findOneAndUpdate = originals.itemFindOneAndUpdate;
  NavigationItemModel.deleteMany = originals.itemDeleteMany;
  NavigationItemModel.aggregate = originals.itemAggregate;
  MegaMenuSlideModel.countDocuments = originals.slideCount;
  MegaMenuSlideModel.find = originals.slideFind;
  MegaMenuSlideModel.findById = originals.slideFindById;
  MegaMenuSlideModel.create = originals.slideCreate;
  MegaMenuSlideModel.insertMany = originals.slideInsertMany;
  MegaMenuSlideModel.findByIdAndUpdate = originals.slideFindByIdAndUpdate;
  MegaMenuSlideModel.findByIdAndDelete = originals.slideFindByIdAndDelete;
  MegaMenuSlideModel.updateMany = originals.slideUpdateMany;
  MegaMenuSlideModel.aggregate = originals.slideAggregate;
  CategoryModel.find = originals.catFind;
  BrandModel.find = originals.brandFind;
  CollectionModel.find = originals.colFind;
  CampaignModel.find = originals.campFind;
  StaticPageModel.find = originals.pageFind;
  BlogPostModel.find = originals.blogFind;
  ProductModel.find = originals.prodFind;

  if (originalReadyState) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
  } else {
    delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('admin navigation routes enforce 401 and 403 RBAC', async () => {
  const unauth = await fetch(`${baseUrl}/api/navigation/admin/menus`);
  assert.equal(unauth.status, 401);

  const cust = await fetch(`${baseUrl}/api/navigation/admin/menus`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(cust.status, 403);
});

test('public navigation auto-seeds real menus, filters inactive categories, and serves active slides', async () => {
  const res = await fetch(`${baseUrl}/api/navigation/public/all_categories`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    menu: {
      slug: string;
      categoriesTree: Array<{ slug: string; subcategories: Array<{ slug: string }> }>;
      slides: Array<{ mainHeading: string }>;
    };
  };
  assert.equal(body.menu.slug, 'all-categories-mega-menu');
  // Hidden category must NOT appear publicly
  assert.equal(
    body.menu.categoriesTree.some((c) => c.slug === 'hidden-cat'),
    false
  );
  assert.equal(body.menu.categoriesTree[0].slug, 'mobile-tablets');
  assert.equal(body.menu.categoriesTree[0].subcategories[0].slug, 'smartphones');
  assert.ok(body.menu.slides.length >= 1);
});

test('menu CRUD, single-active placement conflict, duplicate, publish/unpublish, and cache invalidation work end to end', async () => {
  // Attempt to create second published menu on single-active placement 'footer_nav' without replaceExistingActive
  const conflictRes = await fetch(`${baseUrl}/api/navigation/admin/menus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Conflict Footer Menu',
      slug: 'conflict-footer-menu',
      placement: 'footer_nav',
      menuType: 'classic_dropdown',
      status: 'published',
    }),
  });
  assert.equal(conflictRes.status, 409);

  // Create draft menu on custom_page_nav
  const createRes = await fetch(`${baseUrl}/api/navigation/admin/menus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Eid Mega Showcase',
      slug: 'eid-mega-showcase',
      placement: 'custom_page_nav',
      menuType: 'featured_product_mega_menu',
      status: 'draft',
      targetPaths: ['/page/eid-deals'],
    }),
  });
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as { menu: { _id: string; status: string; slug: string } };
  assert.equal(created.menu.status, 'draft');

  // Draft menu MUST NOT be exposed on public slug endpoint
  const draftPublic = await fetch(`${baseUrl}/api/navigation/public/menus/eid-mega-showcase`);
  assert.equal(draftPublic.status, 404);

  // Admin preview MUST resolve draft menu cleanly
  const previewRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${created.menu._id}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ megaMenuConfig: { columns: '3' } }),
  });
  assert.equal(previewRes.status, 200);
  const previewJson = (await previewRes.json()) as {
    menu: { megaMenuConfig: { columns: string } };
    isPreview: boolean;
  };
  assert.equal(previewJson.isPreview, true);
  assert.equal(previewJson.menu.megaMenuConfig.columns, '3');

  // Publish menu -> invalidates cache and becomes public
  const pubRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${created.menu._id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
  assert.equal(pubRes.status, 200);

  const liveRes = await fetch(`${baseUrl}/api/navigation/public/menus/eid-mega-showcase`);
  assert.equal(liveRes.status, 200);

  // Duplicate -> creates draft copy
  const dupRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${created.menu._id}/duplicate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(dupRes.status, 201);
  const dupJson = (await dupRes.json()) as { menu: { _id: string; status: string; name: string } };
  assert.equal(dupJson.menu.status, 'draft');
  assert.ok(dupJson.menu.name.endsWith('(Copy)'));

  // Delete duplicate
  const delRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${dupJson.menu._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
});

test('menu item CRUD, XSS SVG sanitization, circular hierarchy rejection, and reorder persistence work', async () => {
  const listRes = await fetch(`${baseUrl}/api/navigation/admin/menus?placement=header_main`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listJson = (await listRes.json()) as { menus: Array<{ _id: string }> };
  const menuId = listJson.menus[0]._id;

  // Unsafe javascript: URL rejected with 400
  const badUrlRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${menuId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      label: 'Bad Link',
      itemType: 'external_url',
      url: 'javascript:alert(1)',
    }),
  });
  assert.equal(badUrlRes.status, 400);

  // SVG sanitization strips scripts/events
  const createItemRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${menuId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      label: 'Custom SVG Item',
      itemType: 'internal_route',
      url: '/shop',
      iconType: 'svg',
      iconSvg: '<svg viewBox="0 0 24 24" onload="alert(1)"><script>xss()</script><path d="M2 2h20v20H2z"/></svg>',
    }),
  });
  assert.equal(createItemRes.status, 201);
  const itemJson = (await createItemRes.json()) as {
    item: { _id: string; iconSvg: string };
    flatItems: Array<{ _id: string; displayOrder: number }>;
  };
  assert.equal(itemJson.item.iconSvg.includes('<script'), false);
  assert.equal(itemJson.item.iconSvg.includes('onload'), false);
  assert.equal(itemJson.item.iconSvg.includes('<path'), true);

  // Circular hierarchy check: cannot set item as its own parent
  const selfParentRes = await fetch(
    `${baseUrl}/api/navigation/admin/menus/${menuId}/items/${itemJson.item._id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ parentId: itemJson.item._id }),
    }
  );
  assert.equal(selfParentRes.status, 400);

  // Reorder persistence
  const ids = itemJson.flatItems.map((i) => i._id);
  const reversed = [...ids].reverse();
  const reorderRes = await fetch(`${baseUrl}/api/navigation/admin/menus/${menuId}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      items: reversed.map((id, idx) => ({ _id: id, displayOrder: idx })),
    }),
  });
  assert.equal(reorderRes.status, 200);
  const reordered = (await reorderRes.json()) as { flatItems: Array<{ _id: string; displayOrder: number }> };
  assert.equal(reordered.flatItems[0]._id, reversed[0]);
});

test('promotional slide CRUD, schedule validation, and reorder work cleanly', async () => {
  const menusRes = await fetch(`${baseUrl}/api/navigation/admin/menus?placement=all_categories`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const menusJson = (await menusRes.json()) as { menus: Array<{ _id: string }> };
  const allCatsId = menusJson.menus[0]._id;

  // Invalid schedule window rejected
  const invalidSchedule = await fetch(`${baseUrl}/api/navigation/admin/slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      menuIds: [allCatsId],
      internalName: 'Bad Schedule Slide',
      mainHeading: 'Broken Window',
      startsAt: '2026-12-10T00:00:00Z',
      endsAt: '2026-12-01T00:00:00Z',
    }),
  });
  assert.equal(invalidSchedule.status, 400);

  // Valid slide creation
  const createSlide = await fetch(`${baseUrl}/api/navigation/admin/slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      menuIds: [allCatsId],
      internalName: 'Winter Electronics Campaign',
      badgeText: 'Hot Deal',
      mainHeading: 'Winter Gadgets',
      highlightText: 'Mega Sale',
      discountText: 'Up to 45% Off',
      description: 'Nationwide delivery',
      ctaLabel: 'Shop Winter Deals',
      ctaUrl: '/deals',
      priority: 99,
      isActive: true,
      status: 'published',
    }),
  });
  assert.equal(createSlide.status, 201);
  const createdSlide = (await createSlide.json()) as { slide: { _id: string; mainHeading: string } };

  // Public all_categories now shows highest-priority new slide first (cache was invalidated)
  const pubRes = await fetch(`${baseUrl}/api/navigation/public/all_categories`);
  const pubJson = (await pubRes.json()) as { menu: { slides: Array<{ mainHeading: string }> } };
  assert.equal(pubJson.menu.slides[0].mainHeading, 'Winter Gadgets');

  // Reorder & delete slide
  const slidesRes = await fetch(`${baseUrl}/api/navigation/admin/slides`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const slidesJson = (await slidesRes.json()) as { slides: Array<{ _id: string }> };
  const reorderRes = await fetch(`${baseUrl}/api/navigation/admin/slides/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ orderedIds: slidesJson.slides.map((s) => s._id).reverse() }),
  });
  assert.equal(reorderRes.status, 200);

  const delSlide = await fetch(`${baseUrl}/api/navigation/admin/slides/${createdSlide.slide._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delSlide.status, 200);
});
