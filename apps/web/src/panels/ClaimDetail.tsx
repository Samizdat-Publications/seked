import { formatEpoch, formatResidual, formatValue, identifiers, type Claim, type ComparisonResult } from '@seked/claims/browser';
import { sourceById } from '@seked/data/browser';
import { formatArcminutes, formatDms } from '@seked/units';
import { useMemo } from 'react';
import { recordsFor, type FailedClaim, type Model } from '../model';
import { overlayNote, overlaySpec, type OverlayContext, type OverlaySpec } from '../overlays';
import { useView } from '../store';
import { Fit } from './Claims';

/**
 * One claim in full: what it compares, how far off it is, what it had to
 * assume, who says so, and which records the numbers came from. The
 * formatters are the dossier's, so the panel and docs/dossier.md read alike.
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
  const inputs = useMemo(() => {
    const keys = new Set<string>();
    for (const c of claim.comparisons) for (const id of [...identifiers(c.formula), ...identifiers(c.target)]) keys.add(id);
    return recordsFor([...keys].sort(), model.resolved);
  }, [claim, model.resolved]);

  return (
    <article className="detail">
      <header>
        <h3>
          {claim.id} · {claim.title} <Fit result={result} />
        </h3>
        <p className="note">{claim.summary}</p>
        {claim.epoch !== undefined && <EpochLine claim={claim} model={model} />}
      </header>

      {result.error && <p className="warning">This preset cannot evaluate the claim: {result.error}</p>}

      {result.comparisons.length > 0 && (
        <ul className="comparisons">
          {result.comparisons.map((c, i) => (
            <Comparison key={`${c.label}-${i}`} c={c} />
          ))}
        </ul>
      )}

      {result.comparisons.length === 0 && !result.error && (
        <p className="note">Not computable yet: it {result.status === 'needs-sky' ? 'waits on the sky engine' : 'waits on the site-plan positions'}.</p>
      )}

      <h4>Free choices ({claim.free_choices.length})</h4>
      {claim.free_choices.length === 0 ? (
        <p className="note">None. The claim costs nothing to state.</p>
      ) : (
        <ul className="plain">
          {claim.free_choices.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      <h4>Overlay</h4>
      <p className={overlay.built ? 'note' : 'note pending'}>{overlay.text}</p>
      {drawn && <OverlayControls overlay={drawn} />}

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

      {inputs.length > 0 && (
        <>
          <h4>Inputs</h4>
          <ul className="inputs">
            {inputs.map((m) => (
              <li key={m.key}>
                <code>{m.key}</code>
                <span className="value">
                  {m.value} {m.unit}
                </span>
                <span className="note">
                  {m.source}
                  {m.verified ? '' : ', unverified'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function Comparison({ c }: { c: ComparisonResult }): React.JSX.Element {
  const tolerance = c.toleranceAbs !== undefined ? `±${formatValue(c.toleranceAbs, c.unit)}` : `±${c.tolerancePct} %`;
  return (
    <li className="comparison">
      <div className="comparison-head">
        <span>{c.label}</span>
        <span className={`chip ${c.within ? 'chip-fits' : 'chip-misses'}`}>{c.within ? `within ${tolerance}` : `outside ${tolerance}`}</span>
      </div>
      <code className="formula">
        {c.formula} vs {c.target}
      </code>
      <dl>
        <div>
          <dt>Value</dt>
          <dd>{formatValue(c.value, c.unit)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{formatValue(c.targetValue, c.unit)}</dd>
        </div>
        <div>
          <dt>Residual</dt>
          <dd>{formatResidual(c)}</dd>
        </div>
      </dl>
    </li>
  );
}

function Citations({ label, ids, model }: { label: string; ids: string[]; model: Model }): React.JSX.Element | null {
  if (ids.length === 0) return null;
  return (
    <p className="note">
      <strong>{label}:</strong>{' '}
      {ids
        .map((id) => {
          try {
            return sourceById(model.db, id).citation;
          } catch {
            return id;
          }
        })
        .join(' · ')}
    </p>
  );
}

/**
 * Which epoch this claim was actually evaluated at, and the way back. A dated
 * claim under an override is a different claim from the one its author
 * stated, and the panel has to say so rather than quietly showing another
 * year's numbers under the same title.
 */
function EpochLine({ claim, model }: { claim: Claim; model: Model }): React.JSX.Element {
  const setEpoch = useView((s) => s.setEpoch);
  const override = model.epochOverride;
  if (override === null || claim.epoch === undefined) {
    return <p className="note">Evaluated at epoch {formatEpoch(claim.epoch as number)}, the epoch the claim is stated at.</p>;
  }
  return (
    <p className="note">
      Evaluated at epoch {formatEpoch(override)}, not at the {formatEpoch(claim.epoch)} the claim is stated at.{' '}
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
function OverlayControls({ overlay }: { overlay: OverlaySpec }): React.JSX.Element | null {
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
