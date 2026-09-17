/**
 * The wordmark and the caption line, top left, over everything.
 *
 * The caption is the honesty rule made visible: it names the timeline stop,
 * the year that stop stands at, the day and hour the sun is drawn for, and it
 * ends on the word for what the reader is looking at, which is survey,
 * reconstruction or claim. When the sky has been taken somewhere else, by the
 * reader or by an open claim, a second line says so rather than letting the
 * year in the caption stand for a dome it no longer describes.
 *
 * A third line appears while the viewer is still fetching what the plateau is
 * made of, and goes again when it is in hand. The first load takes about
 * fifteen seconds, and a scene that is going to change under the reader
 * should say so rather than let them take flat grey stone for the finished
 * thing.
 */
import { useView } from '../store';
import { stateById } from '../view';
import { momentWords, yearWords } from './moment';

/**
 * What each kind of outstanding load is called. An id is `kind:what`, and the
 * kind is the only part the reader sees, so several maps of stone are one
 * phrase and not six. A kind nobody has named here is shown as it is, which
 * keeps a module that starts reporting something new from having to change
 * this file first.
 */
const LOADING_WORDS: Record<string, string> = {
  stone: 'the stone',
  standin: 'the models',
  sphinx: 'the Sphinx',
  terrain: 'the ground',
  sky: 'the sky',
};

/** The phrases behind a set of loading ids, in the order they are listed above. */
export function loadingWords(ids: Iterable<string>): string[] {
  const kinds = new Set<string>();
  for (const id of ids) kinds.add(id.split(':')[0] ?? id);
  const known = Object.keys(LOADING_WORDS).filter((kind) => kinds.has(kind));
  const rest = [...kinds].filter((kind) => !(kind in LOADING_WORDS)).sort();
  return [...known, ...rest].map((kind) => LOADING_WORDS[kind] ?? kind);
}

/** "the stone", "the stone and the Sphinx", "the stone, the models and the Sphinx". */
export function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export function Caption({ epoch, claimId }: { epoch: number; claimId: string | null }): React.JSX.Element {
  const stateId = useView((s) => s.state);
  const moment = useView((s) => s.moment);
  const override = useView((s) => s.epoch);
  const loading = useView((s) => s.loading);
  const state = stateById(stateId);
  const waiting = listWords(loadingWords(loading));

  return (
    <header className="caption">
      <h1 className="wordmark">Seked</h1>
      <p className="caption-line">
        <span className="caption-state">{state.label}</span>
        <Dot />
        <span className="num">{yearWords(state.epoch)}</span>
        <Dot />
        <span className="num">{momentWords(moment)}</span>
        <Dot />
        <span className={`caption-kind is-${state.kind}`}>{state.kind}</span>
      </p>
      {epoch !== state.epoch && (
        <p className="caption-aside">
          Sky at <span className="num">{yearWords(epoch)}</span>
          {override !== null ? ', held there' : claimId === null ? '' : `, following ${claimId}`}
        </p>
      )}
      {waiting !== '' && (
        <p className="caption-loading" aria-live="polite">
          loading {waiting}
        </p>
      )}
    </header>
  );
}

const Dot = (): React.JSX.Element => (
  <span className="caption-dot" aria-hidden="true">
    ·
  </span>
);
