type CacheEntry<T> = { data: T; ts: number };
const store: Record<string, CacheEntry<any>> = {};

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) return null;
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T) {
  store[key] = { data, ts: Date.now() };
}

export function cacheInvalidate(...keys: string[]) {
  for (const k of keys) delete store[k];
}

export function cacheInvalidatePrefix(prefix: string) {
  for (const k of Object.keys(store)) {
    if (k.startsWith(prefix)) delete store[k];
  }
}
