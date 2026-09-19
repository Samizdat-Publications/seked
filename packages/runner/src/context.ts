/**
 * What the model is told before it is shown anybody's prose: the expression
 * language it must write in, every identifier that language can name, the
 * groups, the overlay types the viewer draws, the sources a claim may cite,
 * and six filed claims as worked examples.
 *
 * Nothing here is typed twice. The keys are read out of the bundle the viewer
 * already loaded, the units off the records that carry them, the groups off
 * `@seked/claims`, the overlay types and their parameters off the filed
 * claims themselves, and the worked examples are those claims rendered back
 * into the YAML they came from. What is authored here is prose: a description
 * of the grammar, the rules, and one sentence per worked example saying what a
 * proponent of it would have said out loud.
 *
 * The one place the model's material is stated rather than read is the list of
 * functions, which `packages/claims/src/expr.ts` keeps private. A test
 * evaluates every function this file names, so a function that goes away takes
 * the test with it rather than quietly going stale in a prompt.
 */
import {
  CONSTANTS,
  GROUPS,
  ClaimSchema,
  scopeFor,
  type Claim,
  type Group,
} from '@seked/claims/browser';
import {
  resolve,
  type Database,
  type Material,
  type Measurement,
  type Preset,
  type Site,
  type Source,
  type Structure,
} from '@seked/data/browser';
import { buildEnvironment, type Environment } from '@seked/geometry';
import { claimFileOf, claimToYaml } from './claim-file';

/**
 * The part of the viewer's bundle the runner needs. `SekedBundle` satisfies it,
 * which is how track U calls this in the browser without the runner reaching
 * back into the app, and so does a database plus the loaded claims in Node.
 */
export interface RunnerBundle {
  sources: Source[];
  sites: Site[];
  structures: Structure[];
  presets: Preset[];
  measurements: Measurement[];
  claims: Claim[];
  /**
   * What the buildings are made of. The runner never reads it: a claim is a
   * formula over measured numbers and there is no number in a material. It is
   * here so a whole bundle satisfies this type, and so `databaseOf` can hand
   * the resolver a database rather than a database minus one field.
   */
  materials?: Material[];
}

/** One identifier a formula may name, and what the number behind it is. */
export interface KeyListing {
  key: string;
  /**
   * `measured` when a record in `data/measurements/` carries it, `derived`
   * when `buildEnvironment` computes it from records, and `sky` when it only
   * exists for a claim that declares an epoch.
   */
  kind: 'measured' | 'derived' | 'sky';
  /** A label for the prompt: `m`, `deg`, `ratio`, `m2`, `julian year`, and so on. Nothing multiplies by it. */
  unit: string;
  /** The family the key is listed under: its first dotted segment, or `star.<name>` for a star. */
  family: string;
}

/** An overlay type the viewer can draw, as the filed claims use it. */
export interface OverlayListing {
  type: string;
  /** Every parameter name seen on a claim of this type, in first-seen order. */
  params: string[];
  /** The claims that draw with it. */
  claims: string[];
}

/** A filed claim shown to the model, with the words a proponent of it would have used. */
export interface WorkedExample {
  id: string;
  /** Authored: what somebody who believes the claim would say, in their own kind of words. */
  prose: string;
  /** The filed claim rendered back into YAML. */
  yaml: string;
}

export interface RunnerContext {
  /** The preset the environment was resolved under. */
  presetId: string;
  /** The measured and derived keys, with no sky in them. A claim without an epoch sees exactly this. */
  env: Environment;
  /** The keys a claim with an epoch additionally gets, from that epoch's sky. Their names do not depend on the epoch. */
  skyKeys: string[];
  /** Every key of both kinds, with its unit. */
  keys: KeyListing[];
  /** The overlay types, read off the filed claims. */
  overlays: OverlayListing[];
  /** Every source id a claim may cite. */
  sourceIds: string[];
  /** Every claim id already taken, so a proposal can be numbered against them. */
  claimIds: string[];
  examples: WorkedExample[];
  /** The system prompt. */
  system: string;
}

export interface RunnerContextOptions {
  /** Which survey preset the numbers are resolved under. Default `canonical`, as the dossier's. */
  presetId?: string;
  /** Which filed claims are shown as worked examples. Default A1, A3, B1, C2, D1, D3. */
  exampleIds?: string[];
}

