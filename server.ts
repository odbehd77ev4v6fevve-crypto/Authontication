import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { assertProductionStartupConfig, env } from './server/src/config/env.ts';
import { escapeXml } from './shared/security.ts';
import { expireAbandonedOnlineOrders } from './server/src/modules/orders/orderExpiration.service.ts';
import { connectDatabase, getDatabaseStatus } from './server/src/database/connection.ts';
import { seedDatabaseIfNeeded } from './server/src/database/seed.ts';
import { errorHandler } from './server/src/middleware/error.middleware.ts';
import adminAuthRoutes from './server/src/modules/auth/adminAuth.routes.ts';
import authRoutes from './server/src/modules/auth/auth.routes.ts';
import cartRoutes from './server/src/modules/cart/cart.routes.ts';
import catalogRoutes from './server/src/modules/catalog/catalog.routes.ts';
import { CategoryModel, ProductModel } from './server/src/modules/catalog/catalog.model.ts';
import {
  BlogPostModel,
  StaticPageModel,
  StoreSettingsModel,
} from './server/src/modules/cms/cms.model.ts';
import cmsRoutes from './server/src/modules/cms/cms.routes.ts';
import {
  adminSlideshowRouter,
  publicSlideshowRouter,
} from './server/src/modules/cms/slideshow.routes.ts';
import footerRoutes from './server/src/modules/footer/footer.routes.ts';
import inventoryRoutes from './server/src/modules/inventory/inventory.routes.ts';
import marketingRoutes from './server/src/modules/marketing/marketing.routes.ts';
import navigationRoutes from './server/src/modules/navigation/navigation.routes.ts';
import ordersRoutes from './server/src/modules/orders/orders.routes.ts';
import paymentsRoutes from './server/src/modules/payments/payments.routes.ts';
import qaRoutes from './server/src/modules/reviews/qa.routes.ts';
import reviewsRoutes from './server/src/modules/reviews/reviews.routes.ts';
import searchRoutes from './server/src/modules/search/search.routes.ts';
import supportRoutes from './server/src/modules/support/support.routes.ts';
import usersRoutes from './server/src/modules/users/users.routes.ts';

