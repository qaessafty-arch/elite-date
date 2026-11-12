import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';

const N = 32768; // CPU/memory cost
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, { N: n, r: 8, p: 1, maxmem: 256 * n * 8 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** scrypt hash in the form `scrypt$N$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N);
  return `scrypt$${N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), Number(n));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Random URL-safe token for sessions, visitor cookies, reset links. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored hashed so a database leak does not expose live sessions. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
