interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const navigationCache = new Map<string, CacheEntry<unknown>>();
let cacheGeneration = 1;

export function getNavigationCacheKey(parts: {
  scope: 'all' | 'placement' | 'slug';
  key?: string;
  path?: string;
  isCustomer?: boolean;
}): string {
  return [
    cacheGeneration,
    parts.scope,
    parts.key || '*',
    (parts.path || '').toLowerCase(),
    parts.isCustomer ? 'auth' : 'anon',
  ].join('|');
}

export function getCachedNavigation<T>(key: string): T | null {
  try {
    const entry = navigationCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      navigationCache.delete(key);
      return null;
    }
    return entry.value as T;
  } catch {
    return null;
  }
}

export function setCachedNavigation<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  try {
    if (navigationCache.size > 300) {
      navigationCache.clear();
    }
    navigationCache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
  } catch {
    // Gracefully skip cache write errors
  }
}

export function invalidateNavigationCache(): void {
  cacheGeneration += 1;
  navigationCache.clear();
}

export function getNavigationCacheGeneration(): number {
  return cacheGeneration;
}
