/**
 * Solve claim C2 numerically: for each shaft, the epoch at which its named
 * star crossed the meridian at the shaft's altitude, and how sensitive that
 * epoch is to the measured angle. Writes docs/shafts.md.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import { formatDms } from '@seked/units';
import { loadNamedStars, lowerCulminationAltitude, positionAtEpoch, starById, transitAltitude, transitIsNorth } from '@seked/sky';

const db = loadDatabase();
const { values, records } = resolve(db, 'canonical');
const stars = loadNamedStars();
const lat = values['g1.center.latitude'] as number;

const SHAFTS = [
  { key: 'kc.shaft.south.angle', label: "King's Chamber south", star: 'alnitak', side: 'south' },
  { key: 'kc.shaft.north.angle', label: "King's Chamber north", star: 'thuban', side: 'north' },
  { key: 'qc.shaft.south.angle', label: "Queen's Chamber south", star: 'sirius', side: 'south' },
  { key: 'qc.shaft.north.angle', label: "Queen's Chamber north", star: 'kochab', side: 'north' },
] as const;

type Culmination = 'upper' | 'lower';

/** Altitude on the meridian on the given side of the zenith, or undefined when the star is on the other side. */
function meridianAltitude(decDeg: number, side: 'north' | 'south', culmination: Culmination): number | undefined {
  if (culmination === 'lower') return side === 'north' ? lowerCulminationAltitude(decDeg, lat) : undefined;
  const north = transitIsNorth(decDeg, lat);
  if ((side === 'north') !== north) return undefined;
  return transitAltitude(decDeg, lat);
}

interface Solution { epoch: number; culmination: Culmination; yearsPerArcminute: number }

function solve(starId: string, side: 'north' | 'south', angle: number, from = -6000, to = 0): Solution[] {
  const star = starById(stars, starId);
  const out: Solution[] = [];
  for (const culmination of ['upper', 'lower'] as Culmination[]) {
    let prev: number | undefined;
    for (let epoch = from; epoch <= to; epoch++) {
      const alt = meridianAltitude(positionAtEpoch(star, epoch).decDeg, side, culmination);
      const f = alt === undefined ? undefined : alt - angle;
      if (prev !== undefined && f !== undefined && Math.sign(prev) !== Math.sign(f)) {
        const root = epoch - 1 + prev / (prev - f); // linear interpolation between the two years
        const slope = (f - prev) * 60; // arcminutes per year
        out.push({ epoch: root, culmination, yearsPerArcminute: 1 / Math.abs(slope) });
      }
      prev = f;
    }
  }
  return out;
}

const fmtEpoch = (e: number) => (e < 1 ? `${Math.round(1 - e)} BCE` : `${Math.round(e)} CE`);

const lines: string[] = [];
lines.push('# Shaft alignments (claim C2)', '');
lines.push(`For each shaft, the epoch at which the named star crossed the meridian at the shaft's measured altitude, from latitude ${formatDms(lat)} N, using Vondrák 2011 precession and linear proper motion. "Years per arcminute" is how far the solved date moves if the measured shaft angle changes by 1′. Shaft angles are unverified Gantenbrink values; see data/measurements/g1.json.`, '');
lines.push('| Shaft | Angle | Star | Culmination | Epoch | Years per 1′ of shaft angle |');
lines.push('|---|---:|---|---|---:|---:|');
for (const s of SHAFTS) {
  const angle = values[s.key] as number;
  const src = records.get(s.key)?.source ?? '?';
  const sols = solve(s.star, s.side, angle);
  const star = starById(stars, s.star);
  if (sols.length === 0) {
    lines.push(`| ${s.label} | ${formatDms(angle)} (${src}) | ${star.name} | — | no solution 6000 BCE – 1 CE | — |`);
    console.log(`${s.label.padEnd(24)} ${formatDms(angle)}  ${star.name.padEnd(8)} no solution between 6000 BCE and 1 CE`);
    continue;
  }
  for (const sol of sols) {
    lines.push(`| ${s.label} | ${formatDms(angle)} (${src}) | ${star.name} | ${sol.culmination} | ${fmtEpoch(sol.epoch)} | ${sol.yearsPerArcminute.toFixed(1)} |`);
    console.log(`${s.label.padEnd(24)} ${formatDms(angle)}  ${star.name.padEnd(8)} ${sol.culmination.padEnd(6)} ${fmtEpoch(sol.epoch).padStart(9)}   ${sol.yearsPerArcminute.toFixed(1)} yr/′`);
  }
}
lines.push('', 'Bauval & Gilbert (1994) date all four to about 2450 BCE. A shaft whose solved epoch moves by decades per arcminute cannot date the pyramid to better than a century or two from its angle alone.', '');
const out = join(REPO_ROOT, 'docs', 'shafts.md');
writeFileSync(out, lines.join('\n'));
console.log(`\nwrote ${out}`);
