import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DATA_DIR } from '@seked/data';
import { ClaimSchema, normaliseClaim, type Claim } from './schema';

// The schema and the normaliser are browser-safe and live next door.
export * from './schema';

export function loadClaims(dir = join(DATA_DIR, 'claims')): Claim[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  const claims = files.map((file) => {
    const raw = ClaimSchema.parse(parseYaml(readFileSync(join(dir, file), 'utf8')));
    return normaliseClaim(raw, file);
  });
  const ids = new Set<string>();
  for (const c of claims) {
    if (ids.has(c.id)) throw new Error(`duplicate claim id ${c.id}`);
    ids.add(c.id);
  }
  return claims.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
