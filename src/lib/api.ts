export interface ApiErrorDetails {
  url?: string;
  contentType?: string;
  responsePreview?: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  url?: string;
  contentType?: string;
  responsePreview?: string;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: ApiErrorDetails
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.url = details?.url;
    this.contentType = details?.contentType;
    this.responsePreview = details?.responsePreview;
  }
}

let inMemoryToken: string | null = null;
let unauthorizedHandler: ((path: string) => void) | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function setUnauthorizedHandler(handler: ((path: string) => void) | null): void {
  unauthorizedHandler = handler;
}

export function resolveApiUrl(path: string, configuredBaseUrl?: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  const rawBase =
    configuredBaseUrl !== undefined
      ? configuredBaseUrl
      : viteEnv?.VITE_API_BASE_URL || viteEnv?.VITE_API_URL || '';
  const base = rawBase.trim().replace(/\/+$/, '');
  if (!base) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function isJsonContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('application/json') ||
    /^(?:application|text)\/(?:[\w.+-]+\+)?json\b/.test(normalized)
  );
}

export interface ApiRequestOptions extends RequestInit {
  isFormData?: boolean;
  retryDelaysMs?: number[];
}

const DEFAULT_WARMUP_RETRY_DELAYS_MS = [450, 1000, 1800, 2800];

export function looksLikeHtmlResponse(bodyText: string, contentType = ''): boolean {
  if (contentType.toLowerCase().includes('text/html')) {
    return true;
  }
  const trimmed = bodyText.trimStart().slice(0, 200).toLowerCase();
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body')
  );
}

export function isServerWarmupHtml(bodyText: string, contentType = ''): boolean {
  if (!looksLikeHtmlResponse(bodyText, contentType)) {
    return false;
  }
  const sample = bodyText.slice(0, 1200).toLowerCase();
  return (
    /<title>\s*starting server\.\.\.\s*<\/title>/i.test(sample) ||
    sample.includes('starting server...')
  );
}

