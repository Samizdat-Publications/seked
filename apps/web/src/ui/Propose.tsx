/**
 * The Propose drawer: somebody's words in, a claim the evaluator grades out.
 *
 * This is the one place in the viewer where a reader can put a thing they have
 * read in a book to the model rather than reading a claim somebody else filed.
 * It asks for their own key first and says plainly where that key goes, then
 * takes prose, hands it to the runner, and puts what comes back in the store
 * beside the filed claims: a row in the Claims drawer, a detail pane, an
 * overlay on the plateau, all of it drawn in the style reserved for a claim
 * nobody has checked.
 *
 * Nothing here writes into `data/claims/`, and there is no button that would.
 * A proposal is downloaded as a file and moved in by hand after a person has
 * read it against its sources, which is the whole of the difference between a
 * proposed claim and a filed one.
 *
 * The work is `../runner`; this file is the form in front of it.
 */
import { useState } from 'react';
import type { ClaimFile } from '@seked/claims/browser';
import {
  EXAMPLES,
  downloadClaim,
  failedProposal,
  failureWords,
  forgetReaderKey,
  putToModel,
  readerKey,
  setReaderKey,
  type Proposed,
  type Stage,
} from '../runner';
import { useView } from '../store';
import { useUi } from './ui';

/** A key's tail, for saying one is held without putting it on the screen. */
function tail(key: string): string {
  return key.length <= 4 ? '****' : `****${key.slice(-4)}`;
}

export function Propose(): React.JSX.Element {
  const [key, setKey] = useState(() => readerKey());
  const [typed, setTyped] = useState('');
  const [prose, setProse] = useState('');
  const [stage, setStage] = useState<Stage | null>(null);
  const [done, setDone] = useState<Proposed | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ClaimFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const openDrawer = useUi((s) => s.open);
  const selectClaim = useView((s) => s.setClaim);
  const dropProposed = useView((s) => s.dropProposed);
  const running = stage !== null;

  const keep = (): void => {
    setReaderKey(typed);
    setKey(readerKey());
    setTyped('');
  };

  const forget = (): void => {
    forgetReaderKey();
    setKey(null);
  };

  const ask = async (words: string): Promise<void> => {
    setProse(words);
    setDone(null);
    setTrouble(null);
    setAttempt(null);
    setErrors([]);
    setStage('asking');
    try {
      setDone(await putToModel(words, setStage));
    } catch (raised) {
      const failed = failedProposal(raised);
      setTrouble(failureWords(raised));
      setErrors(failed?.errors ?? []);
      setAttempt(failed?.claim ?? null);
    } finally {
      setStage(null);
    }
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
    <>
      <section className="block">
        <h2>Put a claim to the model</h2>
        <textarea
          className="propose-prose"
          rows={6}
          placeholder="Say what the claim is, in the words you read it in."
          value={prose}
          disabled={running}
          onChange={(e) => setProse(e.target.value)}
        />
        <p className="propose-buttons">
          <button type="button" className="step is-primary" disabled={running || prose.trim() === ''} onClick={() => void ask(prose)}>
            Put it to the model
          </button>
          {running && <span className="propose-stage">{stage}</span>}
        </p>
        <p className="note">
          It comes back as a claim file: a formula over the measurements, a target, a tolerance and the choices it had to make.
          The same evaluator that grades every filed claim grades it, and it is drawn on the plateau like the rest, dashed,
          because nobody has read it yet.
        </p>
      </section>

      {EXAMPLES.length > 0 && (
        <section className="block">
          <h2>Or something a proponent says</h2>
          <ul className="propose-examples">
            {EXAMPLES.map((example) => (
              <li key={example.id}>
                <button type="button" className="propose-example" disabled={running} onClick={() => void ask(example.prose)}>
                  <span className="propose-example-label">{example.title}</span>
                  {/* What to expect of it, which is the runner's own note and not a promise. */}
                  <span className="propose-example-note">{example.expect}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done && (
        <section className="block">
          <h2>What came back</h2>
          <p className="propose-outcome">
            <span className="claim-id num">{done.claim.id}</span> {done.claim.title}
          </p>
          <p className="note">
            {done.repairs > 0
              ? 'The first answer named something that is not in the database, so it was put back once with the errors.'
              : 'It parsed and evaluated first time.'}{' '}
            It read <span className="num">{done.usage.input.toLocaleString()}</span> tokens and wrote{' '}
            <span className="num">{done.usage.output.toLocaleString()}</span>.
          </p>
          <p className="propose-buttons">
            <button
              type="button"
              className="step"
              onClick={() => {
                selectClaim(done.claim.id);
                openDrawer('claims');
              }}
            >
              Read it in Claims
            </button>
            <button type="button" className="link" onClick={() => downloadClaim(done.file)}>
              Download as YAML
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                dropProposed(done.claim.id);
                setDone(null);
              }}
            >
              Throw it away
            </button>
          </p>
          <p className="note">
            The file is the one the shell would have written, under <code>build/claims/</code>. Read it against its sources and
            move it into <code>data/claims/</code> yourself if it belongs there. Nothing here does that for you, and a proposal is
            gone when you reload.
          </p>
        </section>
      )}

      {trouble && (
        <section className="block">
          <h2>It did not hold up</h2>
          <p className="note propose-trouble">{trouble}</p>
          {errors.length > 1 && (
            <ul className="propose-errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {attempt && (
            <>
              <p className="note">The model's last attempt, as it stood when it was given up on:</p>
              <pre className="propose-attempt">{JSON.stringify(attempt, null, 2)}</pre>
            </>
          )}
          <p className="propose-buttons">
            <button type="button" className="step" disabled={running || prose.trim() === ''} onClick={() => void ask(prose)}>
              Try again
            </button>
          </p>
        </section>
      )}

      <section className="block">
        <p className="note">
          The key {tail(key)} is held in this browser.{' '}
          <button type="button" className="link" onClick={forget}>
            forget
          </button>
        </p>
      </section>
    </>
  );
}
