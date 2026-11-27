interface FooterCacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const footerCache = new Map<string, FooterCacheEntry<unknown>>();
let footerCacheGeneration = 1;

export function getFooterCacheKey(isAuthenticated: boolean): string {
  return `${footerCacheGeneration}|${isAuthenticated ? 'auth' : 'anon'}`;
}

export function getCachedFooter<T>(key: string): T | null {
  try {
    const entry = footerCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      footerCache.delete(key);
      return null;
    }
    return entry.value as T;
  } catch {
    return null;
  }
}

export function setCachedFooter<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  try {
    if (footerCache.size > 50) {
      footerCache.clear();
    }
    footerCache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
  } catch {
    // Graceful no-op
  }
}

export function invalidateFooterCache(): void {
  footerCacheGeneration += 1;
  footerCache.clear();
}

export function getFooterCacheGeneration(): number {
  return footerCacheGeneration;
}
