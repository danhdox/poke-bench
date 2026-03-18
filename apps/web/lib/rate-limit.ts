type Bucket = {
  count: number;
  resetAt: number;
};

const globalState = globalThis as typeof globalThis & {
  __pokeBenchRateLimit?: Map<string, Bucket>;
};

const buckets = globalState.__pokeBenchRateLimit ?? new Map<string, Bucket>();
globalState.__pokeBenchRateLimit = buckets;

export function checkRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}