async function bootstrapServer() {
  assertProductionStartupConfig(env);
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const normalizedOrigin = origin.replace(/\/$/, '');
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
        const isAiStudioPreview =
          /^https:\/\/ais-(dev|pre)-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i.test(normalizedOrigin);
        const allowed =
          normalizedOrigin === env.appUrl ||
          env.allowedCorsOrigins.includes(normalizedOrigin) ||
          isLocalhost ||
          isAiStudioPreview;
        callback(null, allowed);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Initialize MongoDB Atlas connection & seed concurrently with Vite middleware startup
  const dbInitPromise = (async () => {
    const dbConnected = await connectDatabase();
    if (dbConnected) {
      try {
        await seedDatabaseIfNeeded({ forceCatalog: false });
      } catch (err) {
        console.error('[Startup Seed Warning]', err instanceof Error ? err.message : err);
      }
      try {
        await expireAbandonedOnlineOrders();
      } catch (err) {
        console.error('[Order Expiration Initial Sweep]', err instanceof Error ? err.message : err);
      }
    }
  })();

  const expirySweepTimer = setInterval(() => {
    void expireAbandonedOnlineOrders().catch((err) => {
      console.error('[Order Expiration Sweep Error]', err instanceof Error ? err.message : err);
    });
  }, 60 * 1000);
  expirySweepTimer.unref?.();

  const vitePromise = !env.isProd
    ? createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      })
    : Promise.resolve(null);

  const [, vite] = await Promise.all([dbInitPromise, vitePromise]);

  // Health & Readiness Endpoint
  app.get('/api/health', (_req, res) => {
    const db = getDatabaseStatus();
    res.status(db.connected ? 200 : 503).json({
      status: db.connected ? 'ok' : 'degraded',
      service: 'novara-commerce',
      database: db,
      integrations: {
        cloudinary: env.cloudinary.isConfigured,
        resend: env.resend.isConfigured,
        googleOAuth: env.oauth.isGoogleConfigured,
        facebookOAuth: env.oauth.isFacebookConfigured,
        paymentGateway: env.payment.isGatewayConfigured,
      },
    });
  });

  // Dynamic SEO Sitemap & Robots.txt
  app.get('/robots.txt', async (_req, res) => {
    res.type('text/plain');
    const db = getDatabaseStatus();
    let customRobots = '';
    let sitemapEnabled = true;
    if (db.connected) {
      const settings = await StoreSettingsModel.findOne({ key: 'primary' })
        .select('seoDefaults')
        .lean();
      customRobots = settings?.seoDefaults?.robotsTxt?.trim() || '';
      sitemapEnabled = settings?.seoDefaults?.sitemapEnabled !== false;
    }
    if (customRobots) {
      const hasSitemapDirective = /^sitemap:/im.test(customRobots);
      const output =
        sitemapEnabled && !hasSitemapDirective
          ? `${customRobots}\nSitemap: ${env.appUrl}/sitemap.xml`
          : customRobots;
      res.send(output);
      return;
    }
    const lines = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /checkout',
      'Disallow: /cart',
      'Disallow: /account',
    ];
    if (sitemapEnabled) lines.push(`Sitemap: ${env.appUrl}/sitemap.xml`);
    res.send(lines.join('\n'));
  });

  app.get('/sitemap.xml', async (_req, res) => {
    const base = env.appUrl;
    const db = getDatabaseStatus();
    if (db.connected) {
      const settings = await StoreSettingsModel.findOne({ key: 'primary' })
        .select('seoDefaults')
        .lean();
      if (settings?.seoDefaults?.sitemapEnabled === false) {
        res.status(404).type('text/plain').send('Sitemap disabled');
        return;
      }
    }

    const urls: string[] = [
      `${base}/`,
      `${base}/shop`,
      `${base}/deals`,
      `${base}/blog`,
      `${base}/faq`,
      `${base}/contact`,
      `${base}/track-order`,
    ];
    if (db.connected) {
      const now = new Date();
      const [categories, products, pages, blogPosts] = await Promise.all([
        CategoryModel.find({ isActive: true }).select('slug').lean(),
        ProductModel.find({ status: 'published' }).select('slug').lean(),
        StaticPageModel.find({ isPublished: true }).select('slug').lean(),
        BlogPostModel.find({
          $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: now } }],
        })
          .select('slug')
          .lean(),
      ]);
      for (const c of categories) urls.push(`${base}/category/${encodeURIComponent(c.slug)}`);
      for (const p of products) urls.push(`${base}/product/${encodeURIComponent(p.slug)}`);
      for (const pg of pages) urls.push(`${base}/page/${encodeURIComponent(pg.slug)}`);
      for (const bp of blogPosts) urls.push(`${base}/blog/${encodeURIComponent(bp.slug)}`);
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`)
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  // Modular REST API Routes
  app.use('/api/admin/auth', adminAuthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/marketing', marketingRoutes);
  app.use('/api/reviews', reviewsRoutes);
  app.use('/api/qa', qaRoutes);
  app.use('/api/cms', cmsRoutes);
  app.use('/api/footer', footerRoutes);
  app.use('/api/navigation', navigationRoutes);
  app.use('/api/admin/slideshows', adminSlideshowRouter);
  app.use('/api/public/slideshows', publicSlideshowRouter);
  app.use('/api/search', searchRoutes);
  app.use('/api/support', supportRoutes);

  // Unknown API routes (including /api root) must return JSON 404 rather than SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'API endpoint not found',
      code: 'API_NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    });
  });

  // Guarantee API errors always serialize as JSON before Vite/SPA fallback runs
  app.use('/api', errorHandler);

  // Frontend Vite Dev Middleware or Production Static Bundle
  if (vite) {
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      if (req.path === '/api' || req.path.startsWith('/api/')) {
        res.status(404).json({
          error: 'API endpoint not found',
          code: 'API_NOT_FOUND',
          message: 'The requested API endpoint does not exist.',
        });
        return;
      }
      if (path.extname(req.path)) {
        res.status(404).type('text/plain').send('Asset not found');
        return;
      }
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(500).type('text/plain').send('Client production bundle not found. Run npm run build.');
      }
    });
  }

  app.use(errorHandler);

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[NOVARA COMMERCE] Server listening on http://0.0.0.0:${env.port} (${env.nodeEnv})`);
  });
}

bootstrapServer().catch((err) => {
  console.error('[Fatal Startup Error]', err);
  process.exit(1);
});
