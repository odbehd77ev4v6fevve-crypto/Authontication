import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  apiRequest,
  isJsonContentType,
  looksLikeHtmlResponse,
  parseApiResponsePayload,
  resolveApiUrl,
  setAuthToken,
  setUnauthorizedHandler,
} from '../src/lib/api.ts';

test('resolveApiUrl supports same-origin relative paths and configured VITE_API_BASE_URL', () => {
  assert.equal(resolveApiUrl('/api/auth/me', ''), '/api/auth/me');
  assert.equal(resolveApiUrl('/api/auth/me', 'https://api.novara.bd/'), 'https://api.novara.bd/api/auth/me');
  assert.equal(resolveApiUrl('api/auth/me', 'https://api.novara.bd'), 'https://api.novara.bd/api/auth/me');
  assert.equal(
    resolveApiUrl('https://other.example.com/hook', 'https://api.novara.bd'),
    'https://other.example.com/hook'
  );
});

test('isJsonContentType & looksLikeHtmlResponse handle variants accurately', () => {
  assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
  assert.equal(isJsonContentType('Application/Problem+JSON'), true);
  assert.equal(isJsonContentType('application/vnd.api+json'), true);
  assert.equal(isJsonContentType('text/html; charset=utf-8'), false);

  assert.equal(looksLikeHtmlResponse('<!DOCTYPE html><html></html>', 'text/html'), true);
  assert.equal(looksLikeHtmlResponse('<!doctype html><div>SPA</div>', ''), true);
  assert.equal(looksLikeHtmlResponse('{"ok":true}', 'application/json'), false);
});

test('parseApiResponsePayload handles JSON, HTML, empty 204/205, and stripped headers', () => {
  const valid = parseApiResponsePayload({
    status: 200,
    contentType: 'application/problem+json',
    bodyText: '{"ok":true,"count":2}',
  });
  assert.equal(valid.isJson, true);
  assert.equal(valid.isHtml, false);
  assert.deepEqual(valid.data, { ok: true, count: 2 });

  const strippedHeaderJson = parseApiResponsePayload({
    status: 200,
    contentType: '',
    bodyText: '{"user":{"id":"1"}}',
  });
  assert.equal(strippedHeaderJson.isJson, true);
  assert.deepEqual(strippedHeaderJson.data, { user: { id: '1' } });

  const htmlSpa = parseApiResponsePayload({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    bodyText: '<!doctype html><html><body>SPA</body></html>',
  });
  assert.equal(htmlSpa.isHtml, true);
  assert.equal(htmlSpa.data, null);

  const noContent = parseApiResponsePayload({
    status: 204,
    contentType: '',
    bodyText: '',
  });
  assert.equal(noContent.isEmpty, true);
});

test('apiRequest parses JSON, handles 204/205, rejects 200 HTML, handles 502 HTML & 401 expiry cleanly', async () => {
  const originalFetch = globalThis.fetch;
  let capturedHeaders = new Headers();
  let unauthorizedCalls = 0;

  setAuthToken('jwt_test_token');
  setUnauthorizedHandler(() => {
    unauthorizedCalls += 1;
  });

  try {
    // 1. Successful JSON response with Accept & Authorization headers
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }) as typeof fetch;

    const okRes = await apiRequest<{ ok: boolean }>('/api/health');
    assert.equal(okRes.ok, true);
    assert.equal(capturedHeaders.get('Accept'), 'application/json');
    assert.equal(capturedHeaders.get('X-Requested-With'), 'XMLHttpRequest');
    assert.equal(capturedHeaders.get('Authorization'), 'Bearer jwt_test_token');

    // 2. Empty 204 & 205 responses succeed cleanly
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    assert.equal(await apiRequest<null>('/api/empty'), null);

    // 3. Unexpected 200 OK HTML (SPA fallback) throws structured ApiError with metadata
    globalThis.fetch = (async () =>
      new Response('<!doctype html><html><body>Index</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })) as typeof fetch;
    await assert.rejects(
      () => apiRequest('/api/orders/my'),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, 'UNEXPECTED_HTML_RESPONSE');
        assert.equal(err.status, 200);
        assert.equal(err.contentType, 'text/html; charset=utf-8');
        return true;
      }
    );

    // 4. Upstream 502 HTML proxy error surfaces clean message without leaking HTML
    globalThis.fetch = (async () =>
      new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch;
    await assert.rejects(
      () => apiRequest('/api/catalog/products'),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, 'UPSTREAM_HTML_ERROR');
        assert.equal(err.status, 502);
        assert.equal(err.message.includes('<html'), false);
        return true;
      }
    );

    // 5. 401 on non-login endpoint triggers unauthorizedHandler and clears token
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    await assert.rejects(
      () => apiRequest('/api/users/profile'),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      }
    );
    assert.equal(unauthorizedCalls, 1);

    // 6. Network outage yields clean ApiError(0, 'NETWORK_ERROR') when retries exhausted
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await assert.rejects(
      () => apiRequest('/api/health', { retryDelaysMs: [] }),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 0);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );

    // 7. Transient "Starting Server..." warmup HTML on GET automatically retries and recovers
    let warmupAttempts = 0;
    globalThis.fetch = (async () => {
      warmupAttempts += 1;
      if (warmupAttempts <= 2) {
        return new Response(
          '<!doctype html><html lang="en"><head><title>Starting Server...</title></head><body>Warming up</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      return new Response(JSON.stringify({ items: ['Electronics'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const recovered = await apiRequest<{ items: string[] }>(
      '/api/cms/public/navigation?location=header',
      { retryDelaysMs: [1, 1, 1] }
    );
    assert.deepEqual(recovered.items, ['Electronics']);
    assert.equal(warmupAttempts, 3);

    // 8. Persistent "Starting Server..." HTML exhausts retries cleanly with SERVER_STARTING
    globalThis.fetch = (async () =>
      new Response(
        '<!doctype html><html lang="en"><head><title>Starting Server...</title></head></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      )) as typeof fetch;
    await assert.rejects(
      () => apiRequest('/api/catalog/products?limit=5', { retryDelaysMs: [1, 1] }),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, 'SERVER_STARTING');
        assert.equal(err.status, 503);
        return true;
      }
    );

    // 9. Non-idempotent POST does not silently duplicate retries on warmup HTML
    let postAttempts = 0;
    globalThis.fetch = (async () => {
      postAttempts += 1;
      return new Response('<title>Starting Server...</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as typeof fetch;
    await assert.rejects(
      () =>
        apiRequest('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ total: 100 }),
          retryDelaysMs: [1, 1],
        }),
      (err: unknown) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, 'SERVER_STARTING');
        return true;
      }
    );
    assert.equal(postAttempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
    setUnauthorizedHandler(null);
  }
});
