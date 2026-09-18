/**
 * The Propose drawer: prose in, a claim the evaluator can grade out. This is
 * the stub the trunk lays; track U puts the runner and the reader's key
 * behind it. It stands in the rail from the start so the drawer has a place
 * and the shell's tests have something to open.
 */
export function Propose(): React.JSX.Element {
  return (
    <section className="block">
      <h2>Propose a claim</h2>
      <p className="note">
        The claims runner is not here yet. When it is, you will be able to put a claim in your own words to the model,
        which turns it into a claim file the same evaluator grades every filed claim with, and see it drawn beside them.
      </p>
      <p className="note">
        Nothing it proposes is written into <code>data/claims/</code>. A proposed claim is read by a person first.
      </p>
    </section>
  );
}
