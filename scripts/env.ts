import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Loads .env.local then .env into process.env for standalone scripts (Next loads them itself). */
export function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = join(process.cwd(), name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
}
