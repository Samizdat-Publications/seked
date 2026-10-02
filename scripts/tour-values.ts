/**
 * The figures the guided tour draws (apps/walk/overlays.json, written by render/publish.py) that
 * only the claims engine knows: the Sphinx's place in the frame and the akhet claim's sunset and gap
 * bearings (C6), and the descending passage's slope (C3), under the canonical preset. Written to
 * build/tour-values.json, so publish.py never types them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { evaluateClaim, loadClaims } from '@seked/claims';

const db = loadDatabase();
const claims = loadClaims();
const env = buildEnvironment(resolve(db, 'canonical').values);
const byId = (id: string) => {
  const c = claims.find((x) => x.id === id);
  if (!c) throw new Error(`no claim ${id}`);
  return evaluateClaim(c, env);
};
const c6 = byId('C6');
const c3 = byId('C3');
if (c6.status !== 'computed' || c3.status !== 'computed') throw new Error('C6 or C3 did not compute');
const out = {
  sphinx: { east: env['sphinx.centre.offset.east'], north: env['sphinx.centre.offset.north'] },
  akhet: { epoch: -2499, sunsetAzimuth: c6.comparisons[0]!.value, gapAzimuth: c6.comparisons[0]!.targetValue },
  passage: { angle: env['passage.descending.angle'], thubanLowerAltitude: c3.comparisons[0]!.targetValue, epoch: claims.find((x) => x.id === 'C3')!.epoch },
};
mkdirSync(join(REPO_ROOT, 'build'), { recursive: true });
writeFileSync(join(REPO_ROOT, 'build', 'tour-values.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
