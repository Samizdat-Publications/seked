/**
 * The Sphinx control: which Sphinx the plateau is shown with.
 *
 * Three choices, and only three, because the manifest carries three readings
 * of the same rock. The first is the state's own Sphinx, which is the
 * mainstream one in every state but `ancient`, where the design makes the
 * black Anubis the state's own through the manifest's `default_in`. The other
 * two are claims (the lion, after Hancock and Bauval among others, and the
 * recumbent Anubis, after Temple), and they are labelled claims wherever they
 * are shown.
 *
 * Nothing here decides which model that is. `chosen`, in `scene/Standins.tsx`,
 * is the one place that reads the manifest's `states`, `variant` and
 * `default_in`, and this control asks it the same question the scene asks so
 * the line under each choice cannot disagree with what is drawn.
 */
import { useEffect, useState } from 'react';
import { chosen, loadManifest, type StandinEntry } from '../scene/Standins';
import { useView } from '../store';
import { SPHINX_VARIANTS, stateById, type SphinxVariant } from '../view';

/** The footprint a Sphinx model stands on, which is how its entry is told from any other. */
const SPHINX_FOOTPRINT = 'sphinx.body';

/** The entry a given choice would draw in this state, or nothing where the manifest has none. */
function modelFor(entries: readonly StandinEntry[], state: string, variant: SphinxVariant | null): StandinEntry | undefined {
  return chosen(entries, state, variant).find((e) => e.replaces.includes(SPHINX_FOOTPRINT));
}

export function SphinxControl(): React.JSX.Element {
  const state = useView((s) => s.state);
  const sphinx = useView((s) => s.sphinx);
  const setSphinx = useView((s) => s.setSphinx);
  const [entries, setEntries] = useState<StandinEntry[]>([]);

  useEffect(() => {
    let alive = true;
    void loadManifest().then((all) => {
      if (alive) setEntries(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  const own = modelFor(entries, state, null);
  const choices: { id: SphinxVariant | null; label: string }[] = [
    { id: null, label: "The state's own Sphinx" },
    ...SPHINX_VARIANTS.map((v) => ({
      id: v.id as SphinxVariant,
      // A variant the state has already made its own is not a claim laid over
      // that state, it is that state, so it says so rather than "claim".
      label: own?.variant === v.id ? `${v.label.replace(/ \(claim\)$/, '')} (the state's own)` : v.label,
    })),
  ];

  return (
    <section className="block">
      <h2>The Sphinx</h2>
      <ul className="toggles">
        {choices.map((choice) => {
          const model = modelFor(entries, state, choice.id);
          return (
            <li key={choice.id ?? 'own'}>
              <label>
                <input
                  type="radio"
                  name="sphinx"
                  checked={sphinx === choice.id}
                  onChange={() => setSphinx(choice.id)}
                />
                {choice.label}
              </label>
              <p className="note">{model ? model.name : 'No model for this stop of the timeline.'}</p>
            </li>
          );
        })}
      </ul>
      <p className="note">
        In {stateById(state).label.toLowerCase()} the Sphinx is drawn as {own ? own.name : 'the outlines OpenStreetMap traces for it'}.
        Every one of these is a stand-in: a generated or downloaded model fitted to the three traced outlines, not a survey, and nothing
        about its form is a measurement. The lion and the Anubis are claims about the Sphinx's first form and are drawn only when asked
        for.
      </p>
    </section>
  );
}
