/**
 * The Propose drawer: somebody's words in, a claim the evaluator grades out.
 *
 * It asks for the reader's own key first and says plainly where that key goes,
 * which is the whole of this first part. The field the prose goes in, and the
 * runner behind it, come next.
 *
 * Nothing here will ever write into `data/claims/`, and there is no button
 * that would. A proposal is downloaded as a file and moved in by hand after a
 * person has read it against its sources, which is the whole of the difference
 * between a proposed claim and a filed one.
 *
 * The work is `../runner`; this file is the form in front of it.
 */
import { useState } from 'react';
import { forgetReaderKey, readerKey, setReaderKey } from '../runner';

/** A key's tail, for saying one is held without putting it on the screen. */
function tail(key: string): string {
  return key.length <= 4 ? '****' : `****${key.slice(-4)}`;
}

export function Propose(): React.JSX.Element {
  const [key, setKey] = useState(() => readerKey());
  const [typed, setTyped] = useState('');

  const keep = (): void => {
    setReaderKey(typed);
    setKey(readerKey());
    setTyped('');
  };

  const forget = (): void => {
    forgetReaderKey();
    setKey(null);
  };

  if (key === null) {
    return (
      <section className="block">
        <h2>Your key</h2>
        <label className="field">
          <span className="field-label">Anthropic API key</span>
          <input
            className="propose-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-..."
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') keep();
            }}
          />
        </label>
        <p className="propose-buttons">
          <button type="button" className="step is-primary" disabled={typed.trim() === ''} onClick={keep}>
            Keep it
          </button>
        </p>
        <p className="note">
          The key stays in this browser. It is kept in local storage under one name, it is never put in the address bar, and it is
          not in anything you share from here.
        </p>
        <p className="note">
          It goes to <code>api.anthropic.com</code> and nowhere else. The viewer has no server of its own, so nothing about your
          claim or your key passes through this site.
        </p>
        <p className="note">
          A claim costs about what a page of text costs. The model is priced by the million tokens; one proposal reads a few
          thousand of them and writes a few hundred, which is cents rather than dollars.
        </p>
      </section>
    );
  }

  return (
    <section className="block">
      <h2>Put a claim to the model</h2>
      <p className="note">
        The field the claim goes in is next. When it is here you will be able to put a claim in your own words to the model, which
        turns it into a claim file the same evaluator grades every filed claim with, and see it drawn beside them.
      </p>
      <p className="note">
        The key {tail(key)} is held in this browser.{' '}
        <button type="button" className="link" onClick={forget}>
          forget
        </button>
      </p>
    </section>
  );
}