/**
 * The six filed claims the prompt works through, and the words a proponent of
 * each would have said. These sentences are paraphrases in the proponent's kind
 * of voice, not quotations, and they exist so the model can see the whole
 * journey from how a claim is spoken to how it is filed.
 */
const EXAMPLE_PROSE: Record<string, string> = {
  A1: 'Walk the base of the Great Pyramid and divide what you walked by its height, and you get two pi. They built the circle into the stone.',
  A3: 'The slope of the Great Pyramid is a seked of five and a half palms to the cubit, which is how an Egyptian mason would have set it out, and it happens to sit within a couple of arcminutes of both the pi pyramid and the phi pyramid, so the angle on its own cannot tell you which.',
  B1: 'The Great Pyramid is a scale model of the northern hemisphere at one to forty-three thousand two hundred. Take its height, multiply by 43,200, and you have the polar radius; take its base perimeter, multiply by the same number, and you have the equatorial circumference.',
  C2: 'Around 2450 BCE the four shafts of the Great Pyramid pointed at four stars as they crossed the meridian: the King\'s Chamber south shaft at Alnitak in Orion\'s belt, its north shaft at Thuban, the Queen\'s Chamber south shaft at Sirius and its north shaft at Kochab.',
  D1: 'Draw a line through the south-east corners of all three Giza pyramids and extend it north-east. It runs at forty-five degrees and it points straight at the obelisk of Heliopolis, twenty-odd kilometres away.',
  D3: 'The Great Pyramid was placed as the geodetic centre of Egypt. Its meridian bisects the Nile Delta, and its own base diagonals, run out north-east and north-west, open into a quadrant that encloses the whole Delta coast.',
};

const DEFAULT_EXAMPLE_IDS = Object.keys(EXAMPLE_PROSE);

/**
 * The unit of a key the environment computes rather than records. Each pattern
 * names a quantity `buildEnvironment` or `skyEnvironment` writes; a key that
 * matches nothing here is reported as `unknown`, and a test says there are
 * none, so a new derived key cannot slip into the prompt unlabelled.
 */
const COMPUTED_UNITS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\.(base\.area|face\.area|lateral\.area|height\.squared)$/, 'm2'],
  [/\.volume$/, 'm3'],
  [/\.(base\.half|base\.perimeter|apothem|arris\.length)$/, 'm'],
  [/\.base\.socket\.perimeter$/, 'm'],
  [/\.centre\.offset\.(east|north)$/, 'm'],
  [/\.(face\.angle\.derived|arris\.angle)$/, 'deg'],
  [/^sky\.epoch$/, 'julian year'],
  [/\.transit\.north$/, 'flag, 1 or 0'],
  [/\.(ra|dec|obliquity)$/, 'deg'],
  [/\.(transit|lower)\.altitude$/, 'deg'],
  [/\.(rise|set)\.azimuth$/, 'deg'],
  [/\.(rise|set)\.lst$/, 'deg of sidereal time'],
  [/\.jd$/, 'julian day'],
  [/\.equation_of_time$/, 'minutes'],
  [/\.(rise|set)\.local_mean_time$/, 'hours'],
];

/**
 * The functions of the expression language, as `packages/claims/src/expr.ts`
 * defines them. Trigonometry is in degrees both ways. A test evaluates every
 * one of these, so the list cannot outlive the language.
 */
export const FUNCTION_NAMES = [
  'sqrt',
  'abs',
  'ln',
  'log10',
  'exp',
  'floor',
  'round',
  'min',
  'max',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'hypot',
] as const;

function computedUnit(key: string): string {
  for (const [pattern, unit] of COMPUTED_UNITS) if (pattern.test(key)) return unit;
  return 'unknown';
}

/** The heading a key is listed under: `star.thuban` for a star, the first segment otherwise. */
function familyOf(key: string): string {
  const segments = key.split('.');
  if (segments[0] === 'star' && segments.length > 1) return `star.${segments[1]}`;
  return segments[0] as string;
}

function databaseOf(bundle: RunnerBundle): Database {
  const { sources, sites, structures, measurements, presets } = bundle;
  return { sources, sites, structures, measurements, presets, materials: bundle.materials ?? [] };
}

