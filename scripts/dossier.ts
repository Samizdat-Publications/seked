import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { evaluateClaim, formatResidual, loadClaims, renderDossier } from '@seked/claims';

const db = loadDatabase();
const claims = loadClaims();
const md = renderDossier(db, claims);
const out = join(REPO_ROOT, 'docs', 'dossier.md');
writeFileSync(out, md);

const env = buildEnvironment(resolve(db, 'canonical').values);
for (const c of claims) {
  const r = evaluateClaim(c, env);
  const fit = r.status !== 'computed' ? `pending (${r.status})` : r.comparisons.map((x) => formatResidual(x)).join(', ');
  console.log(`${c.id.padEnd(3)} ${c.title.padEnd(40)} ${fit}`);
}
console.log(`\nwrote ${out}`);
