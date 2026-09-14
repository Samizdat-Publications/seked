import { formatEpoch, formatResidual, formatValue, identifiers, type Claim, type ComparisonResult } from '@seked/claims/browser';
import { sourceById } from '@seked/data/browser';
import { formatDms } from '@seked/units';
import { useMemo } from 'react';
import { recordsFor, type FailedClaim, type Model } from '../model';
import { ghostProfileSpec, overlayNote } from '../overlays';
import { useView } from '../store';
import { Fit } from './Claims';

/**
 * One claim in full: what it compares, how far off it is, what it had to
 * assume, who says so, and which records the numbers came from. The
 * formatters are the dossier's, so the panel and docs/dossier.md read alike.
 */
export function ClaimDetail({ claim, result, model }: { claim: Claim; result: FailedClaim; model: Model }): React.JSX.Element {
  const overlay = overlayNote(claim, model.env);
  const ghosts = ghostProfileSpec(claim, model.env);
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
      {ghosts && (
        <ul className="plain ghosts">
          {ghosts.profiles.map((g) => (
            <li key={g.label}>
              <span className="swatch" style={{ background: g.colour }} />
              <code>{g.label}</code> {formatDms(g.slopeDeg)}
            </li>
          ))}
          {ghosts.errorBandArcmin !== undefined && (
            <li className="note">Survey error band on the measured angle: ±{ghosts.errorBandArcmin}′.</li>
          )}
        </ul>
      )}

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
