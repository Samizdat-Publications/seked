/**
 * The verdict on a claim in four lines: whether it holds, by how much it
 * missed, how many of its comparisons held, and how many free choices it
 * needed to get there.
 *
 * The last of those is the one a reader will not think to ask for and is the
 * most honest number on the page. A claim that fits with no free choices is
 * saying something about the pyramid; a claim that fits after its author has
 * picked the epoch, the star, the base line and the unit is mostly saying
 * something about its author. The panel puts the two side by side and lets
 * the reader draw that conclusion themselves.
 */
import { formatResidual, worstComparison, type Claim, type ClaimResult } from '@seked/claims/browser';

export function ClaimVerdict({ result, claim }: { result: ClaimResult; claim: Claim }): React.JSX.Element {
  const worst = worstComparison(result);
  const held = result.comparisons.filter((c) => c.within).length;
  const all = result.comparisons.length;
  return (
    <dl className="verdict-figures">
      <div>
        <dt>Worst gap</dt>
        <dd className="num">{worst ? formatResidual(worst) : '-'}</dd>
      </div>
      <div>
        <dt>Comparisons held</dt>
        <dd className="num">
          {held} of {all}
        </dd>
      </div>
      <div>
        <dt>Free choices</dt>
        <dd className="num">{claim.free_choices.length}</dd>
      </div>
    </dl>
  );
}
