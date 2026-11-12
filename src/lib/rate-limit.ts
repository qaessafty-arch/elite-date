import { headers } from 'next/headers';

/**
 * Fixed-window in-memory rate limiter. Good for a single Node process.
 * For multi-instance/serverless deployments swap the Map for Redis (see README, "Deployment").
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

/** Returns false when the caller exceeded `limit` calls of `action` per window. */
export async function limitByIp(action: string, limit: number, windowMs = 60_000): Promise<boolean> {
  return rateLimit(`${action}:${await clientIp()}`, limit, windowMs);
}
