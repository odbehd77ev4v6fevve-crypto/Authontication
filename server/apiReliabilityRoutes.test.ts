import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import multer from 'multer';
import { errorHandler, asyncHandler } from './src/middleware/error.middleware.ts';
import { requireAuth, requirePermission, signAuthToken } from './src/middleware/auth.middleware.ts';
import authRoutes from './src/modules/auth/auth.routes.ts';
import { UserModel } from './src/modules/users/user.model.ts';
import { apiRequest, ApiError } from '../src/lib/api.ts';

function startTestApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 } });

  app.use('/api/auth', authRoutes);

  app.post('/api/test/json', (req, res) => {
    res.json({ received: req.body });
  });

  app.post('/api/test/upload', upload.single('file'), (_req, res) => {
    res.json({ ok: true });
  });

  app.get(
    '/api/test/async-crash',
    asyncHandler(async () => {
      throw new Error('Unexpected async explosion');
    })
  );

  app.get(
    '/api/test/db-timeout',
    asyncHandler(async () => {
      const err = new Error('Operation buffering timed out after 10000ms');
      err.name = 'MongooseError';
      throw err;
    })
  );

  app.get(
    '/api/test/protected',
    requireAuth,
    requirePermission('orders:read'),
    (_req, res) => {
      res.json({ ok: true });
    }
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'API endpoint not found',
      code: 'API_NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    });
  });

  app.use('/api', errorHandler);

  // Simulated production SPA fallback
  app.get('*', (req, res) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API endpoint not found', code: 'API_NOT_FOUND' });
      return;
    }
    res.type('text/html').send('<!doctype html><html><body>SPA</body></html>');
  });

  return new Promise<{ server: ReturnType<typeof app.listen>; baseUrl: string }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('Express API boundary guarantees JSON on /api root, 404s, malformed JSON, MulterError, DB timeout, and async errors', async () => {
  const { server, baseUrl } = await startTestApp();
  const originalFindById = UserModel.findById;

  try {
    // 1. /api root and missing /api/* return JSON 404, NEVER SPA HTML
    for (const path of ['/api', '/api/missing/endpoint']) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 404);
      assert.match(res.headers.get('content-type') || '', /application\/json/i);
      const body = (await res.json()) as { code: string };
      assert.equal(body.code, 'API_NOT_FOUND');
    }

    // 2. Normal storefront route still returns SPA HTML
    const spaRes = await fetch(`${baseUrl}/shop`);
    assert.equal(spaRes.status, 200);
    assert.match(spaRes.headers.get('content-type') || '', /text\/html/i);

    // 3. Malformed JSON payload returns 400 JSON INVALID_JSON
    const badJsonRes = await fetch(`${baseUrl}/api/test/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken": ',
    });
    assert.equal(badJsonRes.status, 400);
    assert.match(badJsonRes.headers.get('content-type') || '', /application\/json/i);
    assert.equal(((await badJsonRes.json()) as { code: string }).code, 'INVALID_JSON');

    // 4. Multer file size exceeded returns 413 JSON instead of 500
    const fd = new FormData();
    fd.append('file', new Blob(['0123456789abcdefghijklmnopqrstuvwxyz']), 'large.png');
    const uploadRes = await fetch(`${baseUrl}/api/test/upload`, { method: 'POST', body: fd });
    assert.equal(uploadRes.status, 413);
    assert.match(uploadRes.headers.get('content-type') || '', /application\/json/i);
    assert.equal(((await uploadRes.json()) as { code: string }).code, 'LIMIT_FILE_SIZE');

    // 5. Async handler failure & Mongoose buffering timeout return structured JSON (never HTML)
    const crashRes = await fetch(`${baseUrl}/api/test/async-crash`);
    assert.equal(crashRes.status, 500);
    assert.match(crashRes.headers.get('content-type') || '', /application\/json/i);

    const dbTimeoutRes = await fetch(`${baseUrl}/api/test/db-timeout`);
    assert.equal(dbTimeoutRes.status, 503);
    assert.equal(((await dbTimeoutRes.json()) as { code: string }).code, 'DB_UNAVAILABLE');

    // 6. GET /api/auth/providers responds immediately without DB buffering timeout
    const started = Date.now();
    const providers = await apiRequest<{ googleConfigured: boolean }>(`${baseUrl}/api/auth/providers`);
    assert.equal(typeof providers.googleConfigured, 'boolean');
    assert.ok(Date.now() - started < 1500);

    // 7. requireAuth returns 503 DB_UNAVAILABLE (not false 401 TOKEN_EXPIRED) when DB fails during lookup
    const token = signAuthToken('507f1f77bcf86cd799439011', 'customer', 0, 300);
    (UserModel as unknown as { findById: typeof UserModel.findById }).findById = (() => {
      const err = new Error('Server selection timed out');
      err.name = 'MongoServerSelectionError';
      return Promise.reject(err);
    }) as unknown as typeof UserModel.findById;

    await assert.rejects(
      () =>
        apiRequest(`${baseUrl}/api/test/protected`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 503);
        assert.equal(err.code, 'DB_UNAVAILABLE');
        return true;
      }
    );

    // 8. Unauthorized without token returns 401 AUTH_REQUIRED
    await assert.rejects(
      () => apiRequest(`${baseUrl}/api/test/protected`),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'AUTH_REQUIRED');
        return true;
      }
    );

    // 9. Forbidden customer accessing staff-only route returns 403 PERMISSION_DENIED
    (UserModel as unknown as { findById: typeof UserModel.findById }).findById = (async () => ({
      _id: '507f1f77bcf86cd799439011',
      role: 'customer',
      isActive: true,
      tokenVersion: 0,
    })) as unknown as typeof UserModel.findById;

    await assert.rejects(
      () =>
        apiRequest(`${baseUrl}/api/test/protected`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'PERMISSION_DENIED');
        return true;
      }
    );
  } finally {
    (UserModel as unknown as { findById: typeof UserModel.findById }).findById = originalFindById;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
