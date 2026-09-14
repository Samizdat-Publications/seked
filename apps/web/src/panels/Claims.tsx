import { GROUPS, type Claim, type Group } from '@seked/claims/browser';
import { formatResidual } from '@seked/claims/browser';
import { Fragment } from 'react';
import { worstComparison, type FailedClaim, type Model } from '../model';
import type { OverlayContext } from '../overlays';
import { useView } from '../store';
import { ClaimDetail } from './ClaimDetail';

const GROUP_IDS = Object.keys(GROUPS) as Group[];

/**
 * Every claim, in the dossier's groups and the dossier's order, graded by its
 * worst comparison. Selecting one opens the detail pane and, where the
 * overlay exists, draws it in the scene.
 */
export function Claims({ claims, model, context }: { claims: Claim[]; model: Model; context: OverlayContext }): React.JSX.Element {
  const selected = useView((s) => s.claim);
  const setClaim = useView((s) => s.setClaim);
  const chosen = claims.find((c) => c.id === selected);

  return (
    <section className="block">
      <h2>Claims</h2>
      {GROUP_IDS.map((group) => {
        const inGroup = claims.filter((c) => c.group === group);
        if (inGroup.length === 0) return null;
        return (
          <div key={group} className="group">
            <h3>{GROUPS[group]}</h3>
            <ul className="claims">
              {inGroup.map((claim) => (
                <Fragment key={claim.id}>
                  <ClaimRow
                    claim={claim}
                    result={model.results.get(claim.id) as FailedClaim}
                    selected={claim.id === selected}
                    onSelect={() => setClaim(claim.id)}
                  />
                  {claim.id === chosen?.id && (
                    <li>
                      <ClaimDetail
                        claim={claim}
                        result={model.results.get(claim.id) as FailedClaim}
                        model={model}
                        context={context}
                      />
                    </li>
                  )}
                </Fragment>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function ClaimRow({
  claim,
  result,
  selected,
  onSelect,
}: {
  claim: Claim;
  result: FailedClaim;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const worst = worstComparison(result);
  return (
    <li>
      <button type="button" className={`claim${selected ? ' is-selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
        <span className="claim-id">{claim.id}</span>
        <span className="claim-title">{claim.title}</span>
        <span className="claim-residual">{worst ? formatResidual(worst) : '-'}</span>
        <Fit result={result} />
      </button>
    </li>
  );
}

export function Fit({ result }: { result: FailedClaim }): React.JSX.Element {
  if (result.error) return <span className="chip chip-pending">error</span>;
  if (result.fits === undefined) return <span className="chip chip-pending">{result.status.replace('needs-', 'needs ')}</span>;
  return <span className={`chip ${result.fits ? 'chip-fits' : 'chip-misses'}`}>{result.fits ? 'fits' : 'misses'}</span>;
}
