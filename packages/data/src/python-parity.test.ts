import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDatabase, REPO_ROOT, resolve } from './index';

function python(): string | undefined {
  for (const bin of ['python3', 'python']) {
    try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return bin; } catch { /* try next */ }
  }
  return undefined;
}
const py = python();

describe.skipIf(!py)('blender/seked_data.py resolves the database exactly like @seked/data', () => {
  const db = loadDatabase();
  for (const preset of db.presets) {
    it(`preset ${preset.id}`, () => {
      const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), preset.id], { encoding: 'utf8' });
      const theirs = JSON.parse(out) as Record<string, number>;
      expect(theirs).toEqual(resolve(db, preset.id).values);
    });
  }
});
