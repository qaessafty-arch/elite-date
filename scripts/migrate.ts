/**
 * Minimal SQL migration runner.
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --reset drop everything in the public schema first (dev only)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from './env';
import pg from 'pg';

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = new pg.Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  if (process.argv.includes('--reset')) {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
    await client.query('drop schema public cascade; create schema public;');
    console.log('schema reset');
  }

  await client.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const applied = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
  const dir = join(process.cwd(), 'db', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
  console.log('migrations up to date');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
