import { GROUPS, type Claim, type Group } from '@seked/claims/browser';
import { formatResidual, worstComparison } from '@seked/claims/browser';
import { Fragment } from 'react';
import type { FailedClaim, Model } from '../model';
import type { OverlayContext } from '../overlays';
import { useView } from '../store';
import { ClaimDetail } from './ClaimDetail';

const GROUP_IDS = Object.keys(GROUPS) as Group[];

/** The three colours a grade is said in: the fit green, the miss red, the muted sand for anything not yet decided. */
export type GradeTone = 'fits' | 'misses' | 'pending';

export interface ClaimGrade {
  word: string;
  tone: GradeTone;
}

/**
 * A claim's grade as one word. The list used to carry a chip and a sentence;
 * a word and a dot say the same thing in a fifth of the width, and the three
 * words a reader has to tell apart are `fits`, `misses` and a `needs`, so the
 * colour does the sorting and the word does the saying.
 */
export function gradeOf(result: FailedClaim | undefined): ClaimGrade {
  if (result === undefined || result.error !== undefined) return { word: 'error', tone: 'pending' };
  if (result.fits === undefined) return { word: result.status.replace('needs-', 'needs '), tone: 'pending' };
  return result.fits ? { word: 'fits', tone: 'fits' } : { word: 'misses', tone: 'misses' };
}

/**
 * A group's claims in the order the drawer lists them: anything proposed
 * first, then the filed ones in the dossier's own order. A proposal is the
 * thing the reader has just made and is looking for, and putting it at the
 * head of its group is the only place it can be found without reading the
 * whole group. The sort is stable, so the filed order is untouched.
 */
export function orderClaims(claims: Claim[]): Claim[] {
  const rank = (c: Claim): number => (c.origin === 'proposed' ? 0 : 1);
  return [...claims].sort((a, b) => rank(a) - rank(b));
}

/**
 * Every claim, in the dossier's groups and the dossier's order, graded by its
 * worst comparison. Selecting one opens the detail pane and, where the
 * overlay exists, draws it in the scene.
 *
 * The keys are the list's own: up and down walk the rows, Enter opens the
 * row under the cursor (a row is a button, so the browser does that itself),
 * and Escape shuts the open detail. Escape is marked handled so that the
 * shell's own Escape, which shuts the whole drawer, does not fire on the same
 * keystroke and take the list away with the detail.
 */
export function Claims({ claims, model, context }: { claims: Claim[]; model: Model; context: OverlayContext }): React.JSX.Element {
  const selected = useView((s) => s.claim);
  const setClaim = useView((s) => s.setClaim);
  const chosen = claims.find((c) => c.id === selected);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key === 'Escape') {
      if (selected === null) return;
      setClaim(null);
      e.preventDefault();
      return;
    }
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button.claim')];
    const here = rows.indexOf(document.activeElement as HTMLButtonElement);
    // Only when the cursor is on a row: inside an open detail the arrows
    // belong to whatever the reader is actually in.
    if (here === -1) return;
    const next = rows[here + step];
    if (next === undefined) return;
    next.focus();
    e.preventDefault();
  };

  return (
    <section className="block" onKeyDown={onKeyDown}>
      <h2>Claims</h2>
      {GROUP_IDS.map((group) => {
        const inGroup = orderClaims(claims.filter((c) => c.group === group));
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
                    <li className="claim-open">
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
        <span className="claim-title">
          {claim.title}
          {claim.origin === 'proposed' && <span className="claim-tag">proposed</span>}
        </span>
        <span className="claim-residual">{worst ? formatResidual(worst) : '-'}</span>
        <Fit result={result} />
      </button>
    </li>
  );
}

/** The grade, as a dot and a word. The detail's heading carries the same one. */
export function Fit({ result }: { result: FailedClaim }): React.JSX.Element {
  const { word, tone } = gradeOf(result);
  return (
    <span className={`grade is-${tone}`}>
      <span className="grade-dot" aria-hidden="true" />
      {word}
    </span>
  );
}
