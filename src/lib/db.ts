import pg from 'pg';

// int8 (count(*), sums) → number. Values in this app stay far below 2^53.
pg.types.setTypeParser(20, (v) => Number(v));

const globalForPg = globalThis as unknown as { __haldenPool?: pg.Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');
  return new pg.Pool({
    connectionString,
    max: 10,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
}

export function pool(): pg.Pool {
  if (!globalForPg.__haldenPool) globalForPg.__haldenPool = createPool();
  return globalForPg.__haldenPool;
}

/** Parameterised query returning rows. Never interpolate user input into `text`. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  client?: pg.PoolClient,
): Promise<T[]> {
  const res = await (client ?? pool()).query(text, params as never[]);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  client?: pg.PoolClient,
): Promise<T | null> {
  const rows = await query<T>(text, params, client);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction; rolls back on any thrown error. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
