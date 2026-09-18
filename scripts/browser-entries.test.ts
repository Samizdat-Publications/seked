/**
 * The viewer imports @seked/data/browser, @seked/claims/browser and
 * @seked/sky/browser, plus @seked/geometry and @seked/units whole. None of
 * that may reach a node: builtin, or Vite would hand the browser a shim and
 * the first fetch of a measurement would fail in the wild rather than here.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@seked/data';

const ENTRIES: Record<string, string> = {
  '@seked/data/browser': join(REPO_ROOT, 'packages', 'data', 'src', 'browser.ts'),
  '@seked/claims/browser': join(REPO_ROOT, 'packages', 'claims', 'src', 'browser.ts'),
  '@seked/sky/browser': join(REPO_ROOT, 'packages', 'sky', 'src', 'browser.ts'),
  '@seked/runner/browser': join(REPO_ROOT, 'packages', 'runner', 'src', 'browser.ts'),
  '@seked/geometry': join(REPO_ROOT, 'packages', 'geometry', 'src', 'index.ts'),
  '@seked/units': join(REPO_ROOT, 'packages', 'units', 'src', 'index.ts'),
};

/** Packages the browser may pull in besides the workspace's own. */
/**
 * What a browser entry may reach for. `zod` types the claim files; the
 * Claude SDK and `yaml` are the runner's, which is a browser entry because
 * a reader puts a claim to the model from the viewer with their own key,
 * and it writes the file they download. Nothing here reads a disk.
 */
const ALLOWED_DEPENDENCIES = new Set(['zod', '@anthropic-ai/sdk', 'yaml']);

const WORKSPACE = /^@seked\/([a-z]+)(?:\/([a-z]+))?$/;
// `import x from 's'`, `export { x } from 's'` and bare `import 's'`, minus the
// type-only forms, which never reach the bundle.
const SPECIFIER = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;]*?from\s*'([^']+)'|(?:^|\n)\s*import\s+'([^']+)'/g;

/** The package a specifier names, scope included. */
function packageOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
}

function specifiersOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(SPECIFIER)) out.push((m[1] ?? m[2]) as string);
  return out;
}

/** The file a specifier names, or undefined when it is a real dependency. */
function fileFor(spec: string, from: string): string | undefined {
  if (spec.startsWith('.')) {
    const base = resolvePath(dirname(from), spec);
    for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) if (existsSync(candidate)) return candidate;
    throw new Error(`${from} imports "${spec}", which is no file`);
  }
  const m = WORKSPACE.exec(spec);
  if (!m) return undefined;
  return join(REPO_ROOT, 'packages', m[1] as string, 'src', `${m[2] ?? 'index'}.ts`);
}

interface Walk {
  files: string[];
  dependencies: Set<string>;
  builtins: string[];
}

function walk(entry: string): Walk {
  const seen = new Set<string>();
  const dependencies = new Set<string>();
  const builtins: string[] = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiersOf(file)) {
      if (spec.startsWith('node:')) builtins.push(`${file} imports ${spec}`);
      const next = fileFor(spec, file);
      if (next) queue.push(next);
      // A scoped package's name is its first two segments, so `@anthropic-ai/sdk`
      // is named whole rather than reported as `@anthropic-ai`.
      else if (!spec.startsWith('node:')) dependencies.add(packageOf(spec));
    }
  }
  return { files: [...seen], dependencies, builtins };
}

describe('the browser entries', () => {
  for (const [name, entry] of Object.entries(ENTRIES)) {
    it(`${name} reaches no node: builtin`, () => {
      expect(existsSync(entry), `${entry} is missing`).toBe(true);
      const found = walk(entry);
      expect(found.files).toContain(entry);
      expect(found.builtins).toEqual([]);
    });

    it(`${name} pulls in nothing but ${[...ALLOWED_DEPENDENCIES].join(', ')}`, () => {
      for (const dep of walk(entry).dependencies) expect(ALLOWED_DEPENDENCIES.has(dep), `unexpected dependency "${dep}"`).toBe(true);
    });
  }

  it('is what the package.json files publish', () => {
    for (const pkg of ['data', 'claims', 'sky']) {
      const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', pkg, 'package.json'), 'utf8')) as {
        exports: Record<string, string>;
      };
      expect(manifest.exports['./browser'], `@seked/${pkg} has no ./browser export`).toBe('./src/browser.ts');
    }
  });
});
