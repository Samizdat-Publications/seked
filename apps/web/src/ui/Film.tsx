/**
 * The Film drawer: a sequence, a size, a rate, and a button that turns the
 * viewer into a camera.
 *
 * Everything the reader chooses here is a property of the file being made and
 * not of the plateau, so none of it is in the view store or in the address
 * bar. The run itself is `film/run.ts`, the file is `film/encode.ts`, and this
 * component is the form in front of them and the progress line under it.
 */
import { useRef, useState } from 'react';
import { r3f } from '../film/handle';
import { RATES, RESOLUTIONS, startRecorder, type Recorder, type Saved } from '../film/encode';
import { FilmStopped, frameCount, renderFilm } from '../film/run';
import { sequenceSeconds, type Sequence, type Shot } from '../motion/types';
import { TOUR, type TourStep } from '../tour';

/**
 * How long a stand is held, in seconds.
 *
 * A stopgap, with the rest of this block. Track N's `sequences.ts` carries
 * the real sequences, whose shots have their own lengths, their camera paths
 * and their tweens; until it merges, the film has to have something to record,
 * so the tour's steps are wrapped as shots that stand still. The trunk's
 * player cuts between them, so a film made from these is a slideshow of the
 * tour's views, which is exactly what it should be before the engine lands.
 */
const STAND_SECONDS = 6;

/** One of the old tour's steps as a shot that stands still. */
function shotOfStep(step: TourStep): Shot {
  return {
    id: step.id,
    seconds: STAND_SECONDS,
    camera: [{ at: 0, value: step.camera }],
    claim: step.claim,
    layers: step.layers,
    title: step.title,
    text: step.text,
    ...(step.state === undefined ? {} : { state: { to: step.state, at: 0 } }),
    ...(step.epoch === undefined ? {} : { epoch: [{ at: 0, value: step.epoch }] }),
    ...(step.lst === undefined ? {} : { lst: [{ at: 0, value: step.lst }] }),
    ...(step.section === undefined ? {} : { section: step.section }),
  };
}

const TOUR_SEQUENCE: Sequence = {
  id: 'tour',
  label: 'The tour',
  note: 'Every stand of the narrated tour, with its words as subtitles.',
  shots: TOUR.map(shotOfStep),
};

/** The same, cut to its opening, for trying the machinery without waiting a minute. */
const OPENING: Sequence = {
  id: 'tour-opening',
  label: 'The tour, the first two stands',
  note: 'The plateau and the presets. A short film, for checking the settings.',
  shots: TOUR_SEQUENCE.shots.slice(0, 2),
};

const SEQUENCES: Sequence[] = [TOUR_SEQUENCE, OPENING];

/** Seconds as minutes and seconds, for the progress line. */
function mmss(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function outcome(saved: Saved): string {
  const size = `${(saved.bytes / 1e6).toFixed(1)} MB`;
  if (saved.kind === 'frames') return `Frames written, ${size} in all, with the ffmpeg line beside them.`;
  if (saved.kept === 'cancelled') return `The film was made, ${size}, and you cancelled the save.`;
  if (saved.kept === 'downloaded') return `${saved.name} downloaded, ${size}, with its subtitles.`;
  return `${saved.name} saved, ${size}, with its subtitles.`;
}

export function Film(): React.JSX.Element {
  const [sequenceId, setSequenceId] = useState(SEQUENCES[0]!.id);
  const [resolutionId, setResolutionId] = useState(RESOLUTIONS[0]!.id);
  const [fps, setFps] = useState(RATES[0]!);
  const [progress, setProgress] = useState<{ frame: number; total: number } | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const stopping = useRef<AbortController | null>(null);

  const sequence = SEQUENCES.find((s) => s.id === sequenceId) ?? SEQUENCES[0]!;
  const resolution = RESOLUTIONS.find((r) => r.id === resolutionId) ?? RESOLUTIONS[0]!;
  const running = progress !== null;
  const length = sequenceSeconds(sequence);

  const record = async (): Promise<void> => {
    const canvas = r3f()?.getState().gl.domElement;
    if (!canvas) {
      setTrouble('The scene is not mounted, so there is nothing to record.');
      return;
    }
    const { width, height } = resolution;
    const total = frameCount(sequence, fps);
    setSaid(null);
    setTrouble(null);
    setProgress({ frame: 0, total });
    const controller = new AbortController();
    stopping.current = controller;
    let recorder: Recorder | undefined;
    try {
      recorder = await startRecorder({ canvas, sequence, width, height, fps, name: `seked-${sequence.id}-${height}p${fps}` });
      const held = recorder;
      await renderFilm({
        sequence,
        fps,
        width,
        height,
        signal: controller.signal,
        onFrame: async (frame, frames) => {
          await held.onFrame(frame, frames);
          setProgress({ frame: frame + 1, total: frames });
        },
      });
      setSaid(outcome(await recorder.finish()));
    } catch (raised) {
      recorder?.abort();
      setTrouble(raised instanceof FilmStopped ? 'Stopped, and nothing was written.' : String((raised as Error).message ?? raised));
    } finally {
      stopping.current = null;
      setProgress(null);
    }
  };

  return (
    <>
      <section className="block">
        <label className="field">
          <span className="field-label">Sequence</span>
          <select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} disabled={running}>
            {SEQUENCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <p className="note">
          {sequence.note} {sequence.shots.length} shots, {mmss(length)} long.
        </p>

        <label className="field">
          <span className="field-label">Size</span>
          <select value={resolutionId} onChange={(e) => setResolutionId(e.target.value)} disabled={running}>
            {RESOLUTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Rate</span>
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))} disabled={running}>
            {RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate} frames a second
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="block">
        <p className="film-buttons">
          {running ? (
            <button type="button" className="step" onClick={() => stopping.current?.abort()}>
              Cancel
            </button>
          ) : (
            <button type="button" className="step is-primary" onClick={() => void record()}>
              Record
            </button>
          )}
        </p>

        {progress && (
          <p className="film-progress num">
            frame {progress.frame} of {progress.total}, {mmss(progress.frame / fps)} of {mmss(progress.total / fps)}
            <span className="film-rule" aria-hidden="true">
              <span className="film-run" style={{ width: `${(100 * progress.frame) / progress.total}%` }} />
            </span>
          </p>
        )}

        {said && <p className="note">{said}</p>}
        {trouble && <p className="note film-trouble">{trouble}</p>}

        <p className="note">
          The film is stepped rather than captured: the sequence is advanced one frame at a time and the frame is drawn only when
          everything it needs is in, so the file is the same whatever the machine does. The window keeps its own size; the frame is
          drawn at the size asked for. Leave the tab in front while it runs.
        </p>
      </section>
    </>
  );
}