function extractResponsePreview(bodyText: string): string {
  return bodyText.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function sleepWithAbort(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface ParsedApiResponse {
  data: unknown;
  isJson: boolean;
  isHtml: boolean;
  isWarmupHtml: boolean;
  isEmpty: boolean;
  contentType: string;
  preview: string;
}

export function parseApiResponsePayload(params: {
  status: number;
  contentType: string;
  bodyText: string;
}): ParsedApiResponse {
  const contentType = (params.contentType || '').trim();
  const trimmed = params.bodyText.trim();
  const isEmpty = params.status === 204 || params.status === 205 || trimmed.length === 0;
  const isHtml = !isEmpty && looksLikeHtmlResponse(trimmed, contentType);
  const isWarmupHtml = !isEmpty && isServerWarmupHtml(trimmed, contentType);
  const declaredJson = isJsonContentType(contentType);

  let data: unknown = null;
  let validJson = false;

  if (!isEmpty && !isHtml && (declaredJson || trimmed.startsWith('{') || trimmed.startsWith('['))) {
    try {
      data = JSON.parse(trimmed);
      validJson = true;
    } catch {
      data = null;
      validJson = false;
    }
  }

  return {
    data,
    isJson: declaredJson || validJson,
    isHtml,
    isWarmupHtml,
    isEmpty,
    contentType,
    preview: isEmpty ? '' : extractResponsePreview(params.bodyText),
  };
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { isFormData, retryDelaysMs, ...fetchOptions } = options;
  const targetUrl = resolveApiUrl(path);
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const delays = isIdempotent
    ? retryDelaysMs ?? DEFAULT_WARMUP_RETRY_DELAYS_MS
    : [];

  const headers = new Headers(fetchOptions.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (!isFormData && fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (inMemoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        ...fetchOptions,
        headers,
        credentials: 'include',
      });
    } catch (err) {
      const isAborted = err instanceof DOMException && err.name === 'AbortError';
      if (!isAborted && attempt < delays.length) {
        try {
          await sleepWithAbort(delays[attempt], fetchOptions.signal);
          continue;
        } catch {
          throw new ApiError(
            'The request was cancelled before completing.',
            0,
            'REQUEST_ABORTED',
            { url: targetUrl }
          );
        }
      }
      throw new ApiError(
        isAborted
          ? 'The request was cancelled before completing.'
          : 'Unable to reach the server. Please check your network connection and try again.',
        0,
        isAborted ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
        { url: targetUrl }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const bodyText =
      response.status === 204 || response.status === 205
        ? ''
        : await response.text().catch(() => '');

    const parsed = parseApiResponsePayload({
      status: response.status,
      contentType,
      bodyText,
    });

    const isTransientProxyWarmup =
      parsed.isWarmupHtml ||
      (parsed.isHtml && (response.status === 502 || response.status === 503 || response.status === 504));

    if (isTransientProxyWarmup && attempt < delays.length) {
      try {
        await sleepWithAbort(delays[attempt], fetchOptions.signal);
        continue;
      } catch {
        throw new ApiError(
          'The request was cancelled before completing.',
          0,
          'REQUEST_ABORTED',
          { url: targetUrl }
        );
      }
    }

    const errorPayload =
      parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
        ? (parsed.data as { message?: string; error?: string; code?: string })
        : null;

    if (!response.ok) {
      const isAuthCredentialAttempt =
        path.startsWith('/api/auth/login') || path.startsWith('/api/admin/auth/login');
      if (response.status === 401 && !isAuthCredentialAttempt) {
        inMemoryToken = null;
        unauthorizedHandler?.(path);
      }

      let message =
        errorPayload?.message ||
        errorPayload?.error ||
        `Request failed with status ${response.status}`;
      let code = errorPayload?.code || 'REQUEST_FAILED';

      if (parsed.isHtml) {
        message = parsed.isWarmupHtml
          ? 'The server is still starting up. Please try again in a few seconds.'
          : response.status >= 500
          ? `Server temporarily unavailable (HTTP ${response.status}). Please try again shortly.`
          : `Request could not be completed (HTTP ${response.status}).`;
        code = parsed.isWarmupHtml ? 'SERVER_STARTING' : 'UPSTREAM_HTML_ERROR';
      }

      throw new ApiError(message, response.status, code, {
        url: targetUrl,
        contentType: parsed.contentType,
        responsePreview: parsed.preview,
      });
    }

    if (response.status === 204 || response.status === 205) {
      return null as T;
    }

    if (parsed.isHtml || parsed.isEmpty || parsed.data === null || !parsed.isJson) {
      throw new ApiError(
        parsed.isWarmupHtml
          ? 'The server is still starting up. Please try again in a few seconds.'
          : 'Unable to process the server response. Please try again or refresh the page.',
        parsed.isWarmupHtml ? 503 : response.status,
        parsed.isWarmupHtml
          ? 'SERVER_STARTING'
          : parsed.isHtml
          ? 'UNEXPECTED_HTML_RESPONSE'
          : 'INVALID_RESPONSE',
        {
          url: targetUrl,
          contentType: parsed.contentType,
          responsePreview: parsed.preview,
        }
      );
    }

    return parsed.data as T;
  }

  throw new ApiError(
    'The server is still starting up. Please try again in a few seconds.',
    503,
    'SERVER_STARTING',
    { url: targetUrl }
  );
}

export async function downloadCsvRequest(path: string, filename: string): Promise<void> {
  const targetUrl = resolveApiUrl(path);
  const headers = new Headers({
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'text/csv, application/json',
  });
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server to download the CSV file.',
      0,
      'NETWORK_ERROR',
      { url: targetUrl }
    );
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const parsed = parseApiResponsePayload({
      status: response.status,
      contentType,
      bodyText,
    });
    const errObj =
      parsed.data && typeof parsed.data === 'object'
        ? (parsed.data as { message?: string; error?: string; code?: string })
        : null;
    if (response.status === 401) {
      inMemoryToken = null;
      unauthorizedHandler?.(path);
    }
    throw new ApiError(
      errObj?.message || errObj?.error || `Export failed with status ${response.status}.`,
      response.status,
      errObj?.code || 'EXPORT_FAILED',
      { url: targetUrl, contentType, responsePreview: parsed.preview }
    );
  }

  const text = await response.text();
  if (looksLikeHtmlResponse(text, contentType)) {
    throw new ApiError(
      'Export endpoint returned an HTML page instead of CSV data.',
      response.status,
      'UNEXPECTED_HTML_RESPONSE',
      { url: targetUrl, contentType, responsePreview: extractResponsePreview(text) }
    );
  }

  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBdt(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-US')}`;
}
