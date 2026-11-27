interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 3 * 60 * 1000;
const SUGGESTIONS_TTL_MS = 45 * 1000;

const searchCache = new Map<string, CacheEntry<unknown>>();
let searchCacheGeneration = 1;

export function getSearchCacheKey(scope: string, detail = ''): string {
  return `${searchCacheGeneration}|${scope}|${detail}`;
}

export function getCachedSearch<T>(key: string): T | null {
  try {
    const entry = searchCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      searchCache.delete(key);
      return null;
    }
    return entry.value as T;
  } catch {
    return null;
  }
}

export function setCachedSearch<T>(
  key: string,
  value: T,
  ttlMs = DEFAULT_TTL_MS
): void {
  try {
    if (searchCache.size > 400) {
      searchCache.clear();
    }
    searchCache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
  } catch {
    // Non-fatal cache write
  }
}

export function getSuggestionsTtlMs(): number {
  return SUGGESTIONS_TTL_MS;
}

export function invalidateSearchCache(): void {
  searchCacheGeneration += 1;
  searchCache.clear();
}

export function getSearchCacheGeneration(): number {
  return searchCacheGeneration;
}
