import type { Database } from '@seked/data/browser';
import { resolve, sourceById } from '@seked/data/browser';
import { buildEnvironment } from '@seked/geometry';
import { formatArcminutes, formatArcseconds, formatDms } from '@seked/units';
import { evaluateClaim, type ClaimResult, type ComparisonResult } from './evaluate';
import { GROUPS, type Claim, type Group } from './schema';

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function formatValue(v: number, unit: string): string {
  switch (unit) {
    case 'deg':
      return formatDms(v, 0);
    case 'm':
      if (Math.abs(v) >= 1e6) return `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`;
      return `${v.toLocaleString('en-US', { maximumFractionDigits: 3 })} m`;
    default:
      return trimZeros(v.toPrecision(6));
  }
}

const SIGN = (x: number) => (x < 0 ? '−' : '+');

/** "−2449 (2450 BCE)": the Julian epoch as the claim file writes it, then the calendar year. */
export function formatEpoch(epj: number): string {
  const year = epj < 1 ? `${Math.round(1 - epj)} BCE` : `${Math.round(epj)} CE`;
  return `${epj < 0 ? '−' : ''}${Math.abs(epj)} (${year})`;
}

/** Signed length at a sensible scale: km above 1 km, mm below 1 cm, µm below 1 mm. */
export function formatLength(x: number): string {
  const a = Math.abs(x);
  const n = (v: number, d: number) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  if (a >= 1000) return `${SIGN(x)}${n(a / 1000, 1)} km`;
  if (a >= 0.01) return `${SIGN(x)}${n(a, 2)} m`;
  if (a >= 0.001) return `${SIGN(x)}${n(a * 1000, 2)} mm`;
  return `${SIGN(x)}${n(a * 1e6, 0)} µm`;
}

export function formatResidual(r: ComparisonResult): string {
  const digits = r.unit === 'deg' || Math.abs(r.residualPct) < 0.01 ? 3 : 2;
  const pct = Number.isFinite(r.residualPct) ? `${SIGN(r.residualPct)}${Math.abs(r.residualPct).toFixed(digits)} %` : undefined;
  const withPct = (s: string) => (pct === undefined ? s : `${s} (${pct})`);
  if (r.unit === 'deg') {
    const abs = Math.abs(r.absolute) >= 1
      ? `${r.absolute < 0 ? '−' : ''}${formatDms(Math.abs(r.absolute))}`
      : Math.abs(r.absolute) < 1 / 60 ? formatArcseconds(r.absolute) : formatArcminutes(r.absolute);
    return withPct(abs);
  }
  if (r.unit === 'm') return withPct(formatLength(r.absolute));
  return pct ?? `${SIGN(r.absolute)}${Math.abs(r.absolute)}`;
}

export interface DossierOptions {
  presetId?: string;
  /** Presets to show side by side in the sensitivity table. */
  comparePresets?: string[];
  generatedAt?: Date;
}