/**
 * The keys a dated claim gets on top of the base environment. Their names do
 * not depend on which epoch is asked for, so any one of the bundle's dated
 * claims answers for all of them; a bundle with no dated claim has no sky, and
 * the prompt says so rather than inventing an epoch to conjure one.
 */
function skyKeysOf(bundle: RunnerBundle, env: Environment): string[] {
  const dated = bundle.claims.find((c) => c.epoch !== undefined);
  if (!dated) return [];
  return Object.keys(scopeFor(dated, env)).filter((key) => !(key in env));
}

function overlaysOf(claims: Claim[]): OverlayListing[] {
  const found = new Map<string, OverlayListing>();
  for (const claim of claims) {
    if (!claim.overlay) continue;
    let listing = found.get(claim.overlay.type);
    if (!listing) {
      listing = { type: claim.overlay.type, params: [], claims: [] };
      found.set(claim.overlay.type, listing);
    }
    listing.claims.push(claim.id);
    for (const name of Object.keys(claim.overlay.params ?? {})) {
      if (!listing.params.includes(name)) listing.params.push(name);
    }
  }
  return [...found.values()].sort((a, b) => a.type.localeCompare(b.type));
}

/** Wrap a comma-separated list so the prompt has no thousand-character lines. */
function wrap(items: string[], width = 96): string[] {
  const lines: string[] = [];
  let line = '';
  for (const item of items) {
    const next = line === '' ? item : `${line}, ${item}`;
    if (next.length > width && line !== '') {
      lines.push(`${line},`);
      line = item;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function renderKeys(keys: KeyListing[], structures: Structure[]): string[] {
  const names = new Map(structures.map((s) => [s.id, s.name] as const));
  const byFamily = new Map<string, KeyListing[]>();
  for (const listing of keys) {
    const bucket = byFamily.get(listing.family);
    if (bucket) bucket.push(listing);
    else byFamily.set(listing.family, [listing]);
  }
  const out: string[] = [];
  for (const [family, listings] of byFamily) {
    const name = names.get(family);
    out.push('', `### ${family}${name ? ` (${name})` : ''}`);
    const byUnit = new Map<string, string[]>();
    for (const listing of listings) {
      const bucket = byUnit.get(listing.unit);
      if (bucket) bucket.push(listing.key);
      else byUnit.set(listing.unit, [listing.key]);
    }
    for (const [unit, group] of byUnit) {
      out.push(`${unit}:`);
      out.push(...wrap(group));
    }
  }
  return out;
}

function renderSystem(parts: Omit<RunnerContext, 'system'>, bundle: RunnerBundle): string {
  const defaults = ClaimSchema.parse({ id: 'P0', title: '', group: 'proportion', summary: '', status: 'needs-sky' });
  const cite = new Map(bundle.sources.map((s) => [s.id, s.citation] as const));
  const out: string[] = [];

  out.push(
    '# What you are doing',
    '',
    "Somebody has said something about the pyramids of Giza. Turn their words into a claim file: a title, a group, a summary, one or more comparisons between a formula and a target, a tolerance, the free choices the claim needs before its numbers line up, the sources that argue it, and an overlay for the viewer to draw.",
    '',
    'You do not decide whether the claim is true, and you never argue for it or against it. This project has a survey database of the plateau and an evaluator that computes both sides of every comparison from it and says how far apart they are. Your only job is to state the claim exactly, in terms of numbers that already exist, so that the evaluator can grade it. State the claim as its proponent makes it, including the choices it needs; the grading is somebody else\'s.',
    '',
    '# Rules you cannot break',
    '',
    '- Never invent an identifier. Every name in a formula or in a target must appear in the key list below, or be one of the constants of the expression language.',
    '- Never compute a number. Write the arithmetic out as a formula and let the evaluator do it: `g1.base.perimeter / g1.height.original`, never the quotient.',
    "- Never put a measurement in a target when a key holds it. A target is an expression like any other, so `earth.radius.polar` is right and a figure in metres is wrong. A bare number belongs in a target only when the claim itself names that number: `2 * pi`, `atan(7 / 5.5)`, `45`.",
    '- A key list is a list of what exists, not of what is relevant. If the claim needs a number this database does not carry, say so in `notes` and set `status` to `needs-site`, rather than reaching for a key that is nearly what you wanted.',
    '- Name a `star.` or a `sun.` key only in a claim that declares an `epoch`. Those keys do not exist without one.',
    '- Cite only source ids from the list below. A claim with no source for it, no context and no critique is allowed; an invented id is not.',
    // A proposal can be moved into data/claims/ by hand, so it is held to
    // the project's own writing rules from the moment it is written.
    '- Never use an em dash, in a title, a summary, a label, a free choice or a note. Use a comma, a colon, a full stop or a spaced hyphen. This project forbids them everywhere and a claim file is no exception.',
    '',
    '# The expression language',
    '',
    'Formulas and targets are both expressions in one small language. There is no assignment, no comparison, no conditional and no string.',
    '',
    '- An identifier is a dotted lower-case name: `g1.base.perimeter`, `star.thuban.transit.altitude`. It resolves against the environment, which is the key list below.',
    '- A number is a decimal literal, with an optional exponent: `43200`, `5.5`, `1.2e3`.',
    '- The operators are `+`, `-`, `*`, `/` and `^`. `^` binds tightest and is right-associative, then unary minus, then `*` and `/`, then `+` and `-`. Brackets group.',
    `- The functions are ${FUNCTION_NAMES.join(', ')}. \`min\`, \`max\` and \`hypot\` take any number of arguments, \`atan2\` takes two, the rest take one.`,
    '- Trigonometry is in degrees in both directions: `sin`, `cos` and `tan` take degrees, and `asin`, `acos`, `atan` and `atan2` return degrees. There is no radian anywhere in this project.',
    `- The constants are ${Object.keys(CONSTANTS).join(', ')}. They need no key.`,
    '',
    'So `atan(4 / pi)` is the angle of the pi pyramid in degrees, `sqrt((kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2)` is a diagonal in royal cubits, and `g1.base.perimeter * 43200` is a length in metres.',
    '',
    '# Units',
    '',
    'Every number in the environment is in metres and degrees. A comparison declares the unit its own two sides come out in, which is one of:',
    '',
    '- `ratio`, the default, for a quantity with no unit, such as a perimeter over a height.',
    '- `m` for a length and `deg` for an angle, which is what almost every key is in.',
    '- `rc` for royal cubits and `in` for pyramid inches. These are claim units only: the environment holds no royal cubits, so a comparison in `rc` divides a length in metres by `cubit.royal` on both sides and the unit is a label for how the residual is printed.',
    '',
    'The unit never converts anything. Both sides of a comparison must already be in the same thing.',
    '',
    '# Tolerance',
    '',
    `- \`tolerance_pct\` is a percentage of the target and defaults to ${defaults.tolerance_pct}. Set it on the claim, or per comparison where one part of a claim is stated more tightly than another.`,
    '- `tolerance_abs` is an absolute tolerance in the comparison\'s own unit, and is what a target of zero needs, because a percentage of zero says nothing. Use it also where the claim is stated as an absolute band, such as a longitude within a twentieth of a degree.',
    '- Set the tolerance to what the claim itself asserts, not to whatever would make it pass. A claim stated loosely gets a loose tolerance and is graded loosely; that is honest, and the free choices are where the looseness is recorded.',
    '',
    '# Free choices',
    '',
    'A free choice is a decision the claim has to make before its numbers line up, and every one of them is a degree of freedom that makes a fit easier to come by. The scale factor 43,200. Which corners define a diagonal. Which star is assigned to which shaft. Which epoch. Which of the Earth\'s several radii. Write each one down as a short phrase. A claim with no free choices has an empty list, and that is a strong claim.',
    '',
    '# Groups',
    '',
  );
  for (const group of Object.keys(GROUPS) as Group[]) out.push(`- \`${group}\`: ${GROUPS[group]}`);
  out.push(
    '',
    '# Status',
    '',
    '- `computed` when every comparison can be evaluated from the keys below. This is almost always the answer.',
    '- `needs-sky` when the claim is about the sky in a way the sky engine does not reach.',
    '- `needs-site` when the claim needs a position or a structure the survey database does not carry.',
    '',
    'A claim that is not `computed` carries no comparisons, so use it only when the numbers genuinely are not there.',
    '',
    '# Overlays',
    '',
    'The viewer draws one overlay per claim. Pick the type that fits; `panel` is the fallback for a claim with nothing to draw in the scene. The parameters are those the filed claims use, and a parameter\'s value may itself be an expression in the language above.',
    '',
  );
  for (const overlay of parts.overlays) {
    out.push(
      `- \`${overlay.type}\`: parameters ${overlay.params.length ? overlay.params.map((p) => `\`${p}\``).join(', ') : 'none'}. Drawn by ${overlay.claims.join(', ')}.`,
    );
  }
  out.push(
    '',
    '# Sources',
    '',
    'A claim cites source ids under `for` (who argues it), `context` (who supplies the numbers or the background) and `against` (who argues it down). Use only these ids.',
    '',
  );
  for (const id of parts.sourceIds) out.push(`- \`${id}\`: ${cite.get(id) ?? ''}`);
  out.push(
    '',
    '# The keys',
    '',
    `Every identifier the environment holds, under the ${parts.presetId} preset, grouped by what it belongs to and by its unit. A key marked \`sky\` below exists only for a claim with an \`epoch\`.`,
  );
  out.push(...renderKeys(parts.keys.filter((k) => k.kind !== 'sky'), bundle.structures));
  const sky = parts.keys.filter((k) => k.kind === 'sky');
  if (sky.length) {
    out.push(
      '',
      '## The sky keys',
      '',
      'These exist only inside a claim that declares an `epoch`, and they are computed at that epoch. The epoch is a Julian year in astronomical numbering, so 2450 BCE is `-2449` and 10,450 BCE is `-10449`.',
    );
    out.push(...renderKeys(sky, bundle.structures));
  }
  out.push('', '# Six filed claims, and what somebody said to get them', '');
  for (const example of parts.examples) {
    out.push(`## ${example.id}`, '', 'Somebody said:', '', `> ${example.prose}`, '', 'Which is filed as:', '', '```yaml', example.yaml.trimEnd(), '```', '');
  }
  out.push(
    '# What to answer with',
    '',
    'One claim, in the fields you are given. You do not write the id, the origin or the prose; those are filled in for you. Write the comparisons out as a list even when there is only one. Put in `notes` anything a reader needs in order to judge what you filed: which reading of an ambiguous sentence you took, a number the claim names that no key carries, a step you had to choose. Keep the summary to a sentence or two that says what is being compared with what.',
  );
  return out.join('\n');
}

/**
 * Everything the model is given, built from the bundle the viewer already has.
 * Building it reads nothing from disk, so the browser and the CLI build the
 * same context from the same bytes.
 */
export function runnerContext(bundle: RunnerBundle, options: RunnerContextOptions = {}): RunnerContext {
  const presetId = options.presetId ?? 'canonical';
  const resolved = resolve(databaseOf(bundle), presetId);
  const env = buildEnvironment(resolved.values);
  const skyKeys = skyKeysOf(bundle, env);

  // Numeric collation so the Great Pyramid's 201 course heights read 1, 2, 3
  // rather than 1, 10, 100, which is the same set in a less useful order.
  const byName = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });

  const keys: KeyListing[] = [];
  for (const key of Object.keys(env).sort(byName)) {
    const record = resolved.records.get(key);
    keys.push({
      key,
      kind: record ? 'measured' : 'derived',
      unit: record ? record.unit : computedUnit(key),
      family: familyOf(key),
    });
  }
  for (const key of [...skyKeys].sort(byName)) {
    keys.push({ key, kind: 'sky', unit: computedUnit(key), family: familyOf(key) });
  }

  const exampleIds = options.exampleIds ?? DEFAULT_EXAMPLE_IDS;
  const examples: WorkedExample[] = [];
  for (const id of exampleIds) {
    const claim = bundle.claims.find((c) => c.id === id);
    const prose = EXAMPLE_PROSE[id];
    if (!claim || !prose) continue;
    examples.push({ id, prose, yaml: claimToYaml(claimFileOf(claim)) });
  }

  const parts: Omit<RunnerContext, 'system'> = {
    presetId,
    env,
    skyKeys,
    keys,
    overlays: overlaysOf(bundle.claims),
    sourceIds: bundle.sources.map((s) => s.id),
    claimIds: bundle.claims.map((c) => c.id),
    examples,
  };
  return { ...parts, system: renderSystem(parts, bundle) };
}
