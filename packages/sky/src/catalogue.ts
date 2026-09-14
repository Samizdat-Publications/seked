/**
 * The named stars on disk. This is the only module in the package that reads
 * a file, which is why it is not part of the browser entry: importing
 * `@seked/sky` registers it as the default catalogue for `skyEnvironment`,
 * and a browser registers its own with `setDefaultStars`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from '@seked/data';
import { setDefaultStarsLoader } from './environment';
import { StarSchema, type Star } from './stars';

export function loadNamedStars(path = join(DATA_DIR, 'stars', 'named.json')): Star[] {
  return z.array(StarSchema).parse(JSON.parse(readFileSync(path, 'utf8')));
}

// Lazily, so importing the package still costs nothing until a claim wants a star.
setDefaultStarsLoader(() => loadNamedStars());
