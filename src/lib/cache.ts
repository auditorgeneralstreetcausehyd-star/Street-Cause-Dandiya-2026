interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

export interface CacheOptions {
  ttlSeconds?: number;
  tag?: string;
}

/**
 * Retrieve data from cache or execute fetcher function and store in cache
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60
): Promise<{ data: T; isCached: boolean; ageSeconds: number }> {
  const now = Date.now();
  const existing = cacheStore.get(key);

  if (existing && now < existing.expiresAt) {
    const ageSeconds = Math.round((now - existing.cachedAt) / 1000);
    return {
      data: existing.data,
      isCached: true,
      ageSeconds,
    };
  }

  const freshData = await fetcher();
  cacheStore.set(key, {
    data: freshData,
    cachedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });

  return {
    data: freshData,
    isCached: false,
    ageSeconds: 0,
  };
}

/**
 * Invalidate all or matching cache entries
 */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix) || key.includes(prefix)) {
      cacheStore.delete(key);
    }
  }
}
