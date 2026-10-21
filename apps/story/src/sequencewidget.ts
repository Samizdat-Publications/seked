/**
 * A sequence on the stage (src/sequence.ts): a canvas the size of the stage, the frame under the scroll drawn
 * over its neighbour at the share between them. The frames load when `load` is called, a chapter ahead of the
 * beat; until every frame has loaded the beat's still stands in, so a half-loaded sequence never shows.
 */
import { type Sequence, contain, cover, frameAt, frameFile } from './sequence';

export interface SequenceWidget {
  el: HTMLCanvasElement;
  sequence: Sequence;
  /** Start fetching the frames; resolves when all have loaded. */
  load(): Promise<void>;
  ready(): boolean;
  progress(p: number): void;
}

export function sequenceWidget(sequence: Sequence): SequenceWidget {
  const el = document.createElement('canvas');
  el.className = 'sequence';
  const ctx = el.getContext('2d')!;
  const frames: HTMLImageElement[] = [];
  let loading: Promise<void> | undefined;
  let done = false;
  let last = 0;

  const draw = (p: number) => {
    last = p;
    if (!done) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round(el.clientWidth * dpr);
    const ch = Math.round(el.clientHeight * dpr);
    if (!cw || !ch) return;
    if (el.width !== cw || el.height !== ch) {
      el.width = cw;
      el.height = ch;
    }
    const { a, b, mix } = frameAt(p, sequence.frames, sequence.loop);
    const fa = frames[a]!;
    const r = sequence.whole
      ? contain(fa.naturalWidth, fa.naturalHeight, cw, ch)
      : cover(fa.naturalWidth, fa.naturalHeight, cw, ch, sequence.focus);
    ctx.clearRect(0, 0, cw, ch);
    ctx.globalAlpha = 1;
    ctx.drawImage(fa, r.x, r.y, r.w, r.h);
    if (mix > 0.01 && b !== a) {
      ctx.globalAlpha = mix;
      ctx.drawImage(frames[b]!, r.x, r.y, r.w, r.h);
    }
  };

  return {
    el,
    sequence,
    load() {
      loading ??= Promise.all(Array.from({ length: sequence.frames }, (_, i) => new Promise<void>((ok, fail) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => ok();
        img.onerror = () => fail(new Error(`${frameFile(sequence, i)} did not load`));
        img.src = `./${frameFile(sequence, i)}`;
        frames[i] = img;
      }))).then(() => {
        done = true;
        draw(last);
      });
      return loading;
    },
    ready: () => done,
    progress: draw,
  };
}
