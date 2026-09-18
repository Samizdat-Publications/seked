import { comparisonSize, formatResidual, formatValue, identifiers, type Claim, type ComparisonResult } from '@seked/claims/browser';
import { sourceById, type Measurement, type Source } from '@seked/data/browser';
import { recordsBehind } from '@seked/geometry';
import { formatArcminutes, formatDms } from '@seked/units';
import { useMemo } from 'react';
import { recordsFor, type FailedClaim, type Model } from '../model';
import { cornerMissWords, overlayNote, overlaySpec, parallelOffsetWords, type OverlayContext, type OverlaySpec } from '../overlays';
import { useView } from '../store';
import { Residuals } from './Residuals';
import { yearWords } from '../ui/moment';
import { Fit } from './Claims';

/**
 * One claim in full, read top down: the words it was proposed from where it
 * was proposed, what it compares and how far off each comparison is, what it
 * had to assume, when it is stated for, what it draws, who says so, and which
 * records the numbers came from. The formatters are the dossier's, so the
 * panel and docs/dossier.md read alike.
 */
export function ClaimDetail({
  claim,
  result,
  model,
  context,
}: {
  claim: Claim;
  result: FailedClaim;
  model: Model;
  context: OverlayContext;
}): React.JSX.Element {
  const overlay = overlayNote(claim, context);
  const drawn = overlaySpec(claim, context);
  const records = useMemo(() => {
    const keys = new Set<string>();
    for (const c of claim.comparisons)
      for (const id of [...identifiers(c.formula), ...identifiers(c.target)]) {
        keys.add(id);
        // A formula mostly names derived keys, and a derived key is not a
        // record. The provenance the reader wants is the measurements under
        // it, which is the same expansion the dossier's key table makes.
        for (const behind of recordsBehind(id, model.resolved.values)) keys.add(behind);
      }
    return recordsFor([...keys].sort(), model.resolved);
  }, [claim, model.resolved]);
  // The claim's worst comparison is the one it is graded by, so the table
  // marks it. With one comparison there is nothing to rank and no mark.
  const worst = useMemo(() => worstIndex(result.comparisons), [result.comparisons]);

  return (
    <article className="detail">
      {claim.origin === 'proposed' && claim.prose !== undefined && (
        <blockquote className="prose">{`“${claim.prose}”`}</blockquote>
      )}

      <header className="detail-head">
        <h3>
          {claim.id} · {claim.title} <Fit result={result} />
        </h3>
        <p className="note">{claim.summary}</p>
      </header>

      {result.error && <p className="warning">This preset cannot evaluate the claim: {result.error}</p>}

      {result.comparisons.length > 0 && <Residuals comparisons={result.comparisons} worstIndex={worst} />}
      {result.comparisons.length > 0 && <Comparisons comparisons={result.comparisons} worst={worst} />}

      {result.comparisons.length === 0 && !result.error && (
        <p className="note">Not computable yet: it {result.status === 'needs-sky' ? 'waits on the sky engine' : 'waits on the site-plan positions'}.</p>
      )}

      <h4>What it assumes ({claim.free_choices.length})</h4>
      {claim.free_choices.length === 0 ? (
        <p className="note">Nothing. The claim costs no free choice to state.</p>
      ) : (
        <ul className="assumed">
          {claim.free_choices.map((f) => (
            <li key={f}>
              <span className="assumed-word">assumed</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {claim.epoch !== undefined && (
        <>
          <h4>Epoch</h4>
          <EpochLine claim={claim} model={model} />
        </>
      )}

      <h4>Overlay</h4>
      <p className={overlay.built ? 'note' : 'note pending'}>{overlay.text}</p>
      {drawn && <OverlayButton />}
      {drawn && <OverlayControls overlay={drawn} model={model} />}

      {claim.notes && (
        <>
          <h4>Notes</h4>
          <p className="note">{claim.notes}</p>
        </>
      )}

      <h4>Sources</h4>
      <Citations label="Proponents" ids={claim.sources.for} model={model} />
      <Citations label="Context" ids={claim.sources.context} model={model} />
      <Citations label="Critiques" ids={claim.sources.against} model={model} />

      {records.length > 0 && (
        <>
          <h4>Records</h4>
          <ul className="inputs">
            {records.map((m) => (
              <Record key={m.key} record={m} model={model} />
            ))}
          </ul>
        </>
      )}

      {claim.origin === 'proposed' && <MoveNote claim={claim} />}
    </article>
  );
}

/** A residual in percent, signed and spaced the way the dossier signs one. */
const percent = (v: number, digits = 3): string => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(digits)} %`;

/**
 * Which comparison a claim is graded by, as an index into the list the panel
 * prints, or -1 when there is nothing to rank. The measure is the evaluator's
 * own, so the one marked here is the one the list's grade came from.
 */
export function worstIndex(comparisons: ComparisonResult[]): number {
  if (comparisons.length < 2) return -1;
  let at = 0;
  for (let i = 1; i < comparisons.length; i += 1) {
    if (comparisonSize(comparisons[i] as ComparisonResult) > comparisonSize(comparisons[at] as ComparisonResult)) at = i;
  }
  return at;
}

/**
 * The comparisons as one table: a name row carrying the label, the mark on the
 * worst and the verdict against the tolerance, then the three figures under
 * the heads they belong to. Three columns and not four, because the formula
 * is longer than the rest of the row put together and reads better over the
 * numbers it made than squeezed beside them.
 */
function Comparisons({ comparisons, worst }: { comparisons: ComparisonResult[]; worst: number }): React.JSX.Element {
  return (
    <table className="comparisons">
      <colgroup>
        <col className="value" />
        <col className="target" />
        <col className="residual" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Value</th>
          <th scope="col">Target</th>
          <th scope="col">Residual</th>
        </tr>
      </thead>
      {comparisons.map((c, i) => {
        const tolerance = c.toleranceAbs !== undefined ? `±${formatValue(c.toleranceAbs, c.unit)}` : `±${c.tolerancePct} %`;
        return (
          <tbody key={`${c.label}-${i}`} className={`comparison${i === worst ? ' is-worst' : ''}`}>
            <tr className="comparison-name">
              <th colSpan={3} scope="colgroup">
                <span className="comparison-label">
                  {c.label}
                  {i === worst && <span className="worst-mark">worst</span>}
                </span>
                <span className={`verdict ${c.within ? 'is-within' : 'is-outside'}`}>
                  {c.within ? `within ${tolerance}` : `outside ${tolerance}`}
                </span>
                <code className="formula">
                  {c.formula} vs {c.target}
                </code>
              </th>
            </tr>
            <tr className="comparison-figures">
              <td>{formatValue(c.value, c.unit)}</td>
              <td>{formatValue(c.targetValue, c.unit)}</td>
              <td className={c.within ? '' : 'is-outside'}>{formatResidual(c)}</td>
            </tr>
          </tbody>
        );
      })}
    </table>
  );
}

/**
 * A source in the few words a reader needs to tell it from the others: the
 * names and the year out of the citation it is already written with, so
 * nothing about a source is typed twice. A citation that does not begin with
 * names and a year, which is most of the datum and coordinate entries, gives
 * its first clause instead, cut short. The whole citation is on the title.
 */
export function shortTitle(source: Source): string {
  const dated = /^(.*?)\s*\((\d{4})[^)]*\)/.exec(source.citation);
  if (dated) {
    const names = surnames(dated[1] as string);
    if (names !== '') return `${clip(names, 40)} ${dated[2] as string}`;
  }
  return clip(firstClause(source.citation));
}

/**
 * The surnames out of "Petrie, W. M. F." or "Lehner, M. & Hawass, Z." or
 * "Morishima, K. et al." A citation that opens on a sentence rather than on
 * names, and there are a few, runs past the six words any list of surnames
 * needs and gives nothing back, so that nobody is credited with a co-author
 * they do not have.
 */
function surnames(authors: string): string {
  const bare = authors
    .replace(/\b[A-Z]\.(\s*-?\s*[A-Z]\.)*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (bare.split(' ').length > 6) return '';
  const etAl = /\bet al\.?/i.test(bare);
  const names = bare
    .replace(/\bet al\.?/gi, '')
    .split(/\s*(?:,|&|\band\b)\s*/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (names.length === 0) return '';
  if (etAl || names.length > 2) return `${names[0] as string} et al.`;
  return names.join(' & ');
}

/** The citation up to its first full stop, colon, bracket or comma. */
function firstClause(citation: string): string {
  const cut = /[.:(,](?=\s|$)/.exec(citation);
  return (cut === null ? citation : citation.slice(0, cut.index)).trim();
}

const clip = (s: string, at = 46): string => (s.length <= at ? s : `${s.slice(0, s.lastIndexOf(' ', at)).trim()}…`);

/**
 * The methods that say no more than "this figure was copied from the page it
 * is cited to". A record with one of these is a transcription, and the panel
 * leaves the word out rather than printing a column of it; anything else, a
 * tape run, a total station, a scaling off a plate, an estimate, is how the
 * number was got and the reader should see it.
 */
const TRANSCRIBED = new Set(['tabulated', 'published-plan', 'printed on the plate', 'stated in the text', 'course-table']);

/** A record's method, or nothing where the method is a transcription. */
export function methodWords(method: string | undefined): string | undefined {
  if (method === undefined || TRANSCRIBED.has(method)) return undefined;
  return method;
}

/** One record behind a claim's numbers: what it says, who says it, how, and whether anyone has checked. */
function Record({ record, model }: { record: Measurement; model: Model }): React.JSX.Element {
  const method = methodWords(record.method);
  return (
    <li>
      <code>{record.key}</code>
      <span className="value">
        {record.value} {record.unit}
      </span>
      <span className="note">
        {sourceWords(model, record.source)}
        {method === undefined ? '' : `, ${method}`}
        <span
          className={`flag ${record.verified ? 'is-verified' : 'is-unverified'}`}
          title={record.verified ? 'checked against the cited page' : 'not yet checked against the cited page'}
        >
          {record.verified ? '✓' : '?'}
        </span>
      </span>
    </li>
  );
}

/** The short title of a source, or its id when the database has lost it. */
function sourceWords(model: Model, id: string): string {
  try {
    return shortTitle(sourceById(model.db, id));
  } catch {
    return id;
  }
}

/** The whole citation, for the title attribute, or the id when the database has lost it. */
function citationOf(model: Model, id: string): string {
  try {
    return sourceById(model.db, id).citation;
  } catch {
    return id;
  }
}

function Citations({ label, ids, model }: { label: string; ids: string[]; model: Model }): React.JSX.Element | null {
  if (ids.length === 0) return null;
  return (
    <p className="note citations">
      <span className="citations-label">{label}</span>
      {ids.map((id) => (
        <span key={id} className="cite" title={citationOf(model, id)}>
          {sourceWords(model, id)}
        </span>
      ))}
    </p>
  );
}

/**
 * What to do with a claim the model wrote. Nothing has written it anywhere:
 * it is in this session's memory and goes when the tab does. `data/claims/`
 * holds only what a person has read against the sources it names, so the
 * panel says how to file it and there is no button that files it.
 */
function MoveNote({ claim }: { claim: Claim }): React.JSX.Element {
  return (
    <div className="move-note">
      <h4>Move into data/claims</h4>
      <p className="note">
        This claim was proposed, not filed, and nothing has written it to disk. To keep it: save it as{' '}
        <code>data/claims/{claim.id}.yaml</code>, read every number and every source in it against the pages it cites, drop the{' '}
        <code>origin</code> and <code>prose</code> lines, give it an id in its group's own series, and run <code>pnpm bundle</code>. The
        dossier never prints a proposed claim.
      </p>
    </div>
  );
}

/**
 * Whether the claim's overlay is drawn on the plateau. The layer is the
 * scene's and the reader may want the geometry without it, so the detail
 * carries the switch beside the description of what it would draw.
 */
function OverlayButton(): React.JSX.Element {
  const on = useView((s) => s.layers.overlay);
  const toggleLayer = useView((s) => s.toggleLayer);
  return (
    <p className="overlay-buttons">
      <button type="button" className="step" onClick={() => toggleLayer('overlay')} aria-pressed={on}>
        {on ? 'Stop drawing it' : 'Draw it on the plateau'}
      </button>
    </p>
  );
}

/**
 * Which epoch this claim was actually evaluated at, and the way back. A dated
 * claim under an override is a different claim from the one its author
 * stated, and the panel has to say so rather than quietly showing another
 * year's numbers under the same title. The years are written the way the
 * caption line writes them, so the panel and the top of the screen agree.
 */
function EpochLine({ claim, model }: { claim: Claim; model: Model }): React.JSX.Element {
  const setEpoch = useView((s) => s.setEpoch);
  const override = model.epochOverride;
  if (override === null || claim.epoch === undefined) {
    return (
      <p className="note">
        Evaluated at <span className="num">{yearWords(claim.epoch as number)}</span>, the epoch the claim is stated at.
      </p>
    );
  }
  return (
    <p className="note">
      Evaluated at <span className="num">{yearWords(override)}</span>, not at the{' '}
      <span className="num">{yearWords(claim.epoch)}</span> the claim is stated at.{' '}
      <button type="button" className="link" onClick={() => setEpoch(null)}>
        back to the claim's epoch
      </button>
    </p>
  );
}

/**
 * The handles an overlay puts in the panel. They are the free choices the
 * claim lists, made operable: where the sidereal time has to stand for a
 * shaft's star to be on the meridian, and which way up the sky is laid on the
 * ground.
 */
function OverlayControls({ overlay, model }: { overlay: OverlaySpec; model: Model }): React.JSX.Element | null {
  const setLst = useView((s) => s.setLst);
  const krupp = useView((s) => s.krupp);
  const toggleKrupp = useView((s) => s.toggleKrupp);

  switch (overlay.kind) {
    case 'ghost-profile':
      return (
        <ul className="plain ghosts">
          {overlay.spec.profiles.map((g) => (
            <li key={g.label}>
              <span className="swatch" style={{ background: g.colour }} />
              <code>{g.label}</code> {formatDms(g.slopeDeg)}
            </li>
          ))}
          {overlay.spec.errorBandArcmin !== undefined && (
            <li className="note">Survey error band on the measured angle: ±{overlay.spec.errorBandArcmin}′.</li>
          )}
        </ul>
      );
    case 'shaft-rays':
      return (
        <ul className="plain rays">
          {overlay.spec.rays.map((ray) => (
            <li key={ray.key}>
              <span className="swatch" style={{ background: ray.colour }} />
              <code>{ray.key}</code> {formatDms(ray.angleDeg)} against {ray.star.name} at {formatDms(ray.star.transitAltitudeDeg)},{' '}
              {formatArcminutes(ray.residualDeg)} out.{' '}
              <button type="button" className="link" onClick={() => setLst(ray.star.transitLstDeg)}>
                put {ray.star.name} on the meridian
              </button>
            </li>
          ))}
        </ul>
      );
    case 'passage-ray': {
      const spec = overlay.spec;
      const lst = spec.culmination === 'lower' ? spec.star.lowerLstDeg : spec.star.transitLstDeg;
      return (
        <ul className="plain rays">
          <li>
            <span className="swatch" style={{ background: spec.colour }} />
            <code>{spec.passage}</code> {formatDms(spec.angleDeg)} recorded, {formatDms(spec.landmarkAngleDeg)} from the floor landmarks.
          </li>
          <li>
            {spec.star.name} at {spec.culmination} culmination: {formatDms(spec.targetAltitudeDeg)}, {formatArcminutes(spec.residualDeg)}{' '}
            from the passage.{' '}
            <button type="button" className="link" onClick={() => setLst(lst)}>
              put {spec.star.name} there now
            </button>
          </li>
        </ul>
      );
    }
    case 'compass-rose': {
      const spec = overlay.spec;
      return (
        <ul className="plain rays">
          <li>
            The measured azimuth is {formatArcminutes(spec.azimuthDeg)}, drawn {spec.exaggeration.toFixed(0)} times wide of the truth. At
            this rose's {spec.radiusM.toFixed(0)} m the true line would miss true north by{' '}
            {(Math.abs(Math.tan((spec.azimuthDeg * Math.PI) / 180) * spec.radiusM) * 1000).toFixed(0)} mm.
          </li>
          {spec.methods.length > 0 && <li className="note">Methods proposed: {spec.methods.join(', ')}.</li>}
          {spec.stars.length > 0 && (
            <li className="note">
              {spec.stars.map((s) => `${s.name} ${formatDms(s.altDeg)} high`).join(' · ')}, joined on the dome as Spence's pair.
            </li>
          )}
        </ul>
      );
    }
    case 'sky-projection': {
      const spec = overlay.spec;
      return (
        <>
          <ul className="toggles">
            <li>
              <label>
                <input type="checkbox" checked={krupp} onChange={() => toggleKrupp()} />
                Krupp inversion: lay the sky with north and south swapped
              </label>
            </li>
          </ul>
          <p className="note">
            The belt is {spec.beltAngleDeg.toFixed(2)}° from the meridian at this epoch; the line through the pyramid centres is{' '}
            {spec.groundAngleDeg.toFixed(2)}°. The projection is scaled at {spec.scale.toFixed(0)} m per degree, which is the
            Alnitak-to-Alnilam separation set against the G1-to-G2 centre distance, and it is not rotated to fit.{' '}
            {spec.inverted
              ? 'With the inversion on, the belt runs the way the plateau does, which is the correlation as its authors draw it.'
              : "With the inversion off, the sky is laid north to north, and the belt runs the other way from the pyramids. That is Krupp's objection, drawn."}
          </p>
        </>
      );
    }
    case 'ground-outlines': {
      const outlines = overlay.spec.outlines;
      // Half the difference between the two sides is how far apart the lines
      // run on the ground, which is the whole of what the picture cannot say.
      const first = outlines[0];
      const last = outlines[outlines.length - 1];
      const apartM = first && last && first !== last ? Math.abs(last.sideM - first.sideM) / 2 : undefined;
      return (
        <ul className="plain rays">
          {outlines.map((o) => (
            <li key={o.name}>
              <span className="swatch" style={{ background: o.colour }} />
              {o.label}: {formatValue(o.sideM, 'm')}, {o.sideInches.toFixed(1)} P″ against {o.targetInches.toFixed(2)} P″,{' '}
              {percent(o.residualPct)}
            </li>
          ))}
          {apartM !== undefined && (
            <li className="note">
              The two squares run {apartM.toFixed(2)} m apart on a side {formatValue(first?.sideM as number, 'm')} long, so the picture
              shows one line where there are two. The difference lives in this panel.
            </li>
          )}
        </ul>
      );
    }
    case 'ground-rectangle': {
      const spec = overlay.spec;
      return (
        <ul className="plain rays">
          <li>
            <span className="swatch" style={{ background: spec.measuredColour }} />
            East-west: {formatValue(spec.extentEastM, 'm')}, {spec.extentEastCubits.toFixed(1)} rc against the claimed{' '}
            {spec.claimedEastCubits.toFixed(1)} rc, {percent(spec.residualEastPct, 2)}
          </li>
          <li>
            <span className="swatch" style={{ background: spec.measuredColour }} />
            North-south: {formatValue(spec.extentNorthM, 'm')}, {spec.extentNorthCubits.toFixed(1)} rc against the claimed{' '}
            {spec.claimedNorthCubits.toFixed(1)} rc, {percent(spec.residualNorthPct, 2)}
          </li>
          <li>
            <span className="swatch" style={{ background: spec.claimedColour }} />
            The claimed rectangle is set out from the {spec.from.label}, so its far corner falls where the arithmetic puts it:{' '}
            {cornerMissWords(spec)}.
          </li>
          <li className="note">
            The cubits are the metres divided by the royal cubit, so the slider above moves them and the residuals with them and
            leaves the metres where the survey put them.
          </li>
        </ul>
      );
    }
    case 'chamber-wireframe': {
      const spec = overlay.spec;
      return (
        <ul className="plain rays">
          {spec.diagonals.map((d) => (
            <li key={d.name}>
              <span className="swatch" style={{ background: d.colour }} />
              {d.name}: drawn {d.drawnM.toFixed(2)} m, claimed {d.lengthM.toFixed(2)} m, {formatValue(d.cubits, 'rc')} rc
              {d.target === undefined ? '' : ` against ${formatValue(d.target, 'rc')}`}
              {d.residualPct === undefined ? '' : `, ${percent(d.residualPct)}`}
            </li>
          ))}
          <li className="note">
            The box is the four measured wall positions and the two measured levels; the cubits beside each diagonal are the
            claim's own, which are Petrie's means of the wall faces. Those are not the same records, and under a preset that
            takes the floor from one survey and the ceiling from another the drawn line and its label part by the better part of
            a decimetre, which is why both lengths are printed.
          </li>
        </ul>
      );
    }
    case 'ground-line': {
      const spec = overlay.spec;
      // Where the target came from, said from its own records rather than
      // asserted here: a cited coordinate is not a survey and the panel has
      // to be the place that admits it.
      const placement = recordsFor(spec.to.recordKeys, model.resolved);
      const cited = placement[0];
      return (
        <ul className="plain rays">
          <li>
            <span className="swatch" style={{ background: spec.cornerColour }} />
            {spec.from.label} through {spec.through.label}: {spec.cornerBearingDeg.toFixed(2)}°
          </li>
          <li>
            <span className="swatch" style={{ background: spec.targetColour }} />
            Base centre to the {spec.to.label}, {(spec.to.distanceM / 1000).toFixed(1)} km off:{' '}
            {spec.targetBearingDeg.toFixed(2)}°. The corner line misses it by {Math.abs(spec.residualToTargetDeg).toFixed(2)}°.
          </li>
          {spec.referenceBearingDeg !== undefined && spec.residualToReferenceDeg !== undefined && (
            <li>
              <span className="swatch" style={{ background: spec.referenceColour }} />
              The round {spec.referenceBearingDeg.toFixed(2)}° the claim also states: the corner line is{' '}
              {Math.abs(spec.residualToReferenceDeg).toFixed(2)}° off it.
            </li>
          )}
          {cited && (
            <li className="note">
              The {spec.to.label} is placed from {citationOf(model, cited.source)}
              {placement.some((m) => !m.verified) ? ', unverified' : ''}: {cited.note ?? 'a cited coordinate, not a survey'}
            </li>
          )}
        </ul>
      );
    }
    case 'map-inset': {
      const spec = overlay.spec;
      const claimed = spec.parallels.find((p) => p.name === 'claimed');
      const datum = spec.parallels.find((p) => p.name === 'egypt1907');
      return (
        <ul className="plain rays">
          {spec.parallels.map((p) => (
            <li key={p.name}>
              <span className="swatch" style={{ background: p.colour }} />
              {p.label}: {p.latitudeDeg.toFixed(7)}°, {parallelOffsetWords(p)}
            </li>
          ))}
          {claimed && datum && spec.datumOverResidual !== undefined && (
            <li className="note">
              The whole coincidence is {Math.abs(claimed.offsetM).toFixed(1)} m of latitude; changing the ellipsoid under it is
              worth {Math.abs(datum.offsetM).toFixed(1)} m, or {spec.datumOverResidual.toFixed(1)} times as much, and in the other
              direction.
            </li>
          )}
          <li className="note">
            A degree of latitude is {spec.metresPerDegree.toLocaleString('en-US', { maximumFractionDigits: 0 })} m here, so the
            seventh decimal place the claim is stated to is {(spec.metresPerDegree * 1e-7 * 100).toFixed(1)} cm of ground.
          </li>
        </ul>
      );
    }
    case 'ghost-earth': {
      const spec = overlay.spec;
      const scale = spec.scale.toLocaleString('en-US');
      return (
        <ul className="plain rays">
          <li>
            <span className="swatch" style={{ background: spec.earthColour }} />
            The polar radius at 1:{scale} is {formatValue(spec.polarRadiusM, 'm')}; the pyramid stands{' '}
            {formatValue(spec.heightM, 'm')}, {percent(spec.polarResidualPct)}
          </li>
          <li>
            <span className="swatch" style={{ background: spec.pyramidColour }} />
            The equatorial circumference at 1:{scale} is a circle of {formatValue(spec.equatorRadiusM, 'm')} radius; the measured
            base perimeter draws one of {formatValue(spec.perimeterRadiusM, 'm')}, {percent(spec.perimeterResidualPct)}
          </li>
          <li className="note">
            Both halves are A1's π relation at a scale: the base perimeter is {spec.piRatio.toFixed(4)} times the height against
            2π = {(2 * Math.PI).toFixed(4)}. The two residuals differ by the Earth's own flattening, because the first takes the
            polar radius and the second the equatorial circumference.
          </li>
        </ul>
      );
    }
    case 'ground-bearings': {
      const spec = overlay.spec;
      // The two sight lines, when the claim has them, are the edges of the
      // gap, so the width between them is the band the claim is judged on.
      const [first, last] = [spec.sights[0], spec.sights[spec.sights.length - 1]];
      const gap = first && last && first !== last ? Math.abs(first.azimuthDeg - last.azimuthDeg) : undefined;
      return (
        <ul className="plain rays">
          {spec.bearings.map((b) => (
            <li key={b.label}>
              <span className="swatch" style={{ background: b.colour }} />
              {b.label} at {b.azimuthDeg.toFixed(2)}° · <code>{b.source}</code>
            </li>
          ))}
          {spec.sights.map((s) => (
            <li key={s.label}>
              <span className="swatch" style={{ background: s.colour }} />
              {s.label} at {s.azimuthDeg.toFixed(2)}°
            </li>
          ))}
          {gap !== undefined && (
            <li className="note">The two corners subtend {gap.toFixed(2)}° from here, which is the gap the sun is asked to set into.</li>
          )}
          <li className="note">
            Azimuths run from north through east, on a flat horizon: no local skyline is modelled, and the plateau has one.
          </li>
        </ul>
      );
    }
  }
}
