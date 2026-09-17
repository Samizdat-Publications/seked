/**
 * The wordmark and the caption line, top left, over everything.
 *
 * The caption is the honesty rule made visible: it names the timeline stop,
 * the year that stop stands at, the day and hour the sun is drawn for, and it
 * ends on the word for what the reader is looking at, which is survey,
 * reconstruction or claim. When the sky has been taken somewhere else, by the
 * reader or by an open claim, a second line says so rather than letting the
 * year in the caption stand for a dome it no longer describes.
 */
import { useView } from '../store';
import { stateById } from '../view';
import { momentWords, yearWords } from './moment';

export function Caption({ epoch, claimId }: { epoch: number; claimId: string | null }): React.JSX.Element {
  const stateId = useView((s) => s.state);
  const moment = useView((s) => s.moment);
  const override = useView((s) => s.epoch);
  const state = stateById(stateId);

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
    </header>
  );
}

const Dot = (): React.JSX.Element => (
  <span className="caption-dot" aria-hidden="true">
    ·
  </span>
);
