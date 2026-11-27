import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import { SlideshowModel } from '../server/src/modules/cms/cms.model.ts';
import {
  adminSlideshowRouter,
  publicSlideshowRouter,
} from '../server/src/modules/cms/slideshow.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { UserModel } from '../server/src/modules/users/user.model.ts';

interface FakeSlideRecord {
  _id: string;
  internalName: string;
  badgeText: string;
  mainHeading: string;
  highlightText: string;
  subtitle: string;
  description: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  primaryButtonNewTab: boolean;
  secondaryButtonText: string;
  secondaryButtonUrl: string;
  secondaryButtonNewTab: boolean;
  destinationUrl: string;
  destinationNewTab: boolean;
  desktopImageUrl: string;
  desktopImagePublicId: string;
  mobileImageUrl: string;
  mobileImagePublicId: string;
  altText: string;
  imagePosition: string;
  horizontalAlign: string;
  verticalAlign: string;
  contentMaxWidthPx: number;
  paddingPx: number;
  fontFamily: string;
  fontWeight: string;
  headingSizePx: number;
  subtitleSizePx: number;
  lineHeight: number;
  letterSpacingPx: number;
  textColor: string;
  highlightColor: string;
  primaryBtnBg: string;
  primaryBtnText: string;
  secondaryBtnBg: string;
  secondaryBtnText: string;
  overlayType: string;
  overlayColor: string;
  overlayOpacity: number;
  gradientStart: string;
  gradientEnd: string;
  gradientStartOpacity: number;
  gradientEndOpacity: number;
  gradientDirection: string;
  blurPx: number;
  animationEffect: string;
  animationDurationMs: number;
  animationDelayMs: number;
  displayOrder: number;
  status: 'draft' | 'published' | 'scheduled' | 'inactive';
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

interface FakeSlideshowRecord {
  _id: string;
  name: string;
  placement: 'homepage' | 'cart' | 'wishlist' | 'checkout';
  targetPage: string;
  isActive: boolean;
  autoplay: boolean;
  infiniteLoop: boolean;
  pauseOnHover: boolean;
  animationSpeed: 'fast' | 'normal' | 'slow';
  transitionEffect: string;
  transitionDurationMs: number;
  autoplayIntervalMs: number;
  indicatorStyle: string;
  showIndicators: boolean;
  showArrows: boolean;
  desktopHeightPx: number;
  tabletHeightPx: number;
  mobileHeightPx: number;
  borderRadiusPx: number;
  compactMode: boolean;
  slides: FakeSlideRecord[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<FakeSlideshowRecord>;
}

const ADMIN_ID = '507f1f77bcf86cd799439021';
const MARKETING_ID = '507f1f77bcf86cd799439022';
const CUSTOMER_ID = '507f1f77bcf86cd799439023';

const slideshowStore = new Map<string, FakeSlideshowRecord>();
let counter = 1;

function nextId(prefix = 'b'): string {
  return (counter++).toString(16).padStart(24, prefix);
}

const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindById: UserModel.findById,
  auditCreate: AuditLogModel.create,
  find: SlideshowModel.find,
  findById: SlideshowModel.findById,
  create: SlideshowModel.create,
  countDocuments: SlideshowModel.countDocuments,
  findByIdAndDelete: SlideshowModel.findByIdAndDelete,
};

let server: ReturnType<express.Express['listen']>;
let baseUrl = '';
let adminToken = '';
let marketingToken = '';
let customerToken = '';

function normalizeSlides(rawSlides: Array<Partial<FakeSlideRecord>> = []): FakeSlideRecord[] {
  return rawSlides.map((s, idx) => ({
    internalName: 'Slide',
    badgeText: '',
    mainHeading: 'Heading',
    highlightText: '',
    subtitle: '',
    description: '',
    primaryButtonText: '',
    primaryButtonUrl: '',
    primaryButtonNewTab: false,
    secondaryButtonText: '',
    secondaryButtonUrl: '',
    secondaryButtonNewTab: false,
    destinationUrl: '',
    destinationNewTab: false,
    desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
    desktopImagePublicId: '',
    mobileImageUrl: '',
    mobileImagePublicId: '',
    altText: 'Visual',
    imagePosition: 'center',
    horizontalAlign: 'left',
    verticalAlign: 'center',
    contentMaxWidthPx: 620,
    paddingPx: 40,
    fontFamily: 'Poppins',
    fontWeight: '700',
    headingSizePx: 40,
    subtitleSizePx: 16,
    lineHeight: 1.15,
    letterSpacingPx: 0,
    textColor: '#FFFFFF',
    highlightColor: '#A3E635',
    primaryBtnBg: '#A3E635',
    primaryBtnText: '#0F172A',
    secondaryBtnBg: '#FFFFFF',
    secondaryBtnText: '#FFFFFF',
    overlayType: 'gradient',
    overlayColor: '#052E16',
    overlayOpacity: 50,
    gradientStart: '#041E11',
    gradientEnd: '#06381C',
    gradientStartOpacity: 80,
    gradientEndOpacity: 30,
    gradientDirection: 'to right',
    blurPx: 0,
    animationEffect: 'fade',
    animationDurationMs: 600,
    animationDelayMs: 0,
    displayOrder: idx,
    status: 'published',
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...s,
    _id: s._id ? String(s._id) : nextId('c'),
  }));
}

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
        name: 'Customer User',
        role: 'customer',
        isActive: true,
        tokenVersion: 1,
      };
    }
    return null;
  };

  (AuditLogModel as unknown as Record<string, unknown>).create = async () => ({});

  (SlideshowModel as unknown as Record<string, unknown>).countDocuments = async (
    query: Record<string, unknown> = {}
  ) => {
    return Array.from(slideshowStore.values()).filter((sh) => {
      if (query.placement && sh.placement !== query.placement) return false;
      return true;
    }).length;
  };

  (SlideshowModel as unknown as Record<string, unknown>).find = (
    query: Record<string, unknown> = {}
  ) => {
    const matched = Array.from(slideshowStore.values()).filter((sh) => {
      if (query.placement && sh.placement !== query.placement) return false;
      if (query.isActive !== undefined && sh.isActive !== query.isActive) return false;
      return true;
    });
    const cloneList = () => matched.map((m) => ({ ...m, slides: m.slides.map((s) => ({ ...s })) }));
    return {
      select: () => ({
        lean: async () => cloneList(),
      }),
      sort: () => ({
        lean: async () => cloneList(),
      }),
    };
  };

  (SlideshowModel as unknown as Record<string, unknown>).findById = (id: string) => {
    const rec = slideshowStore.get(String(id)) || null;
    const p = Promise.resolve(rec) as Promise<FakeSlideshowRecord | null> & {
      lean: () => Promise<FakeSlideshowRecord | null>;
    };
    p.lean = async () => (rec ? { ...rec, slides: rec.slides.map((s) => ({ ...s })) } : null);
    return p;
  };

  (SlideshowModel as unknown as Record<string, unknown>).create = async (
    doc: Partial<FakeSlideshowRecord>
  ) => {
    const _id = nextId('d');
    const now = new Date();
    const record: FakeSlideshowRecord = {
      name: doc.name || 'Untitled Slideshow',
      placement: doc.placement || 'homepage',
      targetPage: doc.targetPage || '/',
      isActive: doc.isActive ?? true,
      autoplay: doc.autoplay ?? true,
      infiniteLoop: doc.infiniteLoop ?? true,
      pauseOnHover: doc.pauseOnHover ?? true,
      animationSpeed: doc.animationSpeed || 'normal',
      transitionEffect: doc.transitionEffect || 'fade',
      transitionDurationMs: doc.transitionDurationMs ?? 600,
      autoplayIntervalMs: doc.autoplayIntervalMs ?? 5000,
      indicatorStyle: doc.indicatorStyle || 'dots',
      showIndicators: doc.showIndicators ?? true,
      showArrows: doc.showArrows ?? true,
      desktopHeightPx: doc.desktopHeightPx ?? 480,
      tabletHeightPx: doc.tabletHeightPx ?? 380,
      mobileHeightPx: doc.mobileHeightPx ?? 300,
      borderRadiusPx: doc.borderRadiusPx ?? 20,
      compactMode: doc.compactMode ?? false,
      slides: normalizeSlides(doc.slides || []),
      _id,
      createdAt: now,
      updatedAt: now,
      save: async () => {
        record.slides = normalizeSlides(record.slides);
        record.updatedAt = new Date();
        slideshowStore.set(_id, record);
        return record;
      },
    };
    slideshowStore.set(_id, record);
    return record;
  };

  (SlideshowModel as unknown as Record<string, unknown>).findByIdAndDelete = async (id: string) => {
    const rec = slideshowStore.get(String(id)) || null;
    if (rec) slideshowStore.delete(String(id));
    return rec;
  };

  adminToken = signAuthToken(ADMIN_ID, 'super_admin', 1);
  marketingToken = signAuthToken(MARKETING_ID, 'marketing_manager', 1);
  customerToken = signAuthToken(CUSTOMER_ID, 'customer', 1);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin/slideshows', adminSlideshowRouter);
  app.use('/api/public/slideshows', publicSlideshowRouter);
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
  SlideshowModel.find = originals.find;
  SlideshowModel.findById = originals.findById;
  SlideshowModel.create = originals.create;
  SlideshowModel.countDocuments = originals.countDocuments;
  SlideshowModel.findByIdAndDelete = originals.findByIdAndDelete;

  if (originalReadyState) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
  } else {
    delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('admin slideshow endpoints require auth (401) and cms:write role (403)', async () => {
  const unauth = await fetch(`${baseUrl}/api/admin/slideshows`);
  assert.equal(unauth.status, 401);

  const cust = await fetch(`${baseUrl}/api/admin/slideshows`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(cust.status, 403);
});

test('GET /api/admin/slideshows auto-seeds all 4 independent page placements cleanly', async () => {
  const res = await fetch(`${baseUrl}/api/admin/slideshows`, {
    headers: { Authorization: `Bearer ${marketingToken}` },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { slideshows: FakeSlideshowRecord[] };
  const placements = body.slideshows.map((s) => s.placement).sort();
  assert.deepEqual(placements, ['cart', 'checkout', 'homepage', 'wishlist']);
});

test('slide CRUD, validation, duplicate, reorder, and placement isolation work end to end', async () => {
  const cartRes = await fetch(`${baseUrl}/api/admin/slideshows?placement=cart`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(cartRes.status, 200);
  const cartJson = (await cartRes.json()) as { slideshows: FakeSlideshowRecord[] };
  assert.equal(cartJson.slideshows.length, 1);
  const cartSlideshowId = cartJson.slideshows[0]._id;

  // Reject unsafe URL on add slide
  const badSlide = await fetch(`${baseUrl}/api/admin/slideshows/${cartSlideshowId}/slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      mainHeading: 'Bad Script Link',
      desktopImageUrl: '/src/assets/images/hero_shopper_bags_1795621229978.jpg',
      destinationUrl: 'javascript:alert(1)',
    }),
  });
  assert.equal(badSlide.status, 400);

  // Add valid cart-specific slide
  const addRes = await fetch(`${baseUrl}/api/admin/slideshows/${cartSlideshowId}/slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      internalName: 'Cart Upsell Special',
      mainHeading: 'Add Audio Gear & Unlock Free Delivery',
      highlightText: 'Free Delivery',
      desktopImageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
      primaryButtonText: 'Explore Offers',
      primaryButtonUrl: '/deals',
      destinationUrl: '/deals',
      status: 'published',
      isActive: true,
    }),
  });
  assert.equal(addRes.status, 201);
  const added = (await addRes.json()) as { slideshow: FakeSlideshowRecord; slide: FakeSlideRecord };
  assert.equal(added.slide.mainHeading, 'Add Audio Gear & Unlock Free Delivery');

  // Edit slideshow indicator & autoplay settings without losing slides
  const settingsRes = await fetch(`${baseUrl}/api/admin/slideshows/${cartSlideshowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ indicatorStyle: 'progress', pauseOnHover: true }),
  });
  assert.equal(settingsRes.status, 200);
  const settingsBody = (await settingsRes.json()) as { slideshow: FakeSlideshowRecord };
  assert.equal(settingsBody.slideshow.indicatorStyle, 'progress');
  assert.ok(settingsBody.slideshow.slides.length >= 2);

  // Duplicate added slide -> starts as inactive draft
  const dupRes = await fetch(
    `${baseUrl}/api/admin/slideshows/${cartSlideshowId}/slides/${added.slide._id}/duplicate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  assert.equal(dupRes.status, 201);
  const dupBody = (await dupRes.json()) as { slide: FakeSlideRecord };
  assert.ok(dupBody.slide.internalName.endsWith('(Copy)'));
  assert.equal(dupBody.slide.isActive, false);
  assert.equal(dupBody.slide.status, 'draft');

  // Reorder slides: put added slide first
  const allSlideIds = added.slideshow.slides.map((s) => s._id);
  const orderedSlideIds = [
    added.slide._id,
    ...allSlideIds.filter((id) => id !== added.slide._id),
  ];
  const reorderRes = await fetch(`${baseUrl}/api/admin/slideshows/${cartSlideshowId}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ orderedSlideIds }),
  });
  assert.equal(reorderRes.status, 200);
  const reorderedBody = (await reorderRes.json()) as { slideshow: FakeSlideshowRecord };
  assert.equal(reorderedBody.slideshow.slides[0]._id, added.slide._id);
  assert.equal(reorderedBody.slideshow.slides[0].displayOrder, 0);

  // Public cart endpoint returns only active published slides in updated order + no-store
  const pubCart = await fetch(`${baseUrl}/api/public/slideshows/cart`);
  assert.equal(pubCart.status, 200);
  assert.equal(pubCart.headers.get('cache-control'), 'no-store');
  const pubCartJson = (await pubCart.json()) as { slideshow: FakeSlideshowRecord };
  assert.equal(pubCartJson.slideshow.placement, 'cart');
  assert.equal(pubCartJson.slideshow.indicatorStyle, 'progress');
  assert.equal(pubCartJson.slideshow.slides[0].mainHeading, 'Add Audio Gear & Unlock Free Delivery');
  assert.ok(pubCartJson.slideshow.slides.every((s) => s.isActive && s.status !== 'draft'));

  // Placement isolation: wishlist public slideshow does NOT include cart slide
  const pubWishlist = await fetch(`${baseUrl}/api/public/slideshows/wishlist`);
  assert.equal(pubWishlist.status, 200);
  const pubWishlistJson = (await pubWishlist.json()) as { slideshow: FakeSlideshowRecord };
  assert.equal(pubWishlistJson.slideshow.placement, 'wishlist');
  assert.ok(
    !pubWishlistJson.slideshow.slides.some(
      (s) => s.mainHeading === 'Add Audio Gear & Unlock Free Delivery'
    )
  );

  // Delete the duplicated slide cleanly
  const delSlideRes = await fetch(
    `${baseUrl}/api/admin/slideshows/${cartSlideshowId}/slides/${dupBody.slide._id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  assert.equal(delSlideRes.status, 200);

  // Invalid placement on public route returns 400
  const invalidPub = await fetch(`${baseUrl}/api/public/slideshows/unknown_page`);
  assert.equal(invalidPub.status, 400);
});