export function renderDossier(db: Database, claims: Claim[], opts: DossierOptions = {}): string {
  const presetId = opts.presetId ?? 'canonical';
  const compare = opts.comparePresets ?? db.presets.map((p) => p.id);
  const envs = new Map(compare.map((id) => [id, buildEnvironment(resolve(db, id).values)] as const));
  const env = envs.get(presetId) ?? buildEnvironment(resolve(db, presetId).values);
  const results = new Map(claims.map((c) => [c.id, evaluateClaim(c, env)] as const));
  const date = (opts.generatedAt ?? new Date()).toISOString().slice(0, 10);

  const out: string[] = [];
  out.push('# Seked claims dossier', '');
  out.push(`Generated ${date} from \`data/\` with the **${presetId}** preset. Every number below is computed from the measurement database; nothing is typed in by hand. Residual is (value − target) / target. "Free choices" counts the decisions a claim needs before the numbers line up: a unit, a base line, an epoch, a scale factor.`, '');

  // Summary table
  out.push('## Summary', '');
  out.push('| ID | Claim | Best residual | Worst residual | Within tolerance | Free choices |');
  out.push('|---|---|---:|---:|:---:|:---:|');
  for (const c of claims) {
    const r = results.get(c.id) as ClaimResult;
    if (r.status !== 'computed') {
      out.push(`| ${c.id} | ${c.title} | - | - | pending (${r.status}) | ${r.freeChoices} |`);
      continue;
    }
    const size = (x: ComparisonResult) => (Number.isFinite(x.residualPct) ? Math.abs(x.residualPct) : Number.POSITIVE_INFINITY);
    const sorted = [...r.comparisons].sort((a, b) => size(a) - size(b));
    const best = sorted[0] as ComparisonResult;
    const worst = sorted[sorted.length - 1] as ComparisonResult;
    out.push(`| ${c.id} | ${c.title} | ${formatResidual(best)} | ${formatResidual(worst)} | ${r.fits ? 'yes' : 'no'} | ${r.freeChoices} |`);
  }
  out.push('');

  for (const group of Object.keys(GROUPS) as Group[]) {
    const inGroup = claims.filter((c) => c.group === group);
    if (inGroup.length === 0) continue;
    out.push(`## ${GROUPS[group]}`, '');
    for (const c of inGroup) {
      const r = results.get(c.id) as ClaimResult;
      out.push(`### ${c.id} · ${c.title}`, '');
      out.push(c.summary, '');
      if (c.epoch !== undefined) out.push(`*Evaluated at epoch ${formatEpoch(c.epoch)}.*`, '');
      if (r.status !== 'computed') {
        out.push(`*Not yet computable: ${r.status === 'needs-sky' ? 'waits on the sky engine' : 'waits on the site-plan positions'}.*`, '');
      } else {
        out.push('| Comparison | Formula | Value | Target | Residual | Within |');
        out.push('|---|---|---:|---:|---:|:---:|');
        for (const cr of r.comparisons) {
          out.push(`| ${cr.label} | \`${cr.formula}\` vs \`${cr.target}\` | ${formatValue(cr.value, cr.unit)} | ${formatValue(cr.targetValue, cr.unit)} | ${formatResidual(cr)} | ${cr.within ? 'yes' : 'no'} (${cr.toleranceAbs !== undefined ? `±${formatValue(cr.toleranceAbs, cr.unit)}` : `±${cr.tolerancePct} %`}) |`);
        }
        out.push('');
        if (compare.length > 1) {
          out.push(`Residual by survey preset:`, '');
          out.push(`| Comparison | ${compare.join(' | ')} |`);
          out.push(`|---|${compare.map(() => '---:').join('|')}|`);
          for (const cr of c.comparisons) {
            const cells = compare.map((id) => {
              try {
                const e = envs.get(id) as ReturnType<typeof buildEnvironment>;
                const res = evaluateClaim({ ...c, comparisons: [cr] }, e).comparisons[0] as ComparisonResult;
                return formatResidual(res);
              } catch {
                return '-';
              }
            });
            out.push(`| ${cr.label} | ${cells.join(' | ')} |`);
          }
          out.push('');
        }
      }
      out.push(`**Free choices (${c.free_choices.length})**${c.free_choices.length ? ':' : ': none.'}`);
      for (const f of c.free_choices) out.push(`- ${f}`);
      out.push('');
      if (c.overlay) out.push(`**Overlay:** \`${c.overlay.type}\`${c.overlay.params ? ' ' + JSON.stringify(c.overlay.params) : ''}`, '');
      const cite = (ids: string[]) => ids.map((id) => sourceById(db, id).citation).join(' · ');
      if (c.sources.for.length) out.push(`**Proponents:** ${cite(c.sources.for)}`, '');
      if (c.sources.context.length) out.push(`**Context:** ${cite(c.sources.context)}`, '');
      if (c.sources.against.length) out.push(`**Critiques:** ${cite(c.sources.against)}`, '');
      if (c.notes) out.push(c.notes.trim(), '');
    }
  }

  out.push('## Inputs', '');
  out.push(`Values resolved under the **${presetId}** preset (${db.presets.find((p) => p.id === presetId)?.label}). Unverified records were entered from memory or secondary sources and still need checking against the cited page.`, '');
  const resolved = resolve(db, presetId);
  const used = new Set<string>();
  for (const c of claims) for (const cr of c.comparisons) for (const id of identifiersOf(cr)) used.add(id);
  out.push('| Key | Value | Unit | Source | Method | Verified |');
  out.push('|---|---:|---|---|---|:---:|');
  for (const key of [...used].sort()) {
    const m = resolved.records.get(key);
    if (!m) continue; // derived
    out.push(`| ${key} | ${m.value} | ${m.unit} | ${m.source} | ${m.method ?? ''} | ${m.verified ? 'yes' : 'no'} |`);
  }
  out.push('');
  return out.join('\n');
}

import { identifiers } from './expr';
function identifiersOf(c: { formula: string; target: string }): string[] {
  return [...new Set([...identifiers(c.formula), ...identifiers(c.target)])];
}
